
import json
import os
import uuid
import hashlib
from datetime import datetime
from pathlib import Path

from flask import Blueprint, request, jsonify, current_app
from werkzeug.utils import secure_filename

from database import db
from models import Product, Category, Review, ProductVariant, VariantSize
from security import admin_required
from sales import parse_store_datetime, as_store_iso, sale_is_active, current_price

products_bp = Blueprint("products", __name__)

ALLOWED_IMAGE_TYPES = {"png", "jpg", "jpeg", "webp"}
MAX_PRODUCT_IMAGES = 5
MAX_IMAGE_BYTES = 5 * 1024 * 1024


def _parse_bool(value):
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    if isinstance(value, (int, float)):
        return bool(value)
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def _resolve_category(category_id, category_name):
    if category_id not in (None, "", "null"):
        try:
            category = Category.query.get(int(category_id))
        except (TypeError, ValueError):
            category = None
        if category:
            return category
    if category_name:
        return Category.query.filter(
            db.func.lower(Category.name) == category_name.strip().lower()
        ).first()
    return None


def _save_image(file_obj):
    if not file_obj or not getattr(file_obj, "filename", ""):
        return ""
    filename = secure_filename(file_obj.filename)
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ALLOWED_IMAGE_TYPES:
        raise ValueError("Images must be PNG, JPG or WebP.")
    file_obj.seek(0, os.SEEK_END)
    size = file_obj.tell()
    file_obj.seek(0)
    if size > MAX_IMAGE_BYTES:
        raise ValueError("Each image must be 5MB or smaller.")
    stored = f"{uuid.uuid4()}_{filename}"
    file_obj.save(os.path.join(current_app.config["UPLOAD_FOLDER"], stored))
    return stored


def _parse_image_json(raw):
    try:
        values = json.loads(raw or "[]")
        if not isinstance(values, list):
            return []
    except (TypeError, ValueError, json.JSONDecodeError):
        return []
    result = []
    seen = set()
    for v in values:
        if not isinstance(v, str) or not v.strip():
            continue
        value = v.strip()
        if value in seen:
            continue
        seen.add(value)
        result.append(value)
    return result


def _collect_product_images(request, existing=None):
    """Build the final image list for add/edit, max five, without data loss."""
    existing = [x for x in (existing or []) if isinstance(x, str) and x.strip()]
    keep = _parse_image_json(request.form.get("existing_images"))
    if "existing_images" not in request.form:
        keep = existing
    keep = [x for x in keep if x in existing]
    new_files = [f for f in request.files.getlist("images") if f and f.filename]
    # Backward-compatible single-image field.
    single = request.files.get("image")
    if single and single.filename and all(single is not f for f in new_files):
        new_files.insert(0, single)

    if len(keep) + len(new_files) > MAX_PRODUCT_IMAGES:
        raise ValueError(f"A product can have a maximum of {MAX_PRODUCT_IMAGES} images.")

    result = list(dict.fromkeys(keep))
    hashes = set()
    upload_dir = current_app.config["UPLOAD_FOLDER"]
    for name in result:
        path = os.path.join(upload_dir, name)
        if os.path.isfile(path):
            try:
                hashes.add(hashlib.sha256(Path(path).read_bytes()).hexdigest())
            except Exception:
                pass
    for file_obj in new_files:
        file_obj.seek(0)
        digest = hashlib.sha256(file_obj.read()).hexdigest()
        file_obj.seek(0)
        if digest in hashes:
            continue
        if len(result) >= MAX_PRODUCT_IMAGES:
            break
        result.append(_save_image(file_obj))
        hashes.add(digest)
    return list(dict.fromkeys(result))[:MAX_PRODUCT_IMAGES]


