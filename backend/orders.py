from flask import Blueprint, request, jsonify

from models import Product, Order, OrderItem
from database import db

orders_bp = Blueprint("orders", __name__)


def _is_available(product):
    """A product is available unless it is missing or explicitly 'out'."""
    if product is None:
        return False
    return (product.stock_status or "in").lower() != "out"


@orders_bp.route("/orders", methods=["POST"])
def create_order():
    """
    Create an order from a list of items.

    The frontend is NOT the final authority on order validity. This endpoint
    re-validates, for every item, that the product:
      - still exists,
      - is still available (stock_status != 'out'),
      - has enough stock for the requested quantity,
    and recomputes the price from the CURRENT product record (using the sale
    price when a valid sale is active) rather than trusting any client-supplied
    price. The order total is therefore calculated server-side.
    """
    data = request.get_json(silent=True) or {}
    items = data.get("items") or []

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
                "message": "A product in your order is no longer available."
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

        # Use current price from the database (sale price when active).
        sale_price = product.sale_price or 0
        regular_price = product.price or 0
        unit_price = (
            sale_price
            if sale_price > 0 and regular_price > sale_price
            else regular_price
        )

        order_lines.append((product, qty, unit_price))

    # Compute the server-side total.
    subtotal = sum(qty * price for (_, qty, price) in order_lines)
    shipping = 12.0 if subtotal > 0 else 0.0
    tax = subtotal * 0.08
    total = round(subtotal + shipping + tax, 2)

    # Persist the order and its line items, and decrement stock.
    order = Order(
        user_id=None,  # anonymous checkout for now
        total=total,
        status="placed",
        payment="pending",
    )
    db.session.add(order)
    db.session.flush()  # assign order.id

    for (product, qty, price) in order_lines:
        db.session.add(OrderItem(
            order_id=order.id,
            product_id=product.id,
            quantity=qty,
            price=price,
        ))
        if product.stock is not None:
            product.stock = max(0, product.stock - qty)
            if product.stock <= 0:
                product.stock_status = "out"

    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Order placed successfully.",
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
