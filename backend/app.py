import os
import sqlite3
import json

from flask import Flask, jsonify, send_from_directory, request
from flask_cors import CORS

from flask_jwt_extended import (
    JWTManager,
    create_access_token,
    jwt_required,
    get_jwt_identity,
)

from werkzeug.security import generate_password_hash

from products import products_bp
from orders import orders_bp
from auth import auth_bp
from categories import categories_bp

from database import db
from models import User, Product, ProductVariant, VariantSize
from config import Config
from security import admin_required
from datetime import datetime, timedelta


# ============================================================
# Environment / Secrets
# ============================================================

SECRET_KEY = os.environ.get("SECRET_KEY")
JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY")

if not SECRET_KEY or not JWT_SECRET_KEY:
    raise RuntimeError(
        "SECRET_KEY and JWT_SECRET_KEY environment variables are required"
    )


# ============================================================
# Flask App
# ============================================================

app = Flask(__name__)

app.config.from_object(Config)

CORS(app)


# ============================================================
# Paths
# ============================================================

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

DATABASE_PATH = os.path.join(
    BASE_DIR,
    "..",
    "database",
    "shopping.db",
)

UPLOAD_FOLDER = os.path.join(
    BASE_DIR,
    "uploads",
    "products",
)

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
print("Upload folder:", UPLOAD_FOLDER)
print("Is writable?", os.access(UPLOAD_FOLDER, os.W_OK))


# ============================================================
# Database Configuration
# ============================================================

app.config["SQLALCHEMY_DATABASE_URI"] = (
    f"sqlite:///{DATABASE_PATH}"
)

app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER


# ============================================================
# Initialize Extensions
# ============================================================

db.init_app(app)


def ensure_schema_compatibility():
    """Safely add columns introduced by newer application versions.

    This migration is additive only: it never drops tables or existing data.
    It is intentionally SQLite-friendly for the local development database.
    """
    columns_by_table = {
        "products": {
            "tax_rate": "FLOAT NOT NULL DEFAULT 8.0",
        },
        "product_variants": {
            "price": "FLOAT NOT NULL DEFAULT 0",
            "sale_enabled": "BOOLEAN NOT NULL DEFAULT 0",
            "sale_price": "FLOAT",
            "sale_start": "DATETIME",
            "sale_end": "DATETIME",
        },
    }
    with db.engine.begin() as conn:
        for table, columns in columns_by_table.items():
            rows = conn.exec_driver_sql(f"PRAGMA table_info({table})").fetchall()
            existing = {row[1] for row in rows}
            if not rows:
                continue
            for column, definition in columns.items():
                if column not in existing:
                    conn.exec_driver_sql(
                        f"ALTER TABLE {table} ADD COLUMN {column} {definition}"
                    )


jwt = JWTManager(app)


# ============================================================
# Import Models
# ============================================================

# Import after db.init_app()
from models import (
    User,
    Product,
    Cart,
    Order,
    OrderItem,
    Category,
    Review,
)

with app.app_context():
    db.create_all()
    ensure_schema_compatibility()


# ============================================================
# Basic Routes
# ============================================================

@app.route("/")
def home():
    return jsonify({
        "success": True,
        "message": "Shopping Server Running",
    })



# ============================================================
# Admin Dashboard
# ============================================================

