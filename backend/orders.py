from datetime import datetime

from flask import Blueprint, request, jsonify

from models import Product, Order, OrderItem
from database import db

orders_bp = Blueprint("orders", __name__)

SHIPPING_FLAT_RATE = 12.0
TAX_RATE = 0.08


def _parse_float(value, default=0.0):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _is_available(product):
    """A product is available unless it is missing or explicitly 'out'."""
    if product is None:
        return False
    return (product.stock_status or "in").lower() != "out"


def _sale_active(product):
    """Return True when the product has a currently-active lower sale price."""
    if product is None:
        return False
    sale_price = product.sale_price if product.sale_price is not None else 0
    regular_price = product.price if product.price is not None else 0
    if not (sale_price > 0 and regular_price > sale_price):
        return False
    now = datetime.utcnow()
    if product.sale_start and product.sale_start > now:
        return False
    if product.sale_end and product.sale_end < now:
        return False
    return True


def _current_unit_price(product):
    """Server-side current price (sale price when active, else regular)."""
    regular = _parse_float(product.price)
    if _sale_active(product):
        sale = _parse_float(product.sale_price)
        if sale > 0:
            return sale
    return regular


def _order_to_dict(order):
    """Actual existing columns only (avoids AttributeError if a column wasn't migrated)."""
    base = {
        "id": order.id,
        "user_id": order.user_id,
        "payment_method": getattr(order, "payment_method", None),
        "status": order.status,
        "total": order.total,
        "items": [
            item.to_dict()
            for item in order.items
        ],
    }
    # Optional customer/pricing fields (present after migration).
    for attr in (
        "customer_name", "customer_lastname", "customer_email",
        "customer_phone", "customer_address", "customer_architecture",
        "customer_floor", "customer_lat", "customer_lng",
        "subtotal", "shipping", "tax", "discount", "created_at",
    ):
        if hasattr(order, attr):
            val = getattr(order, attr)
            if isinstance(val, datetime):
                val = val.strftime("%Y-%m-%d %H:%M:%S")
            base[attr] = val
    return base


@orders_bp.route("/orders", methods=["POST"])
def create_order():
    """
    Create an order from a list of items plus customer/shipping info.

    The server is the final authority: for every item it re-validates that the
    product still exists, is still available, has enough stock for the
    requested quantity, and recomputes the price from the CURRENT product
    record (sale price when a valid sale is active). The order total is
    therefore calculated server-side, never trusted from the client.
    """
    data = request.get_json(silent=True) or {}
    items = data.get("items") or []
    customer = data.get("customer") or {}
    payment_method = (data.get("payment_method") or "card").strip() or "card"

    if not isinstance(items, list) or len(items) == 0:
        return jsonify({
            "success": False,
            "message": "No items to order."
        }), 400

    # Validate quantities are positive integers.
    for item in items:
        try:
            qty = int(item.get("quantity", 0))
        except (TypeError, ValueError):
            qty = 0
        if qty < 1:
            return jsonify({
                "success": False,
                "message": "Invalid quantity for a product."
            }), 400

    # Re-validate each product and build validated order lines.
    order_lines = []  # (product, quantity, unit_price)
    for item in items:
        product = Product.query.get(item.get("product_id"))
        if product is None:
            return jsonify({
                "success": False,
                "message": "One or more products are no longer available."
            }), 400

        if not _is_available(product):
            return jsonify({
                "success": False,
                "message": f"'{product.title}' is currently out of stock."
            }), 400

        qty = int(item.get("quantity", 0))
        if product.stock is not None and qty > product.stock:
            return jsonify({
                "success": False,
                "message": f"Only {product.stock} of '{product.title}' are in stock."
            }), 400

        unit_price = _current_unit_price(product)
        order_lines.append((product, qty, unit_price))

    # Compute the server-side total.
    subtotal = sum(qty * price for (_, qty, price) in order_lines)
    shipping = SHIPPING_FLAT_RATE if subtotal > 0 else 0.0
    tax = round(subtotal * TAX_RATE, 2)
    total = round(subtotal + shipping + tax, 2)

    # Persist the order and its line items, and decrement stock.
    order = Order(
        user_id=data.get("user_id"),
        customer_name=(customer.get("firstName") or customer.get("name")),
        customer_lastname=customer.get("lastName"),
        customer_email=customer.get("email"),
        customer_phone=customer.get("phone"),
        customer_address=customer.get("address"),
        customer_architecture=customer.get("architecture"),
        customer_floor=customer.get("floor"),
        customer_lat=_parse_float(customer.get("lat"), None),
        customer_lng=_parse_float(customer.get("lng"), None),
        payment_method=payment_method,
        subtotal=round(subtotal, 2),
        shipping=shipping,
        tax=tax,
        discount=0,
        total=total,
        status="pending",
    )
    db.session.add(order)
    db.session.flush()  # assign order.id

    for (product, qty, unit_price) in order_lines:
        original_price = _parse_float(product.price)
        sale_price = _parse_float(product.sale_price) if _sale_active(product) else original_price
        line_total = round(unit_price * qty, 2)
        line_discount = round((original_price - unit_price) * qty, 2)

        db.session.add(OrderItem(
            order_id=order.id,
            product_id=product.id,
            product_name=product.title,
            quantity=qty,
            original_price=original_price,
            sale_price=sale_price,
            unit_price=unit_price,
            discount=line_discount,
            total=line_total,
        ))
        if product.stock is not None:
            product.stock = max(0, product.stock - qty)
            if product.stock <= 0:
                product.stock_status = "out"

    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({
            "success": False,
            "message": "Unable to place your order. Please try again."
        }), 500

    return jsonify({
        "success": True,
        "message": "Order placed successfully.",
        "order": _order_to_dict(order),
        "order_id": order.id,
        "total": total,
        "items": [
            {
                "product_id": p.id,
                "quantity": q,
                "price": pr,
            }
            for (p, q, pr) in order_lines
        ],
    }), 201


@orders_bp.route("/orders", methods=["GET"])
def list_orders():
    """Return all orders (most recent first) for the admin panel."""
    orders = Order.query.order_by(Order.id.desc()).all()
    return jsonify({
        "success": True,
        "orders": [_order_to_dict(o) for o in orders]
    })


@orders_bp.route("/orders/<int:order_id>", methods=["GET"])
def get_order(order_id):
    """Return a single order with its items."""
    order = Order.query.get(order_id)
    if order is None:
        return jsonify({
            "success": False,
            "message": "Order not found"
        }), 404
    return jsonify({
        "success": True,
        "order": _order_to_dict(order)
    })


@orders_bp.route("/orders/<int:order_id>/status", methods=["PUT"])
def update_order_status(order_id):
    """Update the status of an order (admin)."""
    order = Order.query.get(order_id)
    if order is None:
        return jsonify({
            "success": False,
            "message": "Order not found"
        }), 404

    data = request.get_json(silent=True) or {}
    new_status = (data.get("status") or "").strip().lower()

    allowed = {"pending", "processing", "shipped", "delivered", "cancelled"}
    if new_status not in allowed:
        return jsonify({
            "success": False,
            "message": "Invalid status."
        }), 400

    order.status = new_status
    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Status updated.",
        "order": _order_to_dict(order)
    })

