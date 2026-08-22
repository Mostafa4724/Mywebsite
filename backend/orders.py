from datetime import datetime
from sqlalchemy import func

from flask import Blueprint, request, jsonify

from models import User, Product, Order, OrderItem, ProductVariant, VariantSize
from database import db
from sales import sale_is_active, current_price, now_store, variant_current_price, variant_sale_is_active

from security import (
    user_required,
    admin_required,
    current_user
)
from flask_jwt_extended import get_jwt_identity


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
        rate = getattr(product, "tax_rate", None)
        if rate is not None:
            return max(0.0, min(100.0, float(rate))) / 100.0
    except (TypeError, ValueError):
        pass
    try:
        legacy_rates = {"standard": 0.08, "reduced": 0.04, "zero": 0.0, "none": 0.0}
        return legacy_rates.get(str(getattr(product, "tax_class", "")).strip().lower(), TAX_RATE)
    except (TypeError, ValueError):
        return TAX_RATE


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
    return sale_is_active(product)


def _current_unit_price(product):
    return float(current_price(product))


def _order_item_to_dict(item):
    """Return an order item using the live Product.image from shopping.db."""
    data = item.to_dict()

    product = None
    if item.product_id is not None:
        product = Product.query.get(item.product_id)

    if product is not None:
        data["image"] = getattr(item, "variant_image", None) or getattr(item, "image", None) or product.image
        data["product_id"] = product.id
        data["product_name"] = product.title
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

        "payment_method": getattr(order, "payment_method", None),
        "payment_status": getattr(order, "payment_status", None),
        "payment_verified_at": getattr(order, "payment_verified_at", None),
        "payment_verified_by": getattr(order, "payment_verified_by", None),
        "revenue_recognized_at": getattr(order, "revenue_recognized_at", None),
        "revenue_recognized_by": getattr(order, "revenue_recognized_by", None),

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



def _find_variant(product, variant_id, color, size):
    if variant_id in (None, "", 0, "0") and not color and not size:
        return None, None
    variant = None
    if variant_id not in (None, "", 0, "0"):
        try:
            variant = ProductVariant.query.filter_by(
                id=int(variant_id), product_id=product.id
            ).first()
        except (TypeError, ValueError):
            variant = None
    elif color:
        variant = ProductVariant.query.filter(
            ProductVariant.product_id == product.id,
            func.lower(ProductVariant.color) == str(color).strip().lower(),
        ).first()
    if variant is None:
        raise ValueError(f"Selected color variant is not available for '{product.title}'.")
    if not size:
        raise ValueError(f"Please select a size for '{variant.color}'.")
    size_obj = VariantSize.query.filter(
        VariantSize.variant_id == variant.id,
        func.lower(VariantSize.size) == str(size).strip().lower(),
    ).first()
    if size_obj is None:
        raise ValueError(f"Selected size is not available for '{variant.color}'.")
    return variant, size_obj


def _recalculate_product_stock(product):
    if product.variants:
        product.stock = sum(max(0, int(v.stock or 0)) for v in product.variants)
    else:
        product.stock = max(0, int(product.stock or 0))
    threshold = max(0, int(product.low_stock or 0))
    if product.stock == 0:
        product.stock_status = "out"
    elif product.stock <= threshold:
        product.stock_status = "low"
    else:
        product.stock_status = "in"


def _payment_initial_state(method):
    method = (method or "card").strip().lower()
    if method == "transfer":
        return "pending"
    if method == "cod":
        return "unpaid"
    return "pending"


# =============================================================
# CREATE ORDER
# =============================================================

