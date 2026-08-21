import json

from werkzeug.security import (
    check_password_hash,
    generate_password_hash
)

from database import db


class User(db.Model):

    __tablename__ = "users"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    username = db.Column(
        db.String(100),
        unique=True,
        nullable=False
    )

    email = db.Column(
        db.String(150),
        unique=True,
        nullable=False
    )

    password = db.Column(
        db.String(255),
        nullable=False
    )

    # Google Identity Services subject.
    # Nullable so existing password users continue to work.
    google_sub = db.Column(
        db.String(255),
        unique=True,
        nullable=True
    )

    role = db.Column(
        db.String(20),
        nullable=False,
        default="user"
    )

    def check_password(self, password):

        return check_password_hash(
            self.password,
            password
        )

    def to_dict(self):

        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "role": self.role
        }


from datetime import datetime


def _local_datetime_string(value):
    """Serialize a stored naive datetime as local wall-clock ISO text."""
    if value is None:
        return None
    return value.strftime("%Y-%m-%dT%H:%M:%S")


def _product_images(product):
    """Return the product's real image collection with legacy-image fallback."""
    try:
        values = json.loads(product.images or "[]")
    except (TypeError, ValueError, json.JSONDecodeError):
        values = []
    if not isinstance(values, list):
        values = []
    result = []
    seen = set()
    for v in values:
        if not isinstance(v, str) or not v.strip():
            continue
        value = v.strip()
        if value not in seen:
            seen.add(value)
            result.append(value)
    if product.image and product.image not in seen:
        result.insert(0, product.image)
    return result[:5]



class Category(db.Model):

    __tablename__ = "categories"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    name = db.Column(
        db.String(100),
        unique=True,
        nullable=False
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow
    )

    products = db.relationship(
        "Product",
        backref="category_ref",
        lazy=True
    )

    def to_dict(self):

        return {
            "id": self.id,
            "name": self.name,
            "created_at": self.created_at,
            "product_count": len(self.products)
        }


class Product(db.Model):

    __tablename__ = "products"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    # ---------------------------------------------------------
    # Basic Information
    # ---------------------------------------------------------

    title = db.Column(
        db.String(200),
        nullable=False
    )

    description = db.Column(
        db.Text
    )

    brand = db.Column(
        db.String(100)
    )

    category = db.Column(
        db.String(100)
    )

    category_id = db.Column(
        db.Integer,
        db.ForeignKey("categories.id"),
        nullable=True
    )

    # ---------------------------------------------------------
    # Pricing
    # ---------------------------------------------------------

    price = db.Column(
        db.Float,
        nullable=False
    )

    cost = db.Column(
        db.Float,
        default=0
    )

    sale_price = db.Column(
        db.Float
    )

    # ---------------------------------------------------------
    # Inventory
    # ---------------------------------------------------------

    stock = db.Column(
        db.Integer,
        default=0
    )

    low_stock = db.Column(
        db.Integer,
        default=10
    )

    stock_status = db.Column(
        db.String(20),
        default="in"
    )

    # in / low / out

    # ---------------------------------------------------------
    # Tax
    # ---------------------------------------------------------

    tax_class = db.Column(
        db.String(20),
        default="standard"
    )

    # Product-specific tax percentage entered by the administrator.
    tax_rate = db.Column(
        db.Float,
        default=8.0,
        nullable=False
    )

    # ---------------------------------------------------------
    # Main Image
    # ---------------------------------------------------------

    image = db.Column(
        db.String(500)
    )

    # JSON array of up to five product image filenames. ``image`` remains the
    # legacy/main-image field for backward compatibility.
    images = db.Column(
        db.Text
    )

    # ---------------------------------------------------------
    # Publish
    # ---------------------------------------------------------

    status = db.Column(
        db.String(20),
        default="draft"
    )

    # draft / published / scheduled

    scheduled_date = db.Column(
        db.DateTime
    )

    # ---------------------------------------------------------
    # Sale
    # ---------------------------------------------------------

    sale_enabled = db.Column(
        db.Boolean,
        default=False
    )

    sale_start = db.Column(
        db.DateTime
    )

    sale_end = db.Column(
        db.DateTime
    )

    sale_badge = db.Column(
        db.String(50)
    )

    sale_badge_color = db.Column(
        db.String(20)
    )

    # ---------------------------------------------------------
    # Tags
    # ---------------------------------------------------------

    tags = db.Column(
        db.Text
    )

    # ---------------------------------------------------------
    # Dates
    # ---------------------------------------------------------

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow
    )

    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

    variants = db.relationship(
        "ProductVariant",
        backref="product",
        lazy=True,
        cascade="all, delete-orphan",
        order_by="ProductVariant.id",
    )

    reviews = db.relationship(
        "Review",
        backref="product",
        lazy=True,
        cascade="all, delete"
    )

    def to_dict(self):

        return {

            "id": self.id,

            "title": self.title,

            "description": self.description,

            "brand": self.brand,

            "category": self.category,

            "category_id": self.category_id,

            "price": self.price,

            "cost": self.cost,

            "sale_price": self.sale_price,

            "stock": self.stock,

            "low_stock": self.low_stock,

            "stock_status": self.stock_status,

            "tax_class": self.tax_class,
            "tax_rate": float(self.tax_rate if self.tax_rate is not None else 8.0),

            "image": self.image,

            "images": _product_images(self),

            "variants": [
                variant.to_dict()
                for variant in self.variants
            ],

            "status": self.status,

            "scheduled_date": _local_datetime_string(self.scheduled_date),

            "sale_enabled": self.sale_enabled,

            "sale_start": _local_datetime_string(self.sale_start),

            "sale_end": _local_datetime_string(self.sale_end),

            "sale_badge": self.sale_badge,

            "sale_badge_color": self.sale_badge_color,

            "tags": self.tags,

            "created_at": self.created_at,

            "updated_at": self.updated_at,

            "reviews": [
                review.to_dict()
                for review in self.reviews
            ],
        }


