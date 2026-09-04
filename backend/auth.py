import os
import re
import secrets

from flask import Blueprint, jsonify, request
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    get_jwt,
    get_jwt_identity,
    jwt_required,
)

from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from werkzeug.security import generate_password_hash

from database import db
from models import User


auth_bp = Blueprint("auth", __name__)


def _minimum_password_length():
    try:
        return max(8, int(os.getenv("MIN_PASSWORD_LENGTH", "8")))
    except ValueError:
        return 8


def _password_valid(password):
    return isinstance(password, str) and len(password) >= _minimum_password_length()


def _tokens_for(user):
    claims = {
        "role": user.role,
        "tv": int(user.token_version or 0),
    }
    return {
        "token": create_access_token(
            identity=str(user.id),
            additional_claims=claims
        ),
        "refresh_token": create_refresh_token(
            identity=str(user.id),
            additional_claims=claims
        ),
        "user": user.to_dict(),
    }


@auth_bp.post("/register")
def register():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not username or not email or not password:
        return jsonify(success=False, message="Username, email and password are required."), 400

    if not _password_valid(password):
        return jsonify(
            success=False,
            message=f"Password must be at least {_minimum_password_length()} characters."
        ), 400

    if User.query.filter(db.func.lower(User.email) == email).first():
        return jsonify(success=False, message="Email is already registered."), 409

    if User.query.filter_by(username=username).first():
        return jsonify(success=False, message="Username is already registered."), 409

    user = User(
        username=username,
        email=email,
        password=generate_password_hash(password),
        role="user",
        token_version=0,
    )
    db.session.add(user)
    db.session.commit()

    return jsonify(success=True, **_tokens_for(user)), 201


@auth_bp.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify(success=False, message="Email and password are required."), 400

    user = User.query.filter(db.func.lower(User.email) == email).first()
    if user is None or not user.check_password(password):
        # Deliberately use one message for both cases.
        return jsonify(success=False, message="Invalid email or password."), 401

    return jsonify(success=True, **_tokens_for(user))


@auth_bp.post("/refresh")
@jwt_required(refresh=True)
def refresh():
    claims = get_jwt()
    identity = get_jwt_identity()

    try:
        user = User.query.get(int(identity))
    except (TypeError, ValueError):
        user = None

    if user is None:
        return jsonify(success=False, message="Session is no longer valid."), 401

    if int(claims.get("tv", 0) or 0) != int(user.token_version or 0):
        return jsonify(success=False, message="Refresh token is no longer valid."), 401

    # Rotate the token family. This makes the refresh token that was just
    # consumed unusable on the next refresh attempt.
    user.token_version = int(user.token_version or 0) + 1
    db.session.commit()

    return jsonify(success=True, **_tokens_for(user))


@auth_bp.post("/logout")
def logout():
    # JWT access/refresh tokens are client-held. Clearing them client-side
    # logs the browser out; password changes invalidate tokens server-side.
    return jsonify(success=True, message="Logged out.")


@auth_bp.get("/me")
@jwt_required()
def me():
    from security import current_user

    user = current_user()
    if user is None:
        return jsonify(success=False, message="Session is no longer valid."), 401

    return jsonify(success=True, user=user.to_dict())


@auth_bp.get("/google-config")
def google_config():
    client_id = (os.getenv("GOOGLE_CLIENT_ID") or "").strip()
    return jsonify(success=bool(client_id), client_id=client_id)


def _unique_google_username(display_name, email):
    base = re.sub(r"[^a-zA-Z0-9_]+", "", (display_name or "").replace(" ", "_"))
    if not base:
        base = re.sub(r"[^a-zA-Z0-9_]+", "", email.split("@", 1)[0] if email else "user")
    base = base[:80] or "user"

    candidate = base
    counter = 2
    while User.query.filter_by(username=candidate).first() is not None:
        suffix = f"_{counter}"
        candidate = base[:100 - len(suffix)] + suffix
        counter += 1
    return candidate


@auth_bp.post("/google-login")
def google_login():
    client_id = (os.getenv("GOOGLE_CLIENT_ID") or "").strip()
    if not client_id:
        return jsonify(
            success=False,
            message="Google Sign-In is not configured on the server."
        ), 503

    data = request.get_json(silent=True) or {}
    credential = data.get("credential")
    if not credential:
        return jsonify(success=False, message="Missing Google credential."), 400

    try:
        info = id_token.verify_oauth2_token(
            credential,
            google_requests.Request(),
            client_id
        )
    except ValueError:
        return jsonify(success=False, message="Invalid Google credential."), 401

    if info.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
        return jsonify(success=False, message="Invalid Google token issuer."), 401

    if not info.get("email_verified"):
        return jsonify(success=False, message="Your Google email must be verified."), 403

    google_sub = str(info.get("sub") or "").strip()
    email = str(info.get("email") or "").strip().lower()
    display_name = str(info.get("name") or info.get("given_name") or "").strip()

    if not google_sub or not email:
        return jsonify(
            success=False,
            message="Google did not provide the required account information."
        ), 400

    user = User.query.filter_by(google_sub=google_sub).first()
    if user is None:
        user = User.query.filter(db.func.lower(User.email) == email).first()

    if user is None:
        user = User(
            username=_unique_google_username(display_name, email),
            email=email,
            password=generate_password_hash(secrets.token_urlsafe(32)),
            role="user",
            google_sub=google_sub,
            token_version=0,
        )
        db.session.add(user)
    else:
        if user.google_sub and user.google_sub != google_sub:
            return jsonify(
                success=False,
                message="This email is already linked to a different Google account."
            ), 409
        user.google_sub = google_sub
        user.email = email

    db.session.commit()
    return jsonify(success=True, **_tokens_for(user))
