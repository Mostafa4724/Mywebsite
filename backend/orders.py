from datetime import datetime

from flask import Blueprint, request, jsonify

from models import User, Product, Order, OrderItem
from database import db
from security import (
    user_required,
    admin_required,
    current_user
)
from flask_jwt_extended import get_jwt_identity
from variant import get_variants, find_variant, find_size, set_variants_on_product


orders_bp = Blueprint(
    "orders",
    __name__
)


SHIPPING_FLAT_RATE = 12.0
TAX_RATE = 0.08  # fallback only for legacy products with no valid tax value

def _product_tax_rate(product):
    """Return the product tax percentage entered by the admin."""
    if product is None:
        return TAX_RATE
    try:
        return max(0.0, min(100.0, float(getattr(product, "tax_rate", product.tax_class)))) / 100.0
    except (TypeError, ValueError):
        legacy_rates = {"standard": 0.08, "reduced": 0.04, "zero": 0.0, "none": 0.0}
        return legacy_rates.get(str(getattr(product, "tax_class", "")).strip().lower(), TAX_RATE)


def _parse_float(value, default=0.0):

    try:
        return float(value)

    except (TypeError, ValueError):
        return default


def _is_available(product):
    """
    A product is available unless it is missing
    or explicitly marked as out.
    """

    if product is None:
        return False

    return (
        product.stock_status or "in"
    ).lower() != "out"


def _sale_active(product):
    """
    Return True when the product has a currently active
    lower sale price.
    """

    if product is None:
        return False

    sale_price = (
        product.sale_price
        if product.sale_price is not None
        else 0
    )

    regular_price = (
        product.price
        if product.price is not None
        else 0
    )

    if not (
        sale_price > 0
        and regular_price > sale_price
    ):
        return False

    now = datetime.utcnow()

    if (
        product.sale_start
        and product.sale_start > now
    ):
        return False

    if (
        product.sale_end
        and product.sale_end < now
    ):
        return False

    return True


def _current_unit_price(product):
    """
    Server-side current price.

    Uses sale price only when the sale is currently active.
    """

    regular = _parse_float(
        product.price
    )

    print(
        "🔥 PRICE DEBUG:",
        {
            "product_id": product.id,
            "product": product.title,
            "raw_price": product.price,
            "parsed_regular": regular,
            "raw_sale_price": product.sale_price,
            "sale_active": _sale_active(product),
            "parsed_sale": _parse_float(product.sale_price),
        }
    )

    if _sale_active(product):

        sale = _parse_float(
            product.sale_price
        )

        if sale > 0:
            return sale

    return regular



def _order_item_to_dict(item):
    """Return an order item using the live Product.image from shopping.db."""
    data = item.to_dict()

    product = None
    if item.product_id is not None:
        product = Product.query.get(item.product_id)

    if product is not None:
        # Preserve the order-time variant snapshot image/name when present.
        data["image"] = getattr(item, "image", None) or product.image
        data["product_id"] = product.id
        data["product_name"] = item.product_name or product.title
    else:
        data["image"] = getattr(item, "image", None)

    return data

def _order_to_dict(order):
    """
    Serialize only real order fields.

    This prevents frontend/API field mismatches from creating
    AttributeError problems.
    """

    # Resolve the real account username from the users table.
    # This is the source of truth for the username shown in orders,
    # including orders that were created before this field was added.
    user = None
    if order.user_id is not None:
        user = User.query.get(order.user_id)

    base = {

        "id": order.id,

        "user_id": order.user_id,

        "username": user.username if user else None,

        "payment_method": getattr(
            order,
            "payment_method",
            None
        ),

        "status": order.status,

        "total": order.total,

        "items": [
            _order_item_to_dict(item)
            for item in order.items
        ],
    }

    optional_fields = (

        "customer_name",

        "customer_lastname",

        "customer_email",

        "customer_phone",

        "customer_address",

        "customer_architecture",

        "customer_floor",

        "customer_lat",

        "customer_lng",

        "subtotal",

        "shipping",

        "tax",

        "discount",

        "created_at",

    )

    for attr in optional_fields:

        if hasattr(order, attr):

            val = getattr(
                order,
                attr
            )

            if isinstance(
                val,
                datetime
            ):

                val = val.strftime(
                    "%Y-%m-%d %H:%M:%S"
                )

            base[attr] = val

    return base


# =============================================================
# CREATE ORDER
# =============================================================