@app.route("/admin/dashboard", methods=["GET"])
@admin_required
def admin_dashboard():
    """Return live dashboard metrics calculated from shopping.db."""
    now = datetime.utcnow()
    orders = Order.query.order_by(Order.created_at.asc()).all()
    products = Product.query.all()
    users = User.query.all()

    # Revenue is recognized only once an order has been delivered and the
    # server has stamped revenue_recognized_at.
    valid_orders = [
        o for o in orders
        if (o.status or "").lower() == "delivered"
        and getattr(o, "revenue_recognized_at", None) is not None
    ]

    revenue = sum(float(o.total or 0) for o in valid_orders)
    order_count = len(orders)
    avg_order = revenue / len(valid_orders) if valid_orders else 0

    # Category revenue and product units are derived from recognized order items.
    # Category revenue is allocated from each recognized order total in proportion
    # to its line revenue, so all category values add up exactly to total revenue
    # (including shipping/tax/discounts already represented in Order.total).
    category_sales = {}
    product_units = {}
    for order in valid_orders:
        line_values = []
        for item in order.items:
            qty = max(0, int(item.quantity or 0))
            line_revenue = round(qty * float(item.unit_price or item.sale_price or item.original_price or 0), 2)
            product = Product.query.get(item.product_id) if item.product_id else None
            category = (
                (product.category if product else None)
                or (product.category_ref.name if product and product.category_ref else None)
                or "Other"
            )
            line_values.append((item, product, category, qty, line_revenue))

        order_subtotal = sum(value for *_, value in line_values)
        if order_subtotal <= 0:
            continue
        remaining_total = round(float(order.total or 0), 2)
        for index, (item, product, category, qty, line_revenue) in enumerate(line_values):
            if index == len(line_values) - 1:
                allocated = remaining_total
            else:
                allocated = round(float(order.total or 0) * (line_revenue / order_subtotal), 2)
                remaining_total = round(remaining_total - allocated, 2)
            category_sales[category] = category_sales.get(category, 0) + allocated

            key = item.product_id or item.product_name or "unknown"
            if key not in product_units:
                product_units[key] = {
                    "name": item.product_name or (product.title if product else "Unknown"),
                    "category": category,
                    "units": 0,
                    "revenue": 0,
                    "image": product.image if product else getattr(item, "image", None),
                }
            product_units[key]["units"] += qty
            product_units[key]["revenue"] += allocated

    category_total = round(sum(category_sales.values()), 2)
    categories = sorted(
        [
            {
                "name": name,
                "revenue": round(value, 2),
                "percent": round((value / category_total) * 100, 1) if category_total else 0,
            }
            for name, value in category_sales.items()
        ],
        key=lambda x: x["revenue"],
        reverse=True,
    )

    best_sellers = sorted(
        product_units.values(),
        key=lambda x: (x["units"], x["revenue"]),
        reverse=True,
    )[:6]
    for item in best_sellers:
        item["revenue"] = round(item["revenue"], 2)

    # Last 6 calendar months, including the current month.
    monthly = []
    for offset in range(5, -1, -1):
        first = datetime(now.year, now.month, 1)
        month_num = first.month - offset
        year = first.year + (month_num - 1) // 12
        month = (month_num - 1) % 12 + 1
        start = datetime(year, month, 1)
        if month == 12:
            end = datetime(year + 1, 1, 1)
        else:
            end = datetime(year, month + 1, 1)
        value = sum(
            float(o.total or 0)
            for o in valid_orders
            if o.created_at and start <= o.created_at < end
        )
        monthly.append({
            "label": start.strftime("%b"),
            "revenue": round(value, 2),
        })

    low_stock = sum(
        1 for p in products
        if (p.stock or 0) > 0
        and (p.stock or 0) <= (p.low_stock if p.low_stock is not None else 10)
    )

    return jsonify({
        "success": True,
        "stats": {
            "revenue": round(revenue, 2),
            "orders": order_count,
            "average_order": round(avg_order, 2),
            "customers": len(users),
            "low_stock": low_stock,
        },
        "categories": categories,
        "best_sellers": best_sellers,
        "monthly_sales": monthly,
    })

# ============================================================
# Bank-transfer instructions
# ============================================================

@app.route("/payment-settings", methods=["GET"])
def payment_settings():
    """Public checkout instructions; never exposes secret credentials."""
    return jsonify({
        "success": True,
        "bank_transfer": {
            "bank_name": os.environ.get("BANK_NAME", "Store bank account"),
            "account_name": os.environ.get("BANK_ACCOUNT_NAME", "Configured store account"),
            "account_number": os.environ.get("BANK_ACCOUNT_NUMBER", ""),
            "routing_number": os.environ.get("BANK_ROUTING_NUMBER", ""),
            "reference_note": "Use your order number as the transfer reference.",
        },
    })


# ============================================================
# Product Uploads
# ============================================================

@app.route("/uploads/products/<filename>")
def uploaded_file(filename):
    return send_from_directory(
        app.config["UPLOAD_FOLDER"],
        filename,
    )


# ============================================================
# Debug: Products Table
# ============================================================

@app.route("/debug/products")
def debug_products():
    conn = sqlite3.connect(DATABASE_PATH)

    try:
        cursor = conn.cursor()

        cursor.execute(
            "PRAGMA table_info(products)"
        )

        data = cursor.fetchall()

    finally:
        conn.close()

    return jsonify({
        "columns": data,
    })


