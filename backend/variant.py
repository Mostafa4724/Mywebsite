"""Product variant storage helpers.

Variants are stored inside the existing Product.tags TEXT column so the
existing database schema is not changed. The visible tags are kept intact and
variant JSON is stored behind a private marker.
"""
import json, os, uuid
from werkzeug.utils import secure_filename

VARIANT_MARKER = "\n__PRODUCT_VARIANTS__="
ALLOWED = {"png", "jpg", "jpeg", "webp"}


def split_tags_and_variants(raw):
    raw = raw or ""
    if VARIANT_MARKER not in raw:
        return raw, []
    tags, payload = raw.split(VARIANT_MARKER, 1)
    try:
        variants = json.loads(payload)
        if not isinstance(variants, list):
            variants = []
    except (TypeError, ValueError, json.JSONDecodeError):
        variants = []
    return tags, variants


def pack_tags_and_variants(tags, variants):
    tags = (tags or "").strip()
    clean=[]
    for v in variants or []:
        if not isinstance(v, dict):
            continue
        clean.append(v)
    return tags + VARIANT_MARKER + json.dumps(clean, separators=(",", ":"))


def _save_variant_image(file_obj, upload_folder):
    if not file_obj or not getattr(file_obj, "filename", ""):
        return ""
    original = secure_filename(file_obj.filename)
    ext = original.rsplit(".",1)[-1].lower() if "." in original else ""
    if ext not in ALLOWED:
        raise ValueError("Variant images must be PNG, JPG or WebP.")
    file_obj.seek(0, os.SEEK_END)
    size=file_obj.tell()
    file_obj.seek(0)
    if size > 5*1024*1024:
        raise ValueError("Each variant image must be 5MB or smaller.")
    name=f"{uuid.uuid4()}_{original}"
    file_obj.save(os.path.join(upload_folder,name))
    return name


def normalize_variants(raw_variants):
    result=[]
    if not isinstance(raw_variants,list):
        return result
    for index,v in enumerate(raw_variants):
        if not isinstance(v,dict):
            continue
        color=str(v.get("color","")).strip()
        if not color:
            continue
        try: stock=max(0,int(v.get("stock",0)))
        except (TypeError,ValueError): stock=0
        sizes=[]
        raw_sizes=v.get("sizes",[])
        if isinstance(raw_sizes,list):
            for s in raw_sizes[:7]:
                if not isinstance(s,dict): continue
                size=str(s.get("size","")).strip()
                if not size: continue
                try: price=float(s.get("price",0))
                except (TypeError,ValueError): price=0
                sizes.append({"size":size,"price":max(0,price)})
        result.append({
            "id": str(v.get("id") or f"variant-{index+1}"),
            "color": color,
            "image": str(v.get("image","") or ""),
            "stock": stock,
            "sizes": sizes,
        })
    return result


def process_variant_request(request, upload_folder, existing=None):
    """Read variant_data and matching variant_image_<id> uploads."""
    raw=request.form.get("variant_data", "[]")
    try: incoming=json.loads(raw)
    except (TypeError,ValueError,json.JSONDecodeError):
        raise ValueError("Invalid variant data.")
    variants=normalize_variants(incoming)
    existing_by_id={str(v.get("id")):v for v in (existing or []) if isinstance(v,dict)}
    for v in variants:
        file_obj=request.files.get(f"variant_image_{v['id']}")
        if file_obj and file_obj.filename:
            v["image"]=_save_variant_image(file_obj,upload_folder)
        elif not v.get("image") and v["id"] in existing_by_id:
            v["image"]=existing_by_id[v["id"]].get("image","") or ""
    return variants
