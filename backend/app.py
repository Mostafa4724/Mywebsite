import os
from flask_jwt_extended import JWTManager
from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
from products import products_bp
from database import db
from werkzeug.security import generate_password_hash
from models import User

from config import Config

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




@app.route("/create-admin")
def create_admin():

    admin = User.query.filter_by(email="admin@shop.com").first()

    if admin:
        return {"message": "Admin already exists"}

    admin = User(
        username="admin",
        email="admin@shop.com",
        password=generate_password_hash("admin123"),
        role="admin"
    )

    db.session.add(admin)
    db.session.commit()

    return {"message": "Admin created"}

import sqlite3

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


from auth import auth_bp

app.register_blueprint(auth_bp)
app.register_blueprint(products_bp)


with app.app_context():
    db.create_all()

if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=5000,
        debug=True
    )