import os
import uuid

from datetime import datetime


def _parse_bool(value):

    if isinstance(value, bool):
        return value

    if value is None:
        return False

    if isinstance(value, (int, float)):
        return bool(value)

    return str(value).strip().lower() in {"1", "true", "yes", "on"}
from werkzeug.utils import secure_filename
from flask import current_app

from flask import Blueprint, request, jsonify

from models import Product, Category
from database import db
from security import admin_required
from models import Review

products_bp = Blueprint("products", __name__)


def _resolve_category(category_id, category_name):
    """Resolve a category by id (falling back to name) and return it."""
    if category_id:
        category = Category.query.get(category_id)
        if category:
            return category
    if category_name:
        category = Category.query.filter(
            db.func.lower(Category.name) == category_name.strip().lower()
        ).first()
        if category:
            return category
    return None


@products_bp.route("/products", methods=["GET"])
def get_products():

    category_id = request.args.get("category_id", type=int)

    query = Product.query

    if category_id:
        query = query.filter(Product.category_id == category_id)

    products = query.all()

    return jsonify({

        "success": True,

        "products": [

            product.to_dict()

            for product in products

        ]

    })

@products_bp.route("/products/<int:id>", methods=["GET"])
def get_product(id):

    product = Product.query.get(id)

    if product is None:

        return jsonify({

            "success": False,

            "message": "Product not found"

        }),404

    return jsonify({

        "success": True,

        "product": product.to_dict()

    })

@products_bp.route("/admin/products", methods=["POST"])
@admin_required
#@admin_required#
def add_product():

    data = request.form

    image = request.files.get("image")

    filename = ""

    if image:

        filename = (
            str(uuid.uuid4())
            + "_"
            + secure_filename(image.filename)
        )

        image.save(

            os.path.join(

                current_app.config["UPLOAD_FOLDER"],

                filename

            )

        )

    stock = int(data.get("stock", 0))
    low_stock = int(data.get("low_stock", 10))

    if stock <= 0:
        stock_status = "out"
    elif stock <= low_stock:
        stock_status = "low"
    else:
        stock_status = "in"

    if data.get("stock_status"):
        stock_status = data.get("stock_status")

    sale_start = None
    sale_end = None

    if data.get("sale_start"):
        sale_start = datetime.fromisoformat(data.get("sale_start"))

    if data.get("sale_end"):
        sale_end = datetime.fromisoformat(data.get("sale_end"))

    price_value = float(data.get("price", 0))
    sale_price_value = data.get("sale_price")
    sale_price = float(sale_price_value) if sale_price_value else None
    sale_enabled = _parse_bool(data.get("sale_enabled"))

    if sale_price is not None and sale_price < price_value:
        sale_enabled = True

    if sale_price is None and data.get("sale_enabled") in {"true", "1", 1, True}:
        sale_enabled = True

    category_name = (data.get("category") or "").strip()
    category_id = data.get("category_id")

    category = None
    if category_id:
        try:
            category = Category.query.get(int(category_id))
        except (TypeError, ValueError):
            category = None

    if category is None and category_name:
        category = Category.query.filter(
            db.func.lower(Category.name) == category_name.lower()
        ).first()

    product = Product(

        # Basic Information
        title=data.get("title"),
        description=data.get("description"),
        brand=data.get("brand"),
        category=category.name if category else (category_name or None),
        category_id=category.id if category else None,

        # Pricing
        price=price_value,
        cost=float(data.get("cost", 0)),
        sale_price=sale_price,

        # Inventory
        stock=stock,
        low_stock=low_stock,
        stock_status=stock_status,

        # Tax
        tax_class=data.get("tax_class", "standard"),

        # Image
        image=filename,

        # Publish
        status=data.get("status", "draft"),

        # Sale
        sale_enabled=sale_enabled,
        sale_start=sale_start,
        sale_end=sale_end,
        sale_badge=data.get("sale_badge"),
        sale_badge_color=data.get("sale_badge_color"),

        # Tags
        tags=data.get("tags", "")

    )

    db.session.add(product)

    db.session.commit()

    return jsonify({

        "success": True,

        "message": "Product added",

        "product": product.to_dict()

    })