def _parse_variant_payload(raw):
    try:
        data = json.loads(raw or "[]")
    except (TypeError, ValueError, json.JSONDecodeError) as exc:
        raise ValueError("Invalid variant data.") from exc
    if not isinstance(data, list):
        raise ValueError("Variant data must be an array.")
    if len(data) > 50:
        raise ValueError("A product cannot have more than 50 color variants.")

    result = []
    seen_colors = set()
    for index, item in enumerate(data):
        if not isinstance(item, dict):
            continue
        color = str(item.get("color") or "").strip()
        if not color:
            raise ValueError(f"Variant {index + 1} needs a color name.")
        color_key = color.casefold()
        if color_key in seen_colors:
            raise ValueError(f"Duplicate color variant: {color}.")
        seen_colors.add(color_key)

        try:
            stock = int(item.get("stock", 0))
        except (TypeError, ValueError) as exc:
            raise ValueError(f"Invalid stock for {color}.") from exc
        if stock < 0:
            raise ValueError(f"Stock cannot be negative for {color}.")

        sizes = item.get("sizes") or []
        if not isinstance(sizes, list) or len(sizes) > 7:
            raise ValueError(f"{color} can have 1 to 7 sizes.")
        if not sizes:
            raise ValueError(f"{color} must have at least one size.")

        clean_sizes = []
        seen_sizes = set()
        for s in sizes:
            if not isinstance(s, dict):
                continue
            size = str(s.get("size") or "").strip()
            if not size:
                raise ValueError(f"A size is missing for {color}.")
            key = size.casefold()
            if key in seen_sizes:
                raise ValueError(f"Duplicate size {size} for {color}.")
            seen_sizes.add(key)
            try:
                price = float(s.get("price"))
            except (TypeError, ValueError) as exc:
                raise ValueError(f"Invalid price for {color} / {size}.") from exc
            if price < 0:
                raise ValueError(f"Price cannot be negative for {color} / {size}.")
            clean_sizes.append({"id": s.get("id"), "size": size, "price": price})

        try:
            color_price = float(item.get("price")) if item.get("price") not in (None, "") else float(clean_sizes[0]["price"])
        except (TypeError, ValueError) as exc:
            raise ValueError(f"Invalid base price for {color}.") from exc
        if color_price < 0:
            raise ValueError(f"Price cannot be negative for {color}.")
        sale_enabled = _parse_bool(item.get("sale_enabled"))
        sale_price = None
        if sale_enabled:
            try:
                sale_price = float(item.get("sale_price"))
            except (TypeError, ValueError) as exc:
                raise ValueError(f"Sale price is required for {color}.") from exc
            if sale_price <= 0 or sale_price >= color_price:
                raise ValueError(f"Sale price for {color} must be lower than its price.")
        sale_start = parse_store_datetime(item.get("sale_start"), f"{color} sale start") if item.get("sale_start") else None
        sale_end = parse_store_datetime(item.get("sale_end"), f"{color} sale end") if item.get("sale_end") else None
        if sale_start and sale_end and sale_end <= sale_start:
            raise ValueError(f"Sale end must be after sale start for {color}.")

        result.append({
            "id": str(item.get("id") or f"new-{uuid.uuid4()}"),
            "color": color,
            "image": str(item.get("image") or ""),
            "stock": stock,
            "price": color_price,
            "sale_enabled": sale_enabled,
            "sale_price": sale_price,
            "sale_start": sale_start,
            "sale_end": sale_end,
            "sizes": clean_sizes,
        })
    return result


