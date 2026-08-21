"""Create a safe development admin/category seed using environment variables.

Production credentials must be supplied through ADMIN_* environment variables.
No credentials are hardcoded here.
"""
import os
from werkzeug.security import generate_password_hash
from app import app
from database import db
from models import User, Category

with app.app_context():
    username = (os.environ.get("ADMIN_USERNAME") or "").strip()
    email = (os.environ.get("ADMIN_EMAIL") or "").strip().lower()
    password = os.environ.get("ADMIN_PASSWORD") or ""
    if not all([username, email, password]):
        raise SystemExit("Set ADMIN_USERNAME, ADMIN_EMAIL and ADMIN_PASSWORD first.")
    user = User.query.filter(db.func.lower(User.email) == email).first()
    if user is None:
        user = User(username=username, email=email, password=generate_password_hash(password), role="admin")
        db.session.add(user)
    elif user.role != "admin":
        raise SystemExit("ADMIN_EMAIL already belongs to a normal user.")
    if Category.query.count() == 0:
        db.session.add_all([Category(name="General"), Category(name="New Arrivals")])
    db.session.commit()
    print("Development seed complete.")
