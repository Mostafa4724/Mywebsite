from flask import Blueprint, request, jsonify, current_app

from models import Category
from database import db
from security import admin_required
from werkzeug.utils import secure_filename
import os, json, uuid


categories_bp = Blueprint("categories", __name__)

CATEGORY_IMAGE_META = os.path.join(os.path.dirname(__file__), "category_images.json")
ALLOWED_CATEGORY_IMAGE_EXTENSIONS = {"png", "jpg", "jpeg", "webp", "gif"}

def _read_category_images():
    try:
        with open(CATEGORY_IMAGE_META, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data if isinstance(data, dict) else {}
    except (FileNotFoundError, json.JSONDecodeError):
        return {}

def _write_category_images(data):
    tmp = CATEGORY_IMAGE_META + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp, CATEGORY_IMAGE_META)

def _category_to_dict(category):
    result = category.to_dict()
    filename = _read_category_images().get(str(category.id))
    result["image"] = filename
    result["image_url"] = ("/uploads/categories/" + filename) if filename else None
    return result

def _save_category_image(file_obj, category_id):
    if not file_obj or not file_obj.filename:
        return None
    original = secure_filename(file_obj.filename)
    ext = original.rsplit(".", 1)[1].lower() if "." in original else ""
    if ext not in ALLOWED_CATEGORY_IMAGE_EXTENSIONS:
        raise ValueError("Unsupported image type. Use PNG, JPG, JPEG, WEBP, or GIF.")
    folder = os.path.join(current_app.config["UPLOAD_FOLDER"], "categories")
    os.makedirs(folder, exist_ok=True)
    filename = f"category_{category_id}_{uuid.uuid4().hex}.{ext}"
    file_obj.save(os.path.join(folder, filename))
    return filename



@categories_bp.route("/categories", methods=["GET"])
def get_categories():
    """Return all categories (public)."""
    categories = Category.query.order_by(Category.name).all()

    return jsonify({
        "success": True,
        "categories": [
            _category_to_dict(category)
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
        "category": _category_to_dict(category)
    })


@categories_bp.route("/categories", methods=["POST"])
@admin_required
def create_category():
    """Create a category with an optional image, without changing DB schema."""
    name = (request.form.get("name") or "").strip()
    if not name:
        return jsonify({"success": False, "message": "Category name is required."}), 400
    if len(name) > 100:
        return jsonify({"success": False, "message": "Category name is too long (max 100 characters)."}), 400
    existing = Category.query.filter(db.func.lower(Category.name) == name.lower()).first()
    if existing:
        return jsonify({"success": False, "message": "Category already exists."}), 409
    try:
        category = Category(name=name)
        db.session.add(category)
        db.session.flush()
        image = request.files.get("image")
        filename = _save_category_image(image, category.id) if image else None
        if filename:
            meta = _read_category_images(); meta[str(category.id)] = filename; _write_category_images(meta)
        db.session.commit()
        return jsonify({"success": True, "message": "Category created.", "category": _category_to_dict(category)}), 201
    except ValueError as exc:
        db.session.rollback()
        return jsonify({"success": False, "message": str(exc)}), 400
    except Exception:
        db.session.rollback()
        return jsonify({"success": False, "message": "Could not create category."}), 500


@categories_bp.route("/categories/<int:id>", methods=["DELETE"])
@admin_required
def delete_category(id):
    category = Category.query.get(id)
    if category is None:
        return jsonify({"success": False, "message": "Category not found."}), 404
    try:
        meta = _read_category_images()
        filename = meta.pop(str(id), None)
        db.session.delete(category)
        db.session.commit()
        if filename:
            try: os.remove(os.path.join(current_app.config["UPLOAD_FOLDER"], "categories", filename))
            except OSError: pass
            _write_category_images(meta)
        return jsonify({"success": True, "message": "Category deleted."})
    except Exception:
        db.session.rollback()
        return jsonify({"success": False, "message": "Could not delete category."}), 500