def _apply_variants(product, payload):
    """Replace the product's variant graph atomically with the submitted graph."""
    existing = {str(v.id): v for v in product.variants}
    incoming_ids = set()

    for index, item in enumerate(payload):
        # Defensive validation: never allow an invalid variant to reach SQLite.
        # _parse_variant_payload() normally guarantees this, but keep the
        # persistence layer safe in case another caller constructs the payload.
        color = str(item.get("color") or "").strip()
        if not color:
            raise ValueError(f"Variant {index + 1} needs a color name.")
        sizes = item.get("sizes") or []
        if not isinstance(sizes, list) or not sizes:
            raise ValueError(f"{color} must have at least one size.")

        variant_id = str(item.get("id") or "")
        db_variant = existing.get(variant_id) if variant_id.isdigit() else None

        # IMPORTANT: populate every NOT NULL column before the first flush.
        # The previous implementation flushed a brand-new ProductVariant
        # immediately after setting only product_id. SQLite then rejected it
        # because product_variants.color is NOT NULL.
        if db_variant is None:
            db_variant = ProductVariant(
                product_id=product.id,
                color=color,
                stock=max(0, int(item.get("stock", 0) or 0)),
                price=float(item.get("price") or 0),
                sale_enabled=bool(item.get("sale_enabled")),
                sale_price=item.get("sale_price"),
                sale_start=item.get("sale_start"),
                sale_end=item.get("sale_end"),
            )
            db.session.add(db_variant)
        else:
            db_variant.color = color
            db_variant.stock = max(0, int(item.get("stock", 0) or 0))
            db_variant.price = float(item.get("price") or 0)
            db_variant.sale_enabled = bool(item.get("sale_enabled"))
            db_variant.sale_price = item.get("sale_price")
            db_variant.sale_start = item.get("sale_start")
            db_variant.sale_end = item.get("sale_end")

        image = item.get("image") or ""
        upload = request.files.get(f"variant_image_{variant_id}")
        if upload and upload.filename:
            image = _save_image(upload)
        elif not image and db_variant.image:
            image = db_variant.image
        db_variant.image = image or None

        # Flush only after all required fields have been populated. This also
        # gives a new variant its database id before creating VariantSize rows.
        db.session.flush()
        incoming_ids.add(db_variant.id)

        # Replace sizes for this color group. This prevents stale prices/sizes
        # from surviving an edit while preserving the variant itself when kept.
        for old_size in list(db_variant.sizes):
            db.session.delete(old_size)
        db.session.flush()
        for size in item["sizes"]:
            db.session.add(
                VariantSize(
                    variant_id=db_variant.id,
                    size=size["size"],
                    price=size["price"],
                )
            )

    for old in list(product.variants):
        if old.id not in incoming_ids:
            db.session.delete(old)


def _set_product_stock_status(product):
    stock = max(0, int(product.stock or 0))
    threshold = max(0, int(product.low_stock or 0))
    product.stock = stock
    if stock == 0:
        product.stock_status = "out"
    elif stock <= threshold:
        product.stock_status = "low"
    else:
        product.stock_status = "in"


def _validate_sale(data, price, current=None):
    enabled = _parse_bool(data.get("sale_enabled", getattr(current, "sale_enabled", False)))
    if not enabled:
        return False, None, None

    raw_sale = data.get("sale_price")
    if raw_sale in (None, ""):
        raw_sale = getattr(current, "sale_price", None)
    try:
        sale_price = float(raw_sale)
    except (TypeError, ValueError):
        raise ValueError("Sale price is required when sale is enabled.")
    if sale_price <= 0 or sale_price >= price:
        raise ValueError("Sale price must be greater than 0 and lower than the regular price.")

    if "sale_start" in data:
        start = parse_store_datetime(data.get("sale_start"), "sale start")
    else:
        start = getattr(current, "sale_start", None) if current else None

    if "sale_end" in data:
        end = parse_store_datetime(data.get("sale_end"), "sale end")
    else:
        end = getattr(current, "sale_end", None) if current else None
    if start and end and end <= start:
        raise ValueError("Sale end must be after sale start.")
    return True, sale_price, (start, end)


def _serialize_product(product):
    data = product.to_dict()

    # category_id is the authoritative relationship. The legacy `category`
    # text is kept for compatibility, but API consumers should always receive
    # the current category name when the relationship exists.
    if product.category_ref is not None:
        data["category"] = product.category_ref.name
        data["category_id"] = product.category_ref.id
    elif product.category_id is None and not str(product.category or "").strip():
        data["category"] = "Others"

    data["sale_active"] = sale_is_active(product)
    data["current_price"] = current_price(product)
    data["sale_start"] = as_store_iso(product.sale_start)
    data["sale_end"] = as_store_iso(product.sale_end)
    # Recalculate stock state from authoritative values.
    if product.variants:
        variant_stock = sum(max(0, int(v.stock or 0)) for v in product.variants)
        data["variant_stock"] = variant_stock
    return data