@orders_bp.route(
    "/orders",
    methods=["POST"]
)
@user_required
def create_order():
    print("🔥 CREATE ORDER CALLED")

    """
    Create an order.

    The server is the final authority.

    It validates:
    - product existence
    - product availability
    - stock
    - current price
    - sale price
    - order totals
    """

    data = request.get_json(
        silent=True
    ) or {}

    items = data.get("items") or []

    customer = data.get(
        "customer"
    ) or {}

    payment_method = (
        data.get("payment_method")
        or "card"
    ).strip() or "card"

    if (
        not isinstance(items, list)
        or len(items) == 0
    ):

        return jsonify({
            "success": False,
            "message": "No items to order."
        }), 400

    # ---------------------------------------------------------
    # Validate quantities
    # ---------------------------------------------------------

    for item in items:

        try:
            qty = int(
                item.get(
                    "quantity",
                    0
                )
            )

        except (
            TypeError,
            ValueError
        ):

            qty = 0

        if qty < 1:

            return jsonify({
                "success": False,
                "message": "Invalid quantity for a product."
            }), 400

    # ---------------------------------------------------------
    # Validate products
    # ---------------------------------------------------------

    order_lines = []

    for item in items:

        product = Product.query.get(
            item.get("product_id")
        )

        if product is None:

            return jsonify({
                "success": False,
                "message": (
                    "One or more products are "
                    "no longer available."
                )
            }), 400

        if not _is_available(product):

            return jsonify({
                "success": False,
                "message": (
                    f"'{product.title}' is "
                    "currently out of stock."
                )
            }), 400

        qty = int(
            item.get(
                "quantity",
                0
            )
        )

        selected_variant = item.get("variant") or None
        variant = None
        variant_size = None

        if selected_variant:
            variants = get_variants(product)
            variant = find_variant(
                variants,
                variant_id=selected_variant.get("id"),
                color=selected_variant.get("color")
            )
            if not variant:
                return jsonify({"success": False, "message": f"Selected color for '{product.title}' is no longer available."}), 400
            variant_size = find_size(variant, selected_variant.get("size"))
            if not variant_size:
                return jsonify({"success": False, "message": f"Selected size for '{product.title}' is no longer available."}), 400
            if int(variant.get("stock", 0)) < qty:
                return jsonify({"success": False, "message": f"Only {variant.get('stock', 0)} of '{product.title}' in color {variant.get('color')} are in stock."}), 400
            unit_price = _parse_float(variant_size.get("price"))
        else:
            if product.stock is not None and qty > product.stock:
                return jsonify({
                    "success": False,
                    "message": f"Only {product.stock} of '{product.title}' are in stock."
                }), 400
            unit_price = _current_unit_price(product)

        print("🔥 ORDER PRICE:", product.id, product.title, "UNIT PRICE =", unit_price)

        order_lines.append((product, qty, unit_price, variant, variant_size))


    # ---------------------------------------------------------
    # Calculate totals
    # ---------------------------------------------------------

    subtotal = sum(
        qty * price
        for (
            _,
            qty,
            price,
            _variant,
            _variant_size
        ) in order_lines
    )

    shipping = (
        SHIPPING_FLAT_RATE
        if subtotal > 0
        else 0.0
    )

    tax = round(
        sum(qty * price * _product_tax_rate(product) for product, qty, price, _variant, _variant_size in order_lines),
        2
    )

    total = round(
        subtotal
        + shipping
        + tax,
        2
    )

    # ---------------------------------------------------------
    # Create order
    # ---------------------------------------------------------

    order = Order(

        user_id=int(
            get_jwt_identity()
        ),

        customer_name=(
            customer.get("first_name")
            or customer.get("firstName")
            or customer.get("name")
        ),

        customer_lastname=(
            customer.get("last_name")
            or customer.get("lastName")
        ),

        customer_email=customer.get("email"),

        customer_phone=customer.get("phone"),

        customer_address=(
            customer.get("street")
            or customer.get("address")
        ),

        customer_architecture=customer.get(
            "architecture"
        ),

        customer_floor=customer.get(
            "floor"
        ),

        customer_lat=_parse_float(
            customer.get("lat"),
            None
        ),

        customer_lng=_parse_float(
            customer.get("lng"),
            None
        ),

        payment_method=payment_method,

        subtotal=round(
            subtotal,
            2
        ),

        shipping=shipping,

        tax=tax,

        discount=0,

        total=total,

        # IMPORTANT:
        # Customer placing the order does NOT
        # automatically confirm it.
        status="placed",
    )

    db.session.add(order)

    db.session.flush()

    # ---------------------------------------------------------
    # Create order items
    # ---------------------------------------------------------

    for (
        product,
        qty,
        unit_price,
        variant,
        variant_size
    ) in order_lines:

        original_price = _parse_float(
            product.price
        )

        sale_price = (
            _parse_float(
                product.sale_price
            )
            if _sale_active(product)
            else original_price
        )

        line_total = round(
            unit_price * qty,
            2
        )

        line_discount = round(
            (
                original_price
                - unit_price
            ) * qty,
            2
        )

        variant_suffix = ""
        order_image = product.image
        if variant:
            variant_suffix = f" — Color: {variant.get('color')} — Size: {variant_size.get('size')}"
            order_image = variant.get("image") or product.image

        db.session.add(
            OrderItem(
                order_id=order.id,
                product_id=product.id,
                product_name=product.title + variant_suffix,
                image=order_image,
                quantity=qty,
                original_price=original_price,
                sale_price=sale_price,
                unit_price=unit_price,
                discount=line_discount,
                total=line_total,
            )
        )

        # Decrease inventory. Variant stock is stored in the existing tags TEXT field.
        if variant:
            variants = get_variants(product)
            live_variant = find_variant(variants, variant_id=variant.get("id"))
            if live_variant:
                live_variant["stock"] = max(0, int(live_variant.get("stock", 0)) - qty)
                set_variants_on_product(product, variants)

        if product.stock is not None:
            product.stock = max(0, product.stock - qty)
            if product.stock <= 0:
                product.stock_status = "out"

    # ---------------------------------------------------------
    # Commit
    # ---------------------------------------------------------

    try:

        db.session.commit()

    except Exception:

        db.session.rollback()

        return jsonify({
            "success": False,
            "message": (
                "Unable to place your order. "
                "Please try again."
            )
        }), 500

    # ---------------------------------------------------------
    # Response
    # ---------------------------------------------------------

    return jsonify({

        "success": True,

        "message": "Order placed successfully.",

        "order": _order_to_dict(order),

        "order_id": order.id,

        "total": total,

        "items": [

            {
                "product_id": product.id,
                "quantity": quantity,
                "price": price,
                "variant_id": variant.get("id") if variant else None,
            }

            for (
                product,
                quantity,
                price,
                variant,
                _variant_size
            ) in order_lines
        ],

    }), 201


