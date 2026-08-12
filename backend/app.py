import os
from flask_jwt_extended import JWTManager
from flask import Flask, jsonify, send_from_directory, request
from flask_cors import CORS
from products import products_bp
from orders import orders_bp
from auth import auth_bp
from database import db
from werkzeug.security import generate_password_hash
from models import User
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from config import Config
import sqlite3

SECRET_KEY = os.environ.get("SECRET_KEY")
JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY")
if not SECRET_KEY or not JWT_SECRET_KEY:
    raise RuntimeError("SECRET_KEY and JWT_SECRET_KEY environment variables are required")

app = Flask(__name__)


app.config.from_object(Config)
CORS(app)

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

DATABASE_PATH = os.path.join(
    BASE_DIR,
    "..",
    "database",
    "shopping.db"
)
UPLOAD_FOLDER = os.path.join(
    BASE_DIR,
    "uploads",
    "products"
)

os.makedirs(UPLOAD_FOLDER, exist_ok=True)

app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{DATABASE_PATH}"
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

# Connect SQLAlchemy to Flask
db.init_app(app)
jwt = JWTManager(app)
# Import models AFTER db is initialized
from models import User, Product, Cart, Order, OrderItem





@app.route("/debug/products")
def debug_products():

    conn = sqlite3.connect(DATABASE_PATH)

    cursor = conn.cursor()

    cursor.execute("PRAGMA table_info(products)")

    data = cursor.fetchall()

    conn.close()

    return {"columns": data}
@app.route("/")
def home():
    return jsonify({
        "success": True,
        "message": "Shopping Server Running"
    })

@app.route("/uploads/products/<filename>")
def uploaded_file(filename):

    return send_from_directory(
        app.config["UPLOAD_FOLDER"],
        filename
    )

from flask import send_from_directory




from categories import categories_bp

app.register_blueprint(auth_bp)
app.register_blueprint(products_bp)
app.register_blueprint(orders_bp)
app.register_blueprint(categories_bp)


def _ensure_column(conn, table, column, ddl):
    """Add a column to an existing SQLite table if it does not exist."""
    columns = [row[1] for row in conn.execute(f"PRAGMA table_info({table})")]
    if column not in columns:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}")


def migrate():
    """Backward-compatible migrations for the existing shopping.db."""
    with sqlite3.connect(DATABASE_PATH) as conn:
        _ensure_column(
            conn,
            "products",
            "category_id",
            "INTEGER REFERENCES categories(id)"
        )
        _ensure_column(conn, "users", "google_sub", "VARCHAR(255)")
        # ---- orders table ----
        _ensure_column(conn, "orders", "customer_name", "VARCHAR(200)")
        _ensure_column(conn, "orders", "customer_lastname", "VARCHAR(200)")
        _ensure_column(conn, "orders", "customer_email", "VARCHAR(150)")
        _ensure_column(conn, "orders", "customer_phone", "VARCHAR(100)")
        _ensure_column(conn, "orders", "customer_address", "VARCHAR(300)")
        _ensure_column(conn, "orders", "customer_architecture", "VARCHAR(200)")
        _ensure_column(conn, "orders", "customer_floor", "VARCHAR(100)")
        _ensure_column(conn, "orders", "customer_lat", "FLOAT")
        _ensure_column(conn, "orders", "customer_lng", "FLOAT")
        _ensure_column(conn, "orders", "payment_method", "VARCHAR(50)")
        _ensure_column(conn, "orders", "subtotal", "FLOAT")
        _ensure_column(conn, "orders", "shipping", "FLOAT")
        _ensure_column(conn, "orders", "tax", "FLOAT")
        _ensure_column(conn, "orders", "discount", "FLOAT")
        _ensure_column(conn, "orders", "created_at", "DATETIME")
        # ---- order_items table ----
        _ensure_column(conn, "order_items", "product_name", "VARCHAR(200)")
        _ensure_column(conn, "order_items", "original_price", "FLOAT")
        _ensure_column(conn, "order_items", "sale_price", "FLOAT")
        _ensure_column(conn, "order_items", "unit_price", "FLOAT")
        _ensure_column(conn, "order_items", "discount", "FLOAT")
        _ensure_column(conn, "order_items", "total", "FLOAT")
    # NOTE: SQLite's ALTER TABLE ADD COLUMN cannot add a UNIQUE column,
    # so the `name` column uniqueness for categories is enforced in code
    # (see categories.create_category) and by the app-level index below.
    with sqlite3.connect(DATABASE_PATH) as conn:
        conn.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_google_sub "
            "ON users(google_sub) WHERE google_sub IS NOT NULL"
        )
        indexes = [
            row[1]
            for row in conn.execute("PRAGMA index_list('categories')")
        ]
        if "ix_categories_name" not in indexes:
            try:
                conn.execute(
                    "CREATE UNIQUE INDEX IF NOT EXISTS "
                    "ix_categories_name ON categories(name)"
                )
            except Exception:
                # Duplicate names may already exist; enforce in code only.
                pass


with app.app_context():
    db.create_all()
    migrate()


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify(success=False, message="Email and password are required"), 400

    user = User.query.filter(db.func.lower(User.email) == email).first()
    if user is None or not user.check_password(password):
        return jsonify(success=False, message="Invalid email or password"), 401

    token = create_access_token(identity=str(user.id))
    return jsonify(
        success=True,
        token=token,
        user={
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role
        }
    )

@app.route("/me", methods=["GET"])
@jwt_required()
def me():
    identity = get_jwt_identity()
    user = User.query.get(int(identity))
    if user is None:
        return jsonify(success=False, message="User not found"), 404
    return jsonify(success=True, user={
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "role": user.role
    })


@app.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not username or not email or not password:
        return jsonify(success=False, message="Username, email and password are required"), 400
    if len(password) < 8:
        return jsonify(success=False, message="Password must be at least 8 characters"), 400

    if User.query.filter(db.func.lower(User.email) == email).first():
        return jsonify(success=False, message="Email is already registered"), 409
    if User.query.filter_by(username=username).first():
        return jsonify(success=False, message="Username is already registered"), 409

    user = User(
        username=username,
        email=email,
        password=generate_password_hash(password),
        role="user"
    )
    db.session.add(user)
    db.session.commit()

    token = create_access_token(identity=str(user.id))
    return jsonify(success=True, token=token, user={
        "id": user.id, "username": user.username, "email": user.email, "role": user.role
    }), 201

if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=5000,
        debug=False
    )