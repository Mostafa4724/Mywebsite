import os
from werkzeug.security import generate_password_hash
from app import app
from database import db
from models import User

username = os.environ.get("ADMIN_USERNAME")
email = os.environ.get("ADMIN_EMAIL")
password = os.environ.get("ADMIN_PASSWORD")

if not all([username, email, password]):
    raise SystemExit("Set ADMIN_USERNAME, ADMIN_EMAIL and ADMIN_PASSWORD first.")

with app.app_context():
    existing = User.query.filter(
        (User.email == email) | (User.username == username)
    ).first()

    if existing:
        if existing.role != "admin":
            raise SystemExit("That username/email already belongs to a non-admin account.")
        print("Admin account already exists.")
    else:
        admin = User(
            username=username,
            email=email,
            password=generate_password_hash(password),
            role="admin"
        )
        db.session.add(admin)
        db.session.commit()
        print("Admin account created successfully.")
