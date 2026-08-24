from flask import Blueprint, request, jsonify

from models import Category
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

    db.session.add(category)
    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Category created.",
        "category": category.to_dict()
    }), 201


@categories_bp.route("/categories/<int:id>", methods=["DELETE"])
@admin_required
def delete_category(id):
    """Delete a category without changing the database schema."""
    category = Category.query.get(id)
    if category is None:
        return jsonify({"success": False, "message": "Category not found."}), 404

    name = category.name
    try:
        db.session.delete(category)
        db.session.commit()
        return jsonify({"success": True, "message": "Category deleted.", "category_id": id, "name": name})
    except Exception as exc:
        db.session.rollback()
        return jsonify({"success": False, "message": "Could not delete category."}), 500
