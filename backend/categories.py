from flask import Blueprint, request, jsonify

from models import Category, Product
from sqlalchemy.exc import IntegrityError
from database import db
from security import admin_required


categories_bp = Blueprint("categories", __name__)


@categories_bp.route("/categories", methods=["GET"])
def get_categories():
    """Return all categories (public)."""
    categories = Category.query.order_by(Category.name).all()

    return jsonify({
        "success": True,
        "categories": [
            category.to_dict()
            for category in categories
        ]
    })


@categories_bp.route("/categories/<int:id>", methods=["GET"])
def get_category(id):
    """Return a single category (public)."""
    category = Category.query.get(id)

    if category is None:
        return jsonify({
            "success": False,
            "message": "Category not found"
        }), 404

    return jsonify({
        "success": True,
        "category": category.to_dict()
    })


@categories_bp.route("/categories", methods=["POST"])
@admin_required
def create_category():
    """Create a category (admin). Validates non-empty and unique name."""
    data = request.get_json(silent=True) or {}

    name = (data.get("name") or "").strip()

    if not name:
        return jsonify({
            "success": False,
            "message": "Category name is required."
        }), 400

    if len(name) > 100:
        return jsonify({
            "success": False,
            "message": "Category name is too long (max 100 characters)."
        }), 400

    existing = Category.query.filter(
        db.func.lower(Category.name) == name.lower()
    ).first()

    if existing:
        return jsonify({
            "success": False,
            "message": "Category already exists."
        }), 409

    category = Category(name=name)

    try:
        db.session.add(category)
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({
            "success": False,
            "message": "Category already exists."
        }), 409
    except Exception:
        db.session.rollback()
        return jsonify({
            "success": False,
            "message": "Could not create the category. Please try again."
        }), 500

    return jsonify({
        "success": True,
        "message": "Category created.",
        "category": category.to_dict()
    }), 201


@categories_bp.route("/categories/<int:id>", methods=["DELETE"])
@admin_required
def delete_category(id):
    """Delete a category safely (admin).

    A category that is still assigned to one or more products is not deleted.
    This avoids leaving products with a broken category relationship and keeps
    the existing database schema unchanged.
    """
    category = Category.query.get(id)

    if category is None:
        return jsonify({
            "success": False,
            "message": "Category not found."
        }), 404

    product_count = Product.query.filter(Product.category_id == id).count()

    if product_count > 0:
        return jsonify({
            "success": False,
            "message": (
                f'Cannot delete "{category.name}" because {product_count} '
                f'product{"s" if product_count != 1 else ""} use this category. '
                "Move or delete those products first."
            )
        }), 409

    category_name = category.name

    try:
        db.session.delete(category)
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({
            "success": False,
            "message": "This category cannot be deleted because it is still in use."
        }), 409
    except Exception:
        db.session.rollback()
        return jsonify({
            "success": False,
            "message": "Could not delete the category. Please try again."
        }), 500

    return jsonify({
        "success": True,
        "message": f'Category "{category_name}" deleted.',
        "category_id": id
    }), 200
