
"""Single source of truth for sale dates, pricing and timezone handling."""

from datetime import datetime
from zoneinfo import ZoneInfo

STORE_TIMEZONE = ZoneInfo("Africa/Cairo")


def now_store():
    return datetime.now(STORE_TIMEZONE)


def parse_store_datetime(value, field_name="date/time"):
    if value in (None, ""):
        return None
    raw = str(value).strip()
    try:
        dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError(f"Invalid {field_name}. Use YYYY-MM-DDTHH:MM.") from exc

    if dt.tzinfo is None:
        # datetime-local values are store-local wall-clock time.
        return dt
    return dt.astimezone(STORE_TIMEZONE).replace(tzinfo=None)


def as_store_iso(value):
    if value is None:
        return None
    if value.tzinfo is not None:
        local = value.astimezone(STORE_TIMEZONE)
    else:
        local = value.replace(tzinfo=STORE_TIMEZONE)
    return local.isoformat(timespec="seconds")


def sale_is_active(product, now=None):
    if product is None or not bool(getattr(product, "sale_enabled", False)):
        return False

    try:
        regular = float(product.price or 0)
        sale = float(product.sale_price or 0)
    except (TypeError, ValueError):
        return False

    if not (sale > 0 and regular > sale):
        return False

    current = now or now_store()
    if current.tzinfo is None:
        current = current.replace(tzinfo=STORE_TIMEZONE)

    start = getattr(product, "sale_start", None)
    end = getattr(product, "sale_end", None)

    if start is not None:
        start_aware = start.replace(tzinfo=STORE_TIMEZONE) if start.tzinfo is None else start.astimezone(STORE_TIMEZONE)
        if current < start_aware:
            return False

    if end is not None:
        end_aware = end.replace(tzinfo=STORE_TIMEZONE) if end.tzinfo is None else end.astimezone(STORE_TIMEZONE)
        if current > end_aware:
            return False

    return True


def current_price(product):
    regular = float(product.price or 0)
    if sale_is_active(product):
        return float(product.sale_price)
    return regular


def sale_state(product):
    active = sale_is_active(product)
    return {
        "sale_active": active,
        "current_price": current_price(product),
    }


def variant_sale_is_active(variant, now=None):
    """Return whether a color variant's own sale is currently active."""
    if variant is None or not bool(getattr(variant, "sale_enabled", False)):
        return False
    try:
        regular = float(getattr(variant, "price", 0) or 0)
        sale = float(getattr(variant, "sale_price", 0) or 0)
    except (TypeError, ValueError):
        return False
    if not (sale > 0 and regular > sale):
        return False
    current = now or now_store()
    if current.tzinfo is None:
        current = current.replace(tzinfo=STORE_TIMEZONE)
    start = getattr(variant, "sale_start", None)
    end = getattr(variant, "sale_end", None)
    if start is not None:
        start = start.replace(tzinfo=STORE_TIMEZONE) if start.tzinfo is None else start.astimezone(STORE_TIMEZONE)
        if current < start:
            return False
    if end is not None:
        end = end.replace(tzinfo=STORE_TIMEZONE) if end.tzinfo is None else end.astimezone(STORE_TIMEZONE)
        if current > end:
            return False
    return True


def variant_current_price(variant, size=None):
    """Resolve a color/size price, applying the variant sale when active."""
    if variant is None:
        return 0.0
    base = float(getattr(variant, "price", 0) or 0)
    if size is not None:
        size_price = getattr(size, "price", None)
        if size_price is not None and float(size_price or 0) > 0:
            base = float(size_price)
    if variant_sale_is_active(variant):
        sale = float(getattr(variant, "sale_price", 0) or 0)
        return sale
    return base