@products_bp.route("/products", methods=["GET"])
def get_products():
    category_id = request.args.get("category_id", type=int)
    query = Product.query
    if category_id:
        query = query.filter(Product.category_id == category_id)
    products = query.all()
    return jsonify({"success": True, "products": [_serialize_product(p) for p in products]})


@products_bp.route("/products/<int:id>", methods=["GET"])
def get_product(id):
    product = Product.query.get(id)
    if product is None:
        return jsonify({"success": False, "message": "Product not found"}), 404
    return jsonify({"success": True, "product": _serialize_product(product)})


@products_bp.route("/admin/products", methods=["POST"])
@admin_required
def add_product():
    data = request.form
    try:
        price = float(data.get("price", 0))
        cost = float(data.get("cost", 0))
        stock = int(data.get("stock", 0))
        low_stock = int(data.get("low_stock", 10))
        tax_rate = float(data.get("tax_rate", 8.0) or 0)
    except (TypeError, ValueError):
        return jsonify(success=False, message="Price, cost, stock and low-stock threshold must be valid numbers."), 400
    if min(price, cost, stock, low_stock) < 0:
        return jsonify(success=False, message="Price, cost, stock and low-stock threshold cannot be negative."), 400
    if not 0 <= tax_rate <= 100:
        return jsonify(success=False, message="Tax rate must be between 0 and 100."), 400

    category = _resolve_category(data.get("category_id"), data.get("category"))
    if not category:
        return jsonify(success=False, message="Please select a valid category."), 400

    try:
        sale_enabled, sale_price, sale_dates = _validate_sale(data, price)
        images = _collect_product_images(request, [])
        variants = _parse_variant_payload(data.get("variant_data", "[]"))
    except ValueError as exc:
        return jsonify(success=False, message=str(exc)), 400

    status = str(data.get("status", "draft") or "draft").strip().lower()
    if status not in {"draft", "published"}:
        return jsonify(success=False, message="Invalid publish status. Use Draft or Published."), 400

    product = Product(
        title=(data.get("title") or "").strip(),
        description=(data.get("description") or "").strip(),
        brand=(data.get("brand") or "").strip(),
        category=category.name,
        category_id=category.id,
        price=price,
        cost=cost,
        sale_price=sale_price,
        stock=stock,
        low_stock=low_stock,
        tax_class=data.get("tax_class", "standard"),
        tax_rate=tax_rate,
        image=images[0] if images else "",
        images=json.dumps(images),
        status=status,
        sale_enabled=sale_enabled,
        sale_start=sale_dates[0] if sale_dates else None,
        sale_end=sale_dates[1] if sale_dates else None,
        sale_badge=(data.get("sale_badge") or "").strip() or None,
        sale_badge_color=(data.get("sale_badge_color") or "").strip() or None,
        tags=(data.get("tags") or "").strip(),
    )
    _set_product_stock_status(product)
    db.session.add(product)
    db.session.flush()

    try:
        _apply_variants(product, variants)
        # Color variants are authoritative for inventory when present.
        if variants:
            product.stock = sum(max(0, int(v.get("stock", 0) or 0)) for v in variants)
            _set_product_stock_status(product)
        db.session.commit()
    except ValueError as exc:
        db.session.rollback()
        return jsonify(success=False, message=str(exc)), 400
    except Exception:
        db.session.rollback()
        raise

    return jsonify(success=True, message="Product added", product=_serialize_product(product)), 201


@products_bp.route("/admin/products/<int:id>", methods=["PUT", "POST"])
@admin_required
def edit_product(id):
    product = Product.query.get(id)
    if product is None:
        return jsonify(success=False, message="Product not found"), 404

    data = request.form
    try:
        price = float(data.get("price", product.price))
        cost = float(data.get("cost", product.cost or 0))
        stock = int(data.get("stock", product.stock or 0))
        low_stock = int(data.get("low_stock", product.low_stock if product.low_stock is not None else 10))
        tax_rate = float(data.get("tax_rate", product.tax_rate if product.tax_rate is not None else 8.0) or 0)
    except (TypeError, ValueError):
        return jsonify(success=False, message="Price, cost, stock and low-stock threshold must be valid numbers."), 400
    if min(price, cost, stock, low_stock) < 0:
        return jsonify(success=False, message="Price, cost, stock and low-stock threshold cannot be negative."), 400
    if not 0 <= tax_rate <= 100:
        return jsonify(success=False, message="Tax rate must be between 0 and 100."), 400

    category = _resolve_category(data.get("category_id"), data.get("category"))
    if not category:
        return jsonify(success=False, message="Selected category does not exist."), 400

    try:
        sale_enabled, sale_price, sale_dates = _validate_sale(data, price, product)
        existing_images = _parse_image_json(product.images)
        if product.image and product.image not in existing_images:
            existing_images.insert(0, product.image)
        images = _collect_product_images(request, existing_images)
        variants = _parse_variant_payload(data.get("variant_data", "[]"))
    except ValueError as exc:
        return jsonify(success=False, message=str(exc)), 400

    status = str(data.get("status", product.status or "draft")).strip().lower()
    if status not in {"draft", "published"}:
        return jsonify(success=False, message="Invalid publish status. Use Draft or Published."), 400

    product.title = (data.get("title", product.title) or "").strip()
    product.description = (data.get("description", product.description) or "").strip()
    product.brand = (data.get("brand", product.brand) or "").strip()
    product.category = category.name
    product.category_id = category.id
    product.price = price
    product.cost = cost
    product.stock = stock
    product.low_stock = low_stock
    product.tax_class = data.get("tax_class", product.tax_class or "standard")
    product.tax_rate = tax_rate
    product.status = status
    product.sale_enabled = sale_enabled
    product.sale_price = sale_price
    product.sale_start = sale_dates[0] if sale_dates else None
    product.sale_end = sale_dates[1] if sale_dates else None
    product.sale_badge = (data.get("sale_badge", product.sale_badge) or "").strip() or None
    product.sale_badge_color = (data.get("sale_badge_color", product.sale_badge_color) or "").strip() or None
    product.tags = (data.get("tags", product.tags) or "").strip()
    product.images = json.dumps(images)
    product.image = images[0] if images else ""

    try:
        _apply_variants(product, variants)
        # For variant products, the product-level stock is the aggregate color stock.
        if variants:
            product.stock = sum(v["stock"] for v in variants)
        _set_product_stock_status(product)
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise

    return jsonify(success=True, message="Product updated", product=_serialize_product(product))


@products_bp.route("/admin/products/<int:id>", methods=["DELETE"])
@admin_required
def delete_product(id):
    product = Product.query.get(id)
    if product is None:
        return jsonify(success=False, message="Product not found"), 404
    db.session.delete(product)
    db.session.commit()
    return jsonify(success=True, message="Product deleted")


@products_bp.route("/products/<int:id>/reviews", methods=["POST"])
def add_review(id):
    product = Product.query.get(id)
    if product is None:
        return jsonify(success=False, message="Product not found"), 404
    data = request.get_json(silent=True) or {}
    try:
        rating = int(data["rating"])
    except (KeyError, TypeError, ValueError):
        return jsonify(success=False, message="Rating must be an integer."), 400
    if rating < 1 or rating > 5:
        return jsonify(success=False, message="Rating must be between 1 and 5."), 400
    review = Review(
        product_id=id,
        username=data.get("username", "Anonymous"),
        rating=rating,
        comment=data.get("comment", ""),
    )
    db.session.add(review)
    db.session.commit()
    return jsonify(success=True, review=review.to_dict())


@products_bp.route("/products/<int:id>/reviews", methods=["GET"])
def get_reviews(id):
    reviews = Review.query.filter_by(product_id=id).order_by(Review.created_at.desc()).all()
    return jsonify(success=True, reviews=[review.to_dict() for review in reviews])