@products_bp.route("/admin/products/<int:id>", methods=["PUT"])
@admin_required
def edit_product(id):
    """Update a product using the same database model used by Add Product."""
    product = Product.query.get(id)
    if product is None:
        return jsonify(success=False, message="Product not found"), 404

    # The edit page sends multipart/form-data so it can optionally upload an image.
    # Read the submitted fields directly from request.form.  Do not access
    # request.json/request.get_json() here: Flask can reject a non-JSON request
    # with HTTP 415 before the update is processed.
    data = request.form.to_dict(flat=True)

    def value(name, default=None):
        return data.get(name, default)

    title = (value("title", product.title) or "").strip()
    description = (value("description", product.description) or "").strip()
    brand = (value("brand", product.brand) or "").strip()
    if not title:
        return jsonify(success=False, message="Please enter a product name."), 400
    if not description:
        return jsonify(success=False, message="Description is required."), 400

    try:
        price = float(value("price", product.price))
        cost = float(value("cost", product.cost or 0))
        stock = int(value("stock", product.stock or 0))
        low_stock = int(value("low_stock", product.low_stock or 0))
    except (TypeError, ValueError):
        return jsonify(success=False, message="Price, cost and quantity must be valid numbers."), 400

    if price < 0 or cost < 0 or stock < 0 or low_stock < 0:
        return jsonify(success=False, message="Price, cost, quantity and low-stock threshold cannot be negative."), 400

    category_id_raw = value("category_id")
    category_name = (value("category") or "").strip()
    category = None
    if category_id_raw not in (None, "", "null"):
        try:
            category = Category.query.get(int(category_id_raw))
        except (TypeError, ValueError):
            category = None
        if category is None:
            return jsonify(success=False, message="Selected category does not exist."), 400
    elif category_name:
        category = Category.query.filter(
            db.func.lower(Category.name) == category_name.lower()
        ).first()
        if category is None:
            return jsonify(success=False, message="Selected category does not exist."), 400
    else:
        return jsonify(success=False, message="Please select a category."), 400

    sale_enabled = _parse_bool(value("sale_enabled", product.sale_enabled))
    sale_price_raw = value("sale_price")
    sale_price = None
    if sale_enabled:
        if sale_price_raw not in (None, ""):
            try:
                sale_price = float(sale_price_raw)
            except (TypeError, ValueError):
                return jsonify(success=False, message="Sale price is invalid."), 400
        if sale_price is None:
            return jsonify(success=False, message="Sale price is required when sale is enabled."), 400
        if sale_price <= 0 or sale_price >= price:
            return jsonify(success=False, message="Sale price must be greater than 0 and lower than the regular price."), 400
    else:
        sale_price = None

    def parse_datetime_field(name):
        raw = value(name)
        if raw in (None, ""):
            return None
        try:
            return datetime.fromisoformat(str(raw).replace("Z", "+00:00")).replace(tzinfo=None)
        except ValueError:
            raise ValueError(f"{name} is invalid.")

    try:
        sale_start = parse_datetime_field("sale_start") if sale_enabled else None
        sale_end = parse_datetime_field("sale_end") if sale_enabled else None
        scheduled_date = parse_datetime_field("scheduled_date") if value("status", product.status) == "scheduled" else None
    except ValueError as exc:
        return jsonify(success=False, message=str(exc)), 400

    status = str(value("status", product.status or "draft")).strip().lower()
    if status not in {"draft", "published", "scheduled"}:
        return jsonify(success=False, message="Invalid publish status."), 400
    if status == "scheduled" and scheduled_date is None:
        return jsonify(success=False, message="A publish date is required for scheduled products."), 400

    stock_status = value("stock_status")
    if stock_status not in {"in", "low", "out"}:
        if stock <= 0:
            stock_status = "out"
        elif stock <= low_stock:
            stock_status = "low"
        else:
            stock_status = "in"

    # Update every product field that actually exists in the database schema.
    product.title = title
    product.description = description
    product.brand = brand
    product.category = category.name
    product.category_id = category.id
    product.price = price
    product.cost = cost
    product.sale_price = sale_price
    product.stock = stock
    product.low_stock = low_stock
    product.stock_status = stock_status
    product.tax_class = value("tax_class", product.tax_class or "standard")
    product.status = status
    product.scheduled_date = scheduled_date
    product.sale_enabled = sale_enabled
    product.sale_start = sale_start
    product.sale_end = sale_end
    product.sale_badge = (value("sale_badge", product.sale_badge) or "").strip() or None
    product.sale_badge_color = (value("sale_badge_color", product.sale_badge_color) or "").strip() or None
    product.tags = (value("tags", product.tags) or "").strip()

    # Image replacement is optional. The existing image stays in the database
    # unless a new file was actually selected by the admin.
    image = request.files.get("image")
    if image is not None and image.filename:
        allowed = {"png", "jpg", "jpeg", "webp"}
        filename = secure_filename(image.filename)
        extension = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        if extension not in allowed:
            return jsonify(success=False, message="Image must be PNG, JPG or WebP."), 400

        image.seek(0, os.SEEK_END)
        size = image.tell()
        image.seek(0)
        if size <= 0:
            return jsonify(success=False, message="The selected image is empty."), 400
        if size > 5 * 1024 * 1024:
            return jsonify(success=False, message="Image must be 5MB or smaller."), 400

        upload_folder = current_app.config["UPLOAD_FOLDER"]
        os.makedirs(upload_folder, exist_ok=True)
        stored_name = f"{uuid.uuid4()}_{filename}"
        image.save(os.path.join(upload_folder, stored_name))
        product.image = stored_name
    # If no new image was supplied, the existing image remains untouched.

    db.session.commit()

    return jsonify(success=True, message="Product updated", product=product.to_dict())

@products_bp.route("/admin/products/<int:id>", methods=["DELETE"])
@admin_required
def delete_product(id):

    product = Product.query.get(id)

    if product is None:

        return jsonify({

            "success":False,

            "message":"Product not found"

        }),404

    db.session.delete(product)

    db.session.commit()

    return jsonify({

        "success":True,

        "message":"Product deleted"

    })
@products_bp.route("/products/<int:id>/reviews", methods=["POST"])
def add_review(id):

    product = Product.query.get(id)

    if product is None:

        return jsonify({

            "success": False,
            "message": "Product not found"

        }), 404

    data = request.get_json()

    review = Review(

        product_id=id,
        username=data.get("username", "Anonymous"),
        rating=int(data["rating"]),
        comment=data["comment"]

    )

    db.session.add(review)

    db.session.commit()

    return jsonify({

        "success": True,
        "review": review.to_dict()

    })
@products_bp.route("/products/<int:id>/reviews", methods=["GET"])
def get_reviews(id):

    reviews = Review.query.filter_by(

        product_id=id

    ).order_by(

        Review.created_at.desc()

    ).all()

    return jsonify({

        "success": True,

        "reviews": [

            review.to_dict()

            for review in reviews

        ]

    })