@orders_bp.route(
    "/orders",
    methods=["POST"]
)
@user_required
def create_order():
    data = request.get_json(silent=True) or {}
    items = data.get("items") or []
    customer = data.get("customer") or {}
    payment_method = str(data.get("payment_method") or "card").strip().lower()

    if payment_method not in {"card", "cod", "transfer"}:
        return jsonify(success=False, message="Unsupported payment method."), 400
    if not isinstance(items, list) or not items:
        return jsonify(success=False, message="No items to order."), 400

    try:
        order_lines = []
        stock_requirements = {}

        for item in items:
            try:
                qty = int(item.get("quantity", 0))
            except (TypeError, ValueError):
                qty = 0
            if qty < 1:
                raise ValueError("Invalid quantity for a product.")

            product = Product.query.get(item.get("product_id"))
            if product is None:
                raise ValueError("One or more products are no longer available.")

            variant, size_obj = _find_variant(
                product,
                item.get("variant_id"),
                item.get("color"),
                item.get("size"),
            )

            if variant is not None:
                available = max(0, int(variant.stock or 0))
                key = ("variant", variant.id)
                requested = stock_requirements.get(key, 0) + qty
                if requested > available:
                    raise ValueError(
                        f"Only {available} of '{product.title}' / {variant.color} are in stock."
                    )
                unit_price = float(variant_current_price(variant, size_obj))
                color = variant.color
                size = size_obj.size
                variant_id = variant.id
                variant_image = variant.image or product.image
            else:
                if (product.stock_status or "in").lower() == "out" or int(product.stock or 0) < 1:
                    raise ValueError(f"'{product.title}' is currently out of stock.")
                key = ("product", product.id)
                requested = stock_requirements.get(key, 0) + qty
                available = max(0, int(product.stock or 0))
                if requested > available:
                    raise ValueError(
                        f"Only {available} of '{product.title}' are in stock."
                    )
                unit_price = _current_unit_price(product)
                color = None
                size = None
                variant_id = None
                variant_image = None

            stock_requirements[key] = requested
            order_lines.append({
                "product": product,
                "qty": qty,
                "unit_price": round(unit_price, 2),
                "variant": variant,
                "size_obj": size_obj,
                "variant_id": variant_id,
                "color": color,
                "size": size,
                "variant_image": variant_image,
            })

        subtotal = round(sum(line["qty"] * line["unit_price"] for line in order_lines), 2)
        shipping = SHIPPING_FLAT_RATE if subtotal > 0 else 0.0
        tax = round(
            sum(
                line["qty"] * line["unit_price"] * _product_tax_rate(line["product"])
                for line in order_lines
            ),
            2,
        )
        total = round(subtotal + shipping + tax, 2)

        order = Order(
            user_id=int(get_jwt_identity()),
            customer_name=customer.get("first_name") or customer.get("firstName") or customer.get("name"),
            customer_lastname=customer.get("last_name") or customer.get("lastName"),
            customer_email=customer.get("email"),
            customer_phone=customer.get("phone"),
            customer_address=customer.get("street") or customer.get("address"),
            customer_architecture=customer.get("architecture"),
            customer_floor=customer.get("floor"),
            customer_lat=_parse_float(customer.get("lat"), None),
            customer_lng=_parse_float(customer.get("lng"), None),
            payment_method=payment_method,
            payment_status=_payment_initial_state(payment_method),
            subtotal=subtotal,
            shipping=shipping,
            tax=tax,
            discount=0,
            total=total,
            status="placed",
        )
        db.session.add(order)
        db.session.flush()

        for line in order_lines:
            product = line["product"]
            qty = line["qty"]
            unit_price = line["unit_price"]
            variant = line["variant"]
            original_price = (
                float(line["size_obj"].price)
                if line["size_obj"] is not None
                else float(product.price or 0)
            )
            line_total = round(unit_price * qty, 2)
            line_discount = round(max(0.0, original_price - unit_price) * qty, 2)

            db.session.add(
                OrderItem(
                    order_id=order.id,
                    product_id=product.id,
                    product_name=product.title,
                    image=line["variant_image"] or product.image,
                    variant_id=line["variant_id"],
                    color=line["color"],
                    size=line["size"],
                    variant_image=line["variant_image"],
                    quantity=qty,
                    original_price=original_price,
                    sale_price=unit_price if unit_price < original_price else original_price,
                    unit_price=unit_price,
                    discount=line_discount,
                    total=line_total,
                )
            )

            if variant is not None:
                variant.stock = max(0, int(variant.stock or 0) - qty)
            else:
                product.stock = max(0, int(product.stock or 0) - qty)
            _recalculate_product_stock(product)

        db.session.commit()
    except ValueError as exc:
        db.session.rollback()
        return jsonify(success=False, message=str(exc)), 400
    except Exception:
        db.session.rollback()
        return jsonify(success=False, message="Unable to place your order. Please try again."), 500

    return jsonify(
        success=True,
        message="Order placed successfully.",
        order=_order_to_dict(order),
        order_id=order.id,
        total=total,
        items=[
            {
                "product_id": line["product"].id,
                "variant_id": line["variant_id"],
                "color": line["color"],
                "size": line["size"],
                "quantity": line["qty"],
                "price": line["unit_price"],
            }
            for line in order_lines
        ],
    ), 201


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

    # Bank-transfer orders remain blocked from fulfillment until payment is verified.
    if (
        order.payment_method == "transfer"
        and new_status in {"confirmed", "processing", "shipped", "delivered"}
        and (order.payment_status or "").lower() != "verified"
    ):
        return jsonify(
            success=False,
            message="Verify the bank-transfer payment before fulfillment can continue.",
        ), 409

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

    if new_status == "delivered" and order.revenue_recognized_at is None:
        if order.payment_method == "transfer" and (order.payment_status or "").lower() != "verified":
            db.session.rollback()
            return jsonify(success=False, message="Bank-transfer payment must be verified before delivery."), 409
        order.revenue_recognized_at = now_store().replace(tzinfo=None)
        order.revenue_recognized_by = int(get_jwt_identity())

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