class ProductVariant(db.Model):

    __tablename__ = "product_variants"

    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey("products.id"), nullable=False, index=True)
    color = db.Column(db.String(100), nullable=False)
    image = db.Column(db.String(500), nullable=True)
    stock = db.Column(db.Integer, nullable=False, default=0)

    # Optional color-level base price and sale configuration. Size prices remain
    # supported for backwards compatibility and can override this base price.
    price = db.Column(db.Float, nullable=False, default=0)
    sale_enabled = db.Column(db.Boolean, nullable=False, default=False)
    sale_price = db.Column(db.Float, nullable=True)
    sale_start = db.Column(db.DateTime, nullable=True)
    sale_end = db.Column(db.DateTime, nullable=True)

    sizes = db.relationship(
        "VariantSize",
        backref="variant",
        lazy=True,
        cascade="all, delete-orphan",
        order_by="VariantSize.id",
    )

    def to_dict(self):
        return {
            "id": self.id,
            "product_id": self.product_id,
            "color": self.color,
            "image": self.image,
            "stock": max(0, int(self.stock or 0)),
            "price": float(self.price or 0),
            "sale_enabled": bool(self.sale_enabled),
            "sale_price": float(self.sale_price) if self.sale_price is not None else None,
            "sale_start": _local_datetime_string(self.sale_start),
            "sale_end": _local_datetime_string(self.sale_end),
            "sizes": [size.to_dict() for size in self.sizes],
        }


class VariantSize(db.Model):

    __tablename__ = "variant_sizes"

    id = db.Column(db.Integer, primary_key=True)
    variant_id = db.Column(db.Integer, db.ForeignKey("product_variants.id"), nullable=False, index=True)
    size = db.Column(db.String(50), nullable=False)
    price = db.Column(db.Float, nullable=False, default=0)

    def to_dict(self):
        return {
            "id": self.id,
            "variant_id": self.variant_id,
            "size": self.size,
            "price": self.price,
        }


class Review(db.Model):

    __tablename__ = "reviews"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    product_id = db.Column(
        db.Integer,
        db.ForeignKey("products.id"),
        nullable=False
    )

    username = db.Column(
        db.String(100),
        nullable=False
    )

    rating = db.Column(
        db.Integer,
        nullable=False
    )

    comment = db.Column(
        db.Text,
        nullable=False
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow
    )

    def to_dict(self):

        return {

            "id": self.id,

            "product_id": self.product_id,

            "username": self.username,

            "rating": self.rating,

            "comment": self.comment,

            "created_at": (
                self.created_at.strftime(
                    "%Y-%m-%d %H:%M"
                )
                if self.created_at
                else None
            )

        }


class Cart(db.Model):

    __tablename__ = "cart"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    user_id = db.Column(
        db.Integer
    )

    product_id = db.Column(
        db.Integer
    )

    quantity = db.Column(
        db.Integer
    )


