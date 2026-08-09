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

    product = Product.query.get(id)

    if product is None:

        return jsonify({

            "success":False,

            "message":"Product not found"

        }),404

    data = request.get_json()

    product.title = data.get("title",product.title)

    product.description = data.get("description",product.description)

    category_name = (data.get("category") or product.category or "").strip()
    category_id = data.get("category_id")

    category = None
    if category_id:
        try:
            category = Category.query.get(int(category_id))
        except (TypeError, ValueError):
            category = None

    if category is None and category_name and (
        data.get("category") is not None or data.get("category_id") is not None
    ):
        category = Category.query.filter(
            db.func.lower(Category.name) == category_name.lower()
        ).first()

    if category is not None:
        product.category = category.name
        product.category_id = category.id
    elif data.get("category_id") is not None:
        # Explicitly clearing the category
        product.category_id = None
        product.category = category_name or None

    product.price = float(

        data.get("price",product.price)

    )

    sale_price_value = data.get("sale_price")
    if sale_price_value is not None and sale_price_value != "":
        product.sale_price = float(sale_price_value)
    else:
        product.sale_price = product.sale_price

    product.sale_enabled = bool(
        data.get("sale_enabled", product.sale_enabled)
    )

    if product.sale_price is not None and product.sale_price > 0 and product.sale_price < product.price:
        product.sale_enabled = True

    product.stock = int(

        data.get("stock",product.stock)

    )

    # Persist the admin's availability/out-of-stock control.
    # `stock_status` is the field that determines whether a product is
    # available ("in"/"low") or out of stock ("out"). If it is not provided,
    # derive it from the stock quantity so the value stays consistent.
    if data.get("stock_status"):
        product.stock_status = data.get("stock_status")
    else:
        if product.stock <= 0:
            product.stock_status = "out"
        elif product.stock <= (product.low_stock or 0):
            product.stock_status = "low"
        else:
            product.stock_status = "in"

    if data.get("low_stock") is not None:
        product.low_stock = int(data.get("low_stock"))

    # Persist the publish status too so the admin panel's publish control
    # (draft/published/scheduled) is saved correctly.
    if data.get("status"):
        product.status = data.get("status")

    product.image = data.get(

        "image",

        product.image

    )

    db.session.commit()

    return jsonify({

        "success":True,

        "message":"Product updated",

        "product":product.to_dict()

    })

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
