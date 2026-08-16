import os
import re
import secrets

from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token,
    jwt_required,
    get_jwt_identity
)

from werkzeug.security import (
    generate_password_hash,
    check_password_hash
)
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

from database import db
from models import User

auth_bp = Blueprint("auth", __name__)

@auth_bp.route("/register", methods=["POST"])
def register():

    data = request.get_json()

    username = data.get("username")
    email = data.get("email")
    password = data.get("password")

    if not username or not email or not password:
        return jsonify({"success": False, "message": "Missing data"}),400

    if User.query.filter_by(email=email).first():
        return jsonify({"success":False,"message":"Email already exists"}),409

    if User.query.filter_by(username=username).first():
        return jsonify({"success":False,"message":"Username already exists"}),409

    user = User(
        username=username,
        email=email,
        password=generate_password_hash(password),
        role="user"
    )

    db.session.add(user)
    db.session.commit()

    return jsonify({
        "success":True,
        "message":"Account created"
    })

@auth_bp.route("/login", methods=["POST"])
def login():

    data = request.get_json()

    email = data.get("email")

    password = data.get("password")

    user = User.query.filter_by(email=email).first()

    if user is None:
        return jsonify({
            "success":False,
            "message":"Wrong email"
        }),401

    if not check_password_hash(user.password,password):
        return jsonify({
            "success":False,
            "message":"Wrong password"
        }),401

    token = create_access_token(
    identity=str(user.id),
    additional_claims={
        "role": user.role
        }
    )

    return jsonify({

        "success":True,

        "token":token,

        "user":user.to_dict()

    })

@auth_bp.route("/me")
@jwt_required()
def me():

    user_id = get_jwt_identity()

    user = User.query.get(user_id)

    if user is None:
        return jsonify({"success":False}),404

    return jsonify({

        "success":True,

        "user":user.to_dict()

    })

@auth_bp.route("/google-config", methods=["GET"])
def google_config():
    """Return the public Google Web Client ID used by the browser button."""
    client_id = (os.environ.get("GOOGLE_CLIENT_ID") or "").strip()
    return jsonify({"success": bool(client_id), "client_id": client_id})


def _unique_google_username(display_name, email):
    """Create a username that fits the existing unique username constraint."""
    base = re.sub(r"[^a-zA-Z0-9_]+", "", (display_name or "").replace(" ", "_"))
    if not base:
        base = re.sub(r"[^a-zA-Z0-9_]+", "", (email.split("@", 1)[0] if email else "user"))
    base = base[:80] or "user"

    candidate = base
    counter = 2
    while User.query.filter_by(username=candidate).first() is not None:
        suffix = f"_{counter}"
        candidate = (base[:100-len(suffix)] + suffix)
        counter += 1
    return candidate


@auth_bp.route("/google-login", methods=["POST"])
def google_login():
    """Verify a Google Identity Services ID token and issue this shop's JWT."""
    client_id = (os.environ.get("GOOGLE_CLIENT_ID") or "").strip()
    if not client_id:
        return jsonify({
            "success": False,
            "message": "Google Sign-In is not configured on the server. Set GOOGLE_CLIENT_ID."
        }), 503

    data = request.get_json(silent=True) or {}
    credential = data.get("credential")
    if not credential:
        return jsonify({"success": False, "message": "Missing Google credential."}), 400

    try:
        info = id_token.verify_oauth2_token(
            credential,
            google_requests.Request(),
            client_id
        )
    except ValueError:
        return jsonify({"success": False, "message": "Invalid Google credential."}), 401

    issuer = info.get("iss")
    if issuer not in ("accounts.google.com", "https://accounts.google.com"):
        return jsonify({"success": False, "message": "Invalid Google token issuer."}), 401

    if not info.get("email_verified"):
        return jsonify({"success": False, "message": "Your Google email must be verified."}), 403

    google_sub = str(info.get("sub") or "").strip()
    email = str(info.get("email") or "").strip().lower()
    display_name = str(info.get("name") or info.get("given_name") or "").strip()

    if not google_sub or not email:
        return jsonify({"success": False, "message": "Google did not provide the required account information."}), 400

    # Prefer the stable Google subject. If the email already belongs to a
    # password account, link that verified Google identity to the same user.
    user = User.query.filter_by(google_sub=google_sub).first()
    if user is None:
        user = User.query.filter(db.func.lower(User.email) == email).first()

    if user is None:
        user = User(
            username=_unique_google_username(display_name, email),
            email=email,
            # Password is unused for Google accounts, but the current schema
            # requires a non-null value. Generate an unpredictable placeholder.
            password=generate_password_hash(secrets.token_urlsafe(32)),
            role="user",
            google_sub=google_sub,
        )
        db.session.add(user)
    else:
        if user.google_sub and user.google_sub != google_sub:
            return jsonify({
                "success": False,
                "message": "This email is already linked to a different Google account."
            }), 409
        user.google_sub = google_sub
        # Keep the verified Google email in sync.
        user.email = email

    db.session.commit()

    token = create_access_token(
        identity=str(user.id),
        additional_claims={"role": user.role}
    )

    return jsonify({
        "success": True,
        "token": token,
        "user": user.to_dict()
    })