class Order(db.Model):

    __tablename__ = "orders"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    user_id = db.Column(
        db.Integer
    )

    # ---------------------------------------------------------
    # Customer / Shipping Snapshot
    # ---------------------------------------------------------

    customer_name = db.Column(
        db.String(200)
    )

    customer_lastname = db.Column(
        db.String(200)
    )

    customer_email = db.Column(
        db.String(150)
    )

    customer_phone = db.Column(
        db.String(100)
    )

    customer_address = db.Column(
        db.String(300)
    )

    customer_architecture = db.Column(
        db.String(200)
    )

    customer_floor = db.Column(
        db.String(100)
    )

    customer_lat = db.Column(
        db.Float
    )

    customer_lng = db.Column(
        db.Float
    )

    # ---------------------------------------------------------
    # Payment
    # ---------------------------------------------------------

    payment_method = db.Column(
        db.String(50),
        default="card"
    )

    payment_status = db.Column(db.String(30), default="pending")
    payment_verified_at = db.Column(db.DateTime, nullable=True)
    payment_verified_by = db.Column(db.Integer, nullable=True)
    revenue_recognized_at = db.Column(db.DateTime, nullable=True)
    revenue_recognized_by = db.Column(db.Integer, nullable=True)

    # ---------------------------------------------------------
    # Pricing
    # ---------------------------------------------------------

    subtotal = db.Column(
        db.Float,
        default=0
    )

    shipping = db.Column(
        db.Float,
        default=0
    )

    tax = db.Column(
        db.Float,
        default=0
    )

    discount = db.Column(
        db.Float,
        default=0
    )

    total = db.Column(
        db.Float,
        default=0
    )

    # ---------------------------------------------------------
    # Order Status
    #
    # placed
    # confirmed
    # processing
    # shipped
    # delivered
    # ---------------------------------------------------------

    status = db.Column(
        db.String(50),
        default="placed"
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow
    )

    items = db.relationship(
        "OrderItem",
        backref="order",
        lazy=True,
        cascade="all, delete-orphan"
    )

    def to_dict(self):

        return {

            "id": self.id,

            "user_id": self.user_id,

            "customer_name": self.customer_name,

            "customer_lastname": self.customer_lastname,

            "customer_email": self.customer_email,

            "customer_phone": self.customer_phone,

            "customer_address": self.customer_address,

            "customer_architecture": self.customer_architecture,

            "customer_floor": self.customer_floor,

            "customer_lat": self.customer_lat,

            "customer_lng": self.customer_lng,

            "payment_method": self.payment_method,
            "payment_status": self.payment_status,
            "payment_verified_at": _local_datetime_string(self.payment_verified_at),
            "payment_verified_by": self.payment_verified_by,
            "revenue_recognized_at": _local_datetime_string(self.revenue_recognized_at),
            "revenue_recognized_by": self.revenue_recognized_by,

            "subtotal": self.subtotal,

            "shipping": self.shipping,

            "tax": self.tax,

            "discount": self.discount,

            "total": self.total,

            "status": self.status,

            "created_at": (
                self.created_at.strftime(
                    "%Y-%m-%d %H:%M:%S"
                )
                if self.created_at
                else None
            ),

            "items": [
                item.to_dict()
                for item in self.items
            ],
        }


class OrderItem(db.Model):

    __tablename__ = "order_items"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    order_id = db.Column(
        db.Integer,
        db.ForeignKey("orders.id"),
        nullable=False
    )

    product_id = db.Column(
        db.Integer
    )

    product_name = db.Column(
        db.String(200)
    )

    variant_id = db.Column(db.Integer, nullable=True)
    color = db.Column(db.String(100), nullable=True)
    size = db.Column(db.String(50), nullable=True)
    variant_image = db.Column(db.String(500), nullable=True)

    # ADD THIS
    image = db.Column(
        db.String(500)
    )

    # JSON array of up to five product image filenames. ``image`` remains the
    # legacy/main-image field for backward compatibility.
    images = db.Column(
        db.Text
    )

    quantity = db.Column(
        db.Integer,
        default=1
    )

    original_price = db.Column(
        db.Float,
        default=0
    )

    sale_price = db.Column(
        db.Float,
        default=0
    )

    unit_price = db.Column(
        db.Float,
        default=0
    )

    discount = db.Column(
        db.Float,
        default=0
    )

    total = db.Column(
        db.Float,
        default=0
    )

    def to_dict(self):

        return {

            "id": self.id,

            "order_id": self.order_id,

            "product_id": self.product_id,

            "product_name": self.product_name,
            "variant_id": self.variant_id,
            "color": self.color,
            "size": self.size,
            "variant_image": self.variant_image,

            # ADD THIS
            "image": self.image,

            "quantity": self.quantity,

            "original_price": self.original_price,

            "sale_price": self.sale_price,

            "unit_price": self.unit_price,

            "discount": self.discount,

            "total": self.total,
        }