# =============================================================
# LIST ORDERS
# =============================================================

@orders_bp.route(
    "/orders",
    methods=["GET"]
)
@user_required
def list_orders():

    """
    Admins see all orders.
    Normal users see only their own orders.
    """

    user = current_user()

    if user.role == "admin":

        orders = (
            Order.query
            .order_by(
                Order.id.desc()
            )
            .all()
        )

    else:

        orders = (
            Order.query
            .filter_by(
                user_id=user.id
            )
            .order_by(
                Order.id.desc()
            )
            .all()
        )

    return jsonify({

        "success": True,

        "orders": [
            _order_to_dict(order)
            for order in orders
        ]

    })


# =============================================================
# GET SINGLE ORDER
# =============================================================

@orders_bp.route(
    "/orders/<int:order_id>",
    methods=["GET"]
)
@user_required
def get_order(order_id):

    """
    Admins may view any order.

    Normal users may view only their own order.
    """

    order = Order.query.get(
        order_id
    )

    if order is None:

        return jsonify({
            "success": False,
            "message": "Order not found"
        }), 404

    user = current_user()

    if (
        user.role != "admin"
        and order.user_id != user.id
    ):

        return jsonify({
            "success": False,
            "message": (
                "You do not have permission "
                "to view this order."
            )
        }), 403

    return jsonify({

        "success": True,

        "order": _order_to_dict(
            order
        )

    })


# =============================================================
# UPDATE ORDER STATUS
# =============================================================

@orders_bp.route(
    "/orders/<int:order_id>/status",
    methods=["PUT"]
)
@admin_required
def update_order_status(order_id):

    """
    Move an order forward exactly one step.

    Valid fulfillment flow:

        placed
          ↓
        confirmed
          ↓
        processing
          ↓
        shipped
          ↓
        delivered

    The frontend is NOT trusted to enforce this.
    The backend enforces it too.
    """

    order = Order.query.get(
        order_id
    )

    if order is None:

        return jsonify({
            "success": False,
            "message": "Order not found"
        }), 404

    data = request.get_json(
        silent=True
    ) or {}

    new_status = (
        data.get("status")
        or ""
    ).strip().lower()

    allowed = {
        "placed",
        "confirmed",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
    }

    if new_status not in allowed:

        return jsonify({
            "success": False,
            "message": "Invalid status."
        }), 400

    # ---------------------------------------------------------
    # Normalize legacy status
    # ---------------------------------------------------------

    current_status = (
        order.status
        or "placed"
    ).strip().lower()

    if current_status == "pending":

        current_status = "placed"

    # ---------------------------------------------------------
    # Cancellation
    # ---------------------------------------------------------

    if new_status == "cancelled":

        if current_status in {
            "delivered",
            "cancelled"
        }:

            return jsonify({
                "success": False,
                "message": (
                    "This order can no longer "
                    "be cancelled."
                )
            }), 409

    else:

        # -----------------------------------------------------
        # Exact one-step transition
        # -----------------------------------------------------

        transition = {

            "placed": "confirmed",

            "confirmed": "processing",

            "processing": "shipped",

            "shipped": "delivered",

        }

        expected = transition.get(
            current_status
        )

        if expected != new_status:

            if current_status == new_status:

                message = (
                    "Order is already at "
                    "this status."
                )

            elif current_status == "delivered":

                message = (
                    "This order is already delivered."
                )

            elif current_status == "cancelled":

                message = (
                    "Cancelled orders cannot "
                    "be moved forward."
                )

            else:

                message = (
                    "Invalid status transition. "
                    "The next allowed status after "
                    f"'{current_status}' is "
                    f"'{expected}'."
                )

            return jsonify({

                "success": False,

                "message": message

            }), 409

    # ---------------------------------------------------------
    # Save
    # ---------------------------------------------------------

    order.status = new_status

    try:

        db.session.commit()

    except Exception:

        db.session.rollback()

        return jsonify({
            "success": False,
            "message": (
                "Unable to update order status."
            )
        }), 500

    return jsonify({

        "success": True,

        "message": "Status updated.",

        "order": _order_to_dict(
            order
        )

    })