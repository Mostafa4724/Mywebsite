from flask import Blueprint, request, jsonify, current_app, send_from_directory

from models import Category, Product
from database import db
from security import admin_required
from werkzeug.utils import secure_filename
import os, json, uuid


categories_bp = Blueprint("categories", __name__)

CATEGORY_IMAGE_META = os.path.join(os.path.dirname(__file__), "category_images.json")
ALLOWED_IMAGE_EXTENSIONS = {"png", "jpg", "jpeg", "webp", "gif"}
DEFAULT_FALLBACK_CATEGORY = "Others"

def _images():
    try:
        with open(CATEGORY_IMAGE_META, "r", encoding="utf-8") as f:
            value = json.load(f)
            return value if isinstance(value, dict) else {}
    except (FileNotFoundError, json.JSONDecodeError):
        return {}

def _save_images(value):
    with open(CATEGORY_IMAGE_META, "w", encoding="utf-8") as f:
        json.dump(value, f, ensure_ascii=False, indent=2)

def _category_dict(category):
    data = category.to_dict()
    filename = _images().get(str(category.id))
    data["image"] = filename
    data["image_url"] = "/uploads/categories/" + filename if filename else None
    return data



@categories_bp.route("/categories", methods=["GET"])
def get_categories():
    """Return all categories (public)."""
    categories = Category.query.order_by(Category.name).all()

    return jsonify({
        "success": True,
        "categories": [
            _category_dict(category)
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
        "category": _category_dict(category)
    })


@categories_bp.route("/categories", methods=["POST"])
@admin_required
def create_category():
    # Accept multipart/form-data for name + image, while still accepting JSON
    # for compatibility with the existing Add Product code.
    if request.content_type and request.content_type.startswith("multipart/form-data"):
        name = (request.form.get("name") or "").strip()
        image_file = request.files.get("image")
    else:
        data = request.get_json(silent=True) or {}
        name = (data.get("name") or "").strip()
        image_file = None

    if not name:
        return jsonify(success=False, message="Category name is required."), 400
    if len(name) > 100:
        return jsonify(success=False, message="Category name is too long (max 100 characters)."), 400
    if Category.query.filter(db.func.lower(Category.name) == name.lower()).first():
        return jsonify(success=False, message="Category already exists."), 409

    saved_filename = None
    try:
        category = Category(name=name)
        db.session.add(category)
        db.session.flush()

        if image_file and image_file.filename:
            original = secure_filename(image_file.filename)
            ext = original.rsplit(".", 1)[1].lower() if "." in original else ""
            if ext not in ALLOWED_IMAGE_EXTENSIONS:
                db.session.rollback()
                return jsonify(success=False, message="Unsupported image type. Use PNG, JPG, JPEG, WEBP, or GIF."), 400
            folder = os.path.join(current_app.config["UPLOAD_FOLDER"], "categories")
            os.makedirs(folder, exist_ok=True)
            saved_filename = f"category_{category.id}_{uuid.uuid4().hex}.{ext}"
            image_file.save(os.path.join(folder, saved_filename))

        db.session.commit()
        if saved_filename:
            meta = _images(); meta[str(category.id)] = saved_filename; _save_images(meta)

        return jsonify(success=True, message="Category created.", category=_category_dict(category)), 201
    except Exception:
        db.session.rollback()
        if saved_filename:
            try: os.remove(os.path.join(current_app.config["UPLOAD_FOLDER"], "categories", saved_filename))
            except OSError: pass
        return jsonify(success=False, message="Could not create category."), 500


@categories_bp.route("/categories/<int:id>", methods=["DELETE"])
@admin_required
def delete_category(id):
    """
    Delete a category safely.

    Every product that belongs to the deleted category is moved to the
    permanent "Others" category. Both category_id and the legacy category
    text field are updated so product pages cannot keep displaying the
    deleted category.
    """
    category = Category.query.get(id)

    if category is None:
        return jsonify(
            success=False,
            message="Category not found."
        ), 404

    category_name = (category.name or "").strip()

    # "Others" is the permanent fallback category.
    if category_name.casefold() == DEFAULT_FALLBACK_CATEGORY.casefold():
        return jsonify(
            success=False,
            message="The Others category cannot be deleted."
        ), 400

    try:
        # Always use a real database category as the fallback.
        others = Category.query.filter(
            db.func.lower(Category.name)
            == DEFAULT_FALLBACK_CATEGORY.lower()
        ).first()

        if others is None:
            others = Category(name=DEFAULT_FALLBACK_CATEGORY)
            db.session.add(others)
            db.session.flush()

        # Move products that use the category relation OR the legacy text
        # field. This covers old products created before category_id existed.
        products = Product.query.filter(
            db.or_(
                Product.category_id == category.id,
                db.func.lower(Product.category) == category_name.lower()
            )
        ).all()

        moved_products = 0

        for product in products:
            product.category_id = others.id
            product.category = others.name
            moved_products += 1

        # Remove category image metadata.
        meta = _images()
        filename = meta.pop(str(id), None)

        # Delete the category only after every product reference has been
        # redirected to Others.
        db.session.delete(category)

        # This commit contains the category deletion AND all product updates.
        db.session.commit()

        # Clean up the deleted category's image after the DB transaction
        # succeeds.
        if filename:
            try:
                os.remove(
                    os.path.join(
                        current_app.config["UPLOAD_FOLDER"],
                        "categories",
                        filename
                    )
                )
            except OSError:
                current_app.logger.warning(
                    "Could not remove category image: %s",
                    filename
                )

        try:
            _save_images(meta)
        except OSError:
            current_app.logger.exception(
                "Could not update category image metadata after deleting %s",
                category_name
            )

        return jsonify(
            success=True,
            message=(
                f'Category "{category_name}" deleted successfully. '
                f"{moved_products} product(s) moved to Others."
            ),
            moved_products=moved_products,
            fallback_category={
                "id": others.id,
                "name": others.name
            }
        )

    except Exception:
        db.session.rollback()
        current_app.logger.exception(
            "Failed to delete category id=%s",
            id
        )

        return jsonify(
            success=False,
            message="Could not delete category."
        ), 500
