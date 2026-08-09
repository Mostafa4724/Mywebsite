from database import db


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)

    username = db.Column(db.String(100), unique=True, nullable=False)

    email = db.Column(db.String(150), unique=True, nullable=False)

    password = db.Column(db.String(255), nullable=False)

    role = db.Column(db.String(20), nullable=False, default="user")


    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "role": self.role
        }

from datetime import datetime
from database import db


class Category(db.Model):
    __tablename__ = "categories"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
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

    id = db.Column(db.Integer, primary_key=True)

    # Basic Information
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    brand = db.Column(db.String(100))
    category = db.Column(db.String(100))
    category_id = db.Column(
        db.Integer,
        db.ForeignKey("categories.id"),
        nullable=True
    )

    # Pricing
    price = db.Column(db.Float, nullable=False)
    cost = db.Column(db.Float, default=0)
    sale_price = db.Column(db.Float)

    # Inventory
    stock = db.Column(db.Integer, default=0)
    low_stock = db.Column(db.Integer, default=10)
    stock_status = db.Column(
        db.String(20),
        default="in"
    )  # in / low / out

    # Tax
    tax_class = db.Column(
        db.String(20),
        default="standard"
    )

    # Main Image
    image = db.Column(db.String(500))

    # Publish
    status = db.Column(
        db.String(20),
        default="draft"
    )  # draft / published / scheduled

    scheduled_date = db.Column(db.DateTime)

    # Sale
    sale_enabled = db.Column(
        db.Boolean,
        default=False
    )

    sale_start = db.Column(db.DateTime)
    sale_end = db.Column(db.DateTime)

    sale_badge = db.Column(db.String(50))
    sale_badge_color = db.Column(db.String(20))

    # Tags
    tags = db.Column(db.Text)

    # Dates
    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow
    )

    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
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

            "image": self.image,

            "status": self.status,
            "scheduled_date": self.scheduled_date,

            "sale_enabled": self.sale_enabled,
            "sale_start": self.sale_start,
            "sale_end": self.sale_end,
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


class Review(db.Model):
    __tablename__ = "reviews"

    id = db.Column(db.Integer, primary_key=True)

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
            "created_at": self.created_at.strftime("%Y-%m-%d %H:%M")

        }


class Cart(db.Model):
    __tablename__ = "cart"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer)
    product_id = db.Column(db.Integer)
    quantity = db.Column(db.Integer)


class Order(db.Model):
    __tablename__ = "orders"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer)
    total = db.Column(db.Float)
    status = db.Column(db.String(50))
    payment = db.Column(db.String(50))


class OrderItem(db.Model):
    __tablename__ = "order_items"

    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer)
    product_id = db.Column(db.Integer)
    quantity = db.Column(db.Integer)
    price = db.Column(db.Float)