# ============================================================
# Register Blueprints
# ============================================================

app.register_blueprint(auth_bp)
app.register_blueprint(products_bp)
app.register_blueprint(orders_bp)
app.register_blueprint(categories_bp)


# ============================================================
# Database Migration Helpers
# ============================================================

def _ensure_column(conn, table, column, ddl):
    """
    Add a column to an existing SQLite table
    if it does not already exist.
    """

    columns = [
        row[1]
        for row in conn.execute(
            f"PRAGMA table_info({table})"
        )
    ]

    if column not in columns:
        conn.execute(
            f"ALTER TABLE {table} ADD COLUMN {column} {ddl}"
        )


def migrate():
    """
    Backward-compatible migrations for the
    existing shopping.db.
    """

    # --------------------------------------------------------
    # Products / Users
    # --------------------------------------------------------

    with sqlite3.connect(DATABASE_PATH) as conn:

        _ensure_column(
            conn,
            "products",
            "category_id",
            "INTEGER REFERENCES categories(id)",
        )

        _ensure_column(
            conn,
            "users",
            "google_sub",
            "VARCHAR(255)",
        )

        # ----------------------------------------------------
        # Orders
        # ----------------------------------------------------

        _ensure_column(
            conn,
            "orders",
            "customer_name",
            "VARCHAR(200)",
        )

        _ensure_column(
            conn,
            "orders",
            "customer_lastname",
            "VARCHAR(200)",
        )

        _ensure_column(
            conn,
            "orders",
            "customer_email",
            "VARCHAR(150)",
        )

        _ensure_column(
            conn,
            "orders",
            "customer_phone",
            "VARCHAR(100)",
        )

        _ensure_column(
            conn,
            "orders",
            "customer_address",
            "VARCHAR(300)",
        )

        _ensure_column(
            conn,
            "orders",
            "customer_architecture",
            "VARCHAR(200)",
        )

        _ensure_column(
            conn,
            "orders",
            "customer_floor",
            "VARCHAR(100)",
        )

        _ensure_column(
            conn,
            "orders",
            "customer_lat",
            "FLOAT",
        )

        _ensure_column(
            conn,
            "orders",
            "customer_lng",
            "FLOAT",
        )

        _ensure_column(
            conn,
            "orders",
            "payment_method",
            "VARCHAR(50)",
        )

        _ensure_column(
            conn,
            "orders",
            "subtotal",
            "FLOAT",
        )

        _ensure_column(
            conn,
            "orders",
            "shipping",
            "FLOAT",
        )

        _ensure_column(
            conn,
            "orders",
            "tax",
            "FLOAT",
        )

        _ensure_column(
            conn,
            "orders",
            "discount",
            "FLOAT",
        )

        _ensure_column(
            conn,
            "orders",
            "created_at",
            "DATETIME",
        )

        _ensure_column(
            conn,
            "products",
            "images",
            "TEXT",
        )

        # ----------------------------------------------------
        # Order Items
        # ----------------------------------------------------

        _ensure_column(
            conn,
            "order_items",
            "product_name",
            "VARCHAR(200)",
        )

        _ensure_column(
            conn,
            "order_items",
            "original_price",
            "FLOAT",
        )

        _ensure_column(
            conn,
            "order_items",
            "sale_price",
            "FLOAT",
        )

        _ensure_column(
            conn,
            "order_items",
            "unit_price",
            "FLOAT",
        )

        _ensure_column(
            conn,
            "order_items",
            "discount",
            "FLOAT",
        )

        _ensure_column(
            conn,
            "order_items",
            "total",
            "FLOAT",
        )

        _ensure_column(
            conn,
            "order_items",
            "variant_id",
            "INTEGER",
        )
        _ensure_column(
            conn,
            "order_items",
            "color",
            "VARCHAR(100)",
        )
        _ensure_column(
            conn,
            "order_items",
            "size",
            "VARCHAR(50)",
        )
        _ensure_column(
            conn,
            "order_items",
            "variant_image",
            "VARCHAR(500)",
        )

        # JSON array of up to five product images captured on the order item.
        # Required by the OrderItem ORM model and safe for existing databases.
        _ensure_column(
            conn,
            "order_items",
            "images",
            "TEXT",
        )

        # ----------------------------------------------------
        # Payment / revenue state
        # ----------------------------------------------------
        _ensure_column(conn, "orders", "payment_status", "VARCHAR(30)")
        _ensure_column(conn, "orders", "payment_verified_at", "DATETIME")
        _ensure_column(conn, "orders", "payment_verified_by", "INTEGER")
        _ensure_column(conn, "orders", "revenue_recognized_at", "DATETIME")
        _ensure_column(conn, "orders", "revenue_recognized_by", "INTEGER")

        # Backfill the new image JSON from the legacy single image column.
        rows = conn.execute("SELECT id, image, images FROM products").fetchall()
        for product_id, image, images in rows:
            try:
                parsed = json.loads(images or "[]")
                if not isinstance(parsed, list):
                    parsed = []
            except Exception:
                parsed = []
            parsed = [str(x) for x in parsed if isinstance(x, str) and x.strip()]
            if image and image not in parsed:
                parsed.insert(0, image)
            parsed = parsed[:5]
            conn.execute(
                "UPDATE products SET images = ? WHERE id = ?",
                (json.dumps(parsed), product_id),
            )

        # Preserve historical delivered orders as already recognized revenue.
        conn.execute(
            """
            UPDATE orders
            SET revenue_recognized_at = COALESCE(revenue_recognized_at, created_at)
            WHERE LOWER(COALESCE(status, '')) = 'delivered'
              AND revenue_recognized_at IS NULL
            """
        )
        conn.execute(
            """
            UPDATE orders
            SET payment_status =
                CASE LOWER(COALESCE(payment_method, ''))
                    WHEN 'transfer' THEN COALESCE(payment_status, 'pending')
                    WHEN 'cod' THEN COALESCE(payment_status, 'unpaid')
                    ELSE COALESCE(payment_status, 'pending')
                END
            WHERE payment_status IS NULL OR payment_status = ''
            """
        )

    # --------------------------------------------------------
    # Product variant tables
    # --------------------------------------------------------
    # Keep an explicit SQLite migration for databases created before
    # ProductVariant/VariantSize were introduced.
    with sqlite3.connect(DATABASE_PATH) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS product_variants (
                id INTEGER PRIMARY KEY,
                product_id INTEGER NOT NULL,
                color VARCHAR(100) NOT NULL,
                image VARCHAR(500),
                stock INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY(product_id) REFERENCES products(id)
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS variant_sizes (
                id INTEGER PRIMARY KEY,
                variant_id INTEGER NOT NULL,
                size VARCHAR(50) NOT NULL,
                price FLOAT NOT NULL DEFAULT 0,
                FOREIGN KEY(variant_id) REFERENCES product_variants(id)
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS ix_product_variants_product_id ON product_variants(product_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS ix_variant_sizes_variant_id ON variant_sizes(variant_id)")

    # --------------------------------------------------------
    # Legacy variant migration
    # --------------------------------------------------------
    with sqlite3.connect(DATABASE_PATH) as conn:
        products = conn.execute(
            "SELECT id, tags FROM products WHERE tags LIKE '%__PRODUCT_VARIANTS__=%'"
        ).fetchall()
        for product_id, tags in products:
            if conn.execute(
                "SELECT 1 FROM product_variants WHERE product_id = ? LIMIT 1",
                (product_id,),
            ).fetchone():
                continue
            try:
                payload = tags.split("\n__PRODUCT_VARIANTS__=", 1)[1]
                variants = json.loads(payload)
            except Exception:
                variants = []
            if not isinstance(variants, list):
                continue
            for variant in variants:
                if not isinstance(variant, dict) or not str(variant.get("color") or "").strip():
                    continue
                cur = conn.execute(
                    "INSERT INTO product_variants(product_id,color,image,stock) VALUES(?,?,?,?)",
                    (
                        product_id,
                        str(variant.get("color")).strip(),
                        str(variant.get("image") or ""),
                        max(0, int(variant.get("stock") or 0)),
                    ),
                )
                variant_id = cur.lastrowid
                for size in (variant.get("sizes") or [])[:7]:
                    if not isinstance(size, dict) or not str(size.get("size") or "").strip():
                        continue
                    try:
                        price = max(0.0, float(size.get("price") or 0))
                    except (TypeError, ValueError):
                        price = 0.0
                    conn.execute(
                        "INSERT INTO variant_sizes(variant_id,size,price) VALUES(?,?,?)",
                        (variant_id, str(size.get("size")).strip(), price),
                    )
            # Keep human-readable tags but remove the private JSON payload.
            visible_tags = tags.split("\n__PRODUCT_VARIANTS__=", 1)[0].strip()
            conn.execute("UPDATE products SET tags = ? WHERE id = ?", (visible_tags, product_id))

    # --------------------------------------------------------
    # Indexes
    # --------------------------------------------------------

    with sqlite3.connect(DATABASE_PATH) as conn:

        conn.execute(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS
            ix_users_google_sub
            ON users(google_sub)
            WHERE google_sub IS NOT NULL
            """
        )

        indexes = [
            row[1]
            for row in conn.execute(
                "PRAGMA index_list('categories')"
            )
        ]

        if "ix_categories_name" not in indexes:

            try:

                conn.execute(
                    """
                    CREATE UNIQUE INDEX IF NOT EXISTS
                    ix_categories_name
                    ON categories(name)
                    """
                )

            except Exception:
                # Existing duplicate category names can
                # prevent creation of the unique index.
                # The application-level validation remains
                # responsible in that case.
                pass


# ============================================================
# Create / Migrate Database
# ============================================================

with app.app_context():

    db.create_all()

    migrate()


# ============================================================
# Login
# ============================================================

@app.route("/login", methods=["POST"])
def login():

    data = request.get_json(silent=True) or {}

    email = (
        data.get("email") or ""
    ).strip().lower()

    password = data.get("password") or ""

    if not email or not password:

        return jsonify(
            success=False,
            message="Email and password are required",
        ), 400

    user = User.query.filter(
        db.func.lower(User.email) == email
    ).first()

    if user is None or not user.check_password(password):

        return jsonify(
            success=False,
            message="Invalid email or password",
        ), 401

    token = create_access_token(
        identity=str(user.id)
    )

    return jsonify(
        success=True,
        token=token,
        user={
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role,
        },
    )


# ============================================================
# Current User
# ============================================================

@app.route("/me", methods=["GET"])
@jwt_required()
def me():

    identity = get_jwt_identity()

    user = User.query.get(int(identity))

    if user is None:

        return jsonify(
            success=False,
            message="User not found",
        ), 404

    return jsonify(
        success=True,
        user={
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role,
        },
    )


# ============================================================
# Register
# ============================================================

@app.route("/register", methods=["POST"])
def register():

    data = request.get_json(silent=True) or {}

    username = (
        data.get("username") or ""
    ).strip()

    email = (
        data.get("email") or ""
    ).strip().lower()

    password = data.get("password") or ""

    # --------------------------------------------------------
    # Validation
    # --------------------------------------------------------

    if not username or not email or not password:

        return jsonify(
            success=False,
            message=(
                "Username, email and password are required"
            ),
        ), 400

    if len(password) < 8:

        return jsonify(
            success=False,
            message=(
                "Password must be at least 8 characters"
            ),
        ), 400

    # --------------------------------------------------------
    # Duplicate email
    # --------------------------------------------------------

    existing_email = User.query.filter(
        db.func.lower(User.email) == email
    ).first()

    if existing_email:

        return jsonify(
            success=False,
            message="Email is already registered",
        ), 409

    # --------------------------------------------------------
    # Duplicate username
    # --------------------------------------------------------

    existing_username = User.query.filter_by(
        username=username
    ).first()

    if existing_username:

        return jsonify(
            success=False,
            message="Username is already registered",
        ), 409

    # --------------------------------------------------------
    # Create user
    # --------------------------------------------------------

    user = User(
        username=username,
        email=email,
        password=generate_password_hash(password),
        role="user",
    )

    db.session.add(user)
    db.session.commit()

    # --------------------------------------------------------
    # JWT
    # --------------------------------------------------------

    token = create_access_token(
        identity=str(user.id)
    )

    return jsonify(
        success=True,
        token=token,
        user={
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role,
        },
    ), 201


# ============================================================
# Run Server
# ============================================================

if __name__ == "__main__":

    app.run(
        host="0.0.0.0",
        port=5000,
        debug=False,
    )