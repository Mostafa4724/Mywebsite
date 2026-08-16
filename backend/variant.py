"""
Variant storage/validation helpers.

Database compatibility:
- No new database table or column is required.
- Variant data is stored inside the existing products.tags TEXT column as JSON:
  {"tags": ["tag1", ...], "variants": [...]}
- Legacy comma-separated tags remain readable.
"""
import json
import os
import uuid
from werkzeug.utils import secure_filename


def _clean_tags(value):
    if isinstance(value, list):
        return [str(x).strip() for x in value if str(x).strip()]
    if not value:
        return []
    try:
        obj = json.loads(value)
        if isinstance(obj, dict) and isinstance(obj.get("tags"), list):
            return [str(x).strip() for x in obj["tags"] if str(x).strip()]
        if isinstance(obj, list):
            return [str(x).strip() for x in obj if str(x).strip()]
    except Exception:
        pass
    return [x.strip() for x in str(value).split(",") if x.strip()]


def unpack_variant_data(raw):
    """Return (normal_tags, variants) from legacy or variant-aware tags data."""
    if not raw:
        return [], []
    try:
        obj = json.loads(raw)
        if isinstance(obj, dict):
            tags = _clean_tags(obj.get("tags", []))
            variants = obj.get("variants", [])
            return tags, normalize_variants(variants)
    except Exception:
        pass
    return _clean_tags(raw), []


def pack_variant_data(tags, variants):
    tags = _clean_tags(tags)
    variants = normalize_variants(variants)
    if not variants:
        return ",".join(tags)
    return json.dumps({"tags": tags, "variants": variants}, separators=(",", ":"))


def normalize_variants(variants):
    if not isinstance(variants, list):
        return []
    result = []
    for idx, v in enumerate(variants):
        if not isinstance(v, dict):
            continue
        color = str(v.get("color", "")).strip()
        if not color:
            continue
        sizes = []
        for size in v.get("sizes", []) if isinstance(v.get("sizes"), list) else []:
            if not isinstance(size, dict):
                continue
            name = str(size.get("size", "")).strip()
            if not name:
                continue
            try:
                price = float(size.get("price", 0))
            except (TypeError, ValueError):
                price = 0
            sizes.append({"size": name, "price": round(max(0, price), 2)})
        try:
            stock = int(v.get("stock", 0))
        except (TypeError, ValueError):
            stock = 0
        result.append({
            "id": str(v.get("id") or uuid.uuid4().hex[:12]),
            "color": color,
            "image": str(v.get("image", "") or ""),
            "stock": max(0, stock),
            "sizes": sizes[:7],
        })
    return result


def get_variants(product):
    _, variants = unpack_variant_data(getattr(product, "tags", "") or "")
    return variants


def set_variants_on_product(product, variants):
    tags, _ = unpack_variant_data(getattr(product, "tags", "") or "")
    product.tags = pack_variant_data(tags, variants)


def find_variant(variants, variant_id=None, color=None):
    if not isinstance(variants, list):
        return None
    if variant_id:
        for v in variants:
            if str(v.get("id")) == str(variant_id):
                return v
    if color:
        wanted = str(color).strip().lower()
        for v in variants:
            if str(v.get("color", "")).strip().lower() == wanted:
                return v
    return None


def find_size(variant, size):
    if not variant:
        return None
    wanted = str(size or "").strip().lower()
    for s in variant.get("sizes", []):
        if str(s.get("size", "")).strip().lower() == wanted:
            return s
    return None


def save_variant_images(request, variants, upload_folder, field_prefix="variant_image_"):
    """
    Save uploaded variant images referenced by image_key.
    The frontend sends files under variant_image_0, variant_image_1, ...
    """
    for v in variants:
        key = v.get("image_key")
        if not key:
            continue
        f = request.files.get(str(key))
        if not f or not f.filename:
            v.pop("image_key", None)
            continue
        filename = secure_filename(f.filename)
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        if ext not in {"png", "jpg", "jpeg", "webp"}:
            raise ValueError("Variant images must be PNG, JPG or WebP.")
        f.seek(0, os.SEEK_END)
        size = f.tell()
        f.seek(0)
        if size > 5 * 1024 * 1024:
            raise ValueError("Each variant image must be 5MB or smaller.")
        stored = f"{uuid.uuid4()}_{filename}"
        f.save(os.path.join(upload_folder, stored))
        v["image"] = stored
        v.pop("image_key", None)
    return variants