@orders_bp.route("/orders/<int:order_id>/payment", methods=["PUT"])
@admin_required
def update_payment_status(order_id):
    order = Order.query.get(order_id)
    if order is None:
        return jsonify(success=False, message="Order not found"), 404

    data = request.get_json(silent=True) or {}
    requested = str(data.get("status") or "").strip().lower()
    if requested not in {"verified", "rejected"}:
        return jsonify(success=False, message="Payment status must be verified or rejected."), 400
    if order.payment_method != "transfer":
        return jsonify(success=False, message="Manual payment verification is only available for bank transfers."), 400

    # Keep the previous value so inventory can only be restored once.
    old_payment_status = (
        order.payment_status or ""
    ).strip().lower()

    order.payment_status = requested
    order.payment_verified_at = now_store().replace(tzinfo=None)
    order.payment_verified_by = int(get_jwt_identity())

    if requested == "rejected":
        order.revenue_recognized_at = None
        order.revenue_recognized_by = None

        # A refused payment cancels the order.
        order.status = "cancelled"

        # The order already removed these quantities when it was created.
        # Return them to inventory when payment is refused. The old-status
        # check prevents stock from being restored twice if the endpoint is
        # called again for an order that is already rejected.
        if old_payment_status != "rejected":
            for item in order.items:
                qty = max(0, int(item.quantity or 0))

                if qty <= 0:
                    continue

                if item.variant_id:
                    variant = ProductVariant.query.get(item.variant_id)

                    if variant is not None:
                        variant.stock = max(
                            0,
                            int(variant.stock or 0) + qty
                        )
                        _recalculate_product_stock(variant.product)
                else:
                    product = Product.query.get(item.product_id)

                    if product is not None:
                        product.stock = max(
                            0,
                            int(product.stock or 0) + qty
                        )
                        _recalculate_product_stock(product)

    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify(success=False, message="Unable to update payment status."), 500

    return jsonify(success=True, message=f"Payment marked {requested}.", order=_order_to_dict(order))