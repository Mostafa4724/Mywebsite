import hashlib
import os
import secrets
from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request

from database import db
from mailer import send_password_reset_email
from models import PasswordResetToken, User
from security import current_user, user_required


account_bp = Blueprint("account", __name__)

RESET_MESSAGE = (
    "If an account with that email exists, a password reset link has been sent."
)


def _now():
    return datetime.utcnow()


def _password_ok(password):
    minimum = int(os.getenv("MIN_PASSWORD_LENGTH", "8"))
    return isinstance(password, str) and len(password) >= minimum


def _hash_token(token):
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _reset_url(token):
    base = (os.getenv("FRONTEND_BASE_URL") or "").rstrip("/")
    path = os.getenv("PASSWORD_RESET_PATH", "/page/reset-password.html")
    if not path.startswith("/"):
        path = "/" + path
    return f"{base}{path}?token={token}"


@account_bp.post("/forgot-password")
def forgot_password():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()

    # Always return the same public response to avoid account enumeration.
    if not email:
        return jsonify(success=True, message=RESET_MESSAGE)

    user = User.query.filter(db.func.lower(User.email) == email).first()
    if user is None:
        return jsonify(success=True, message=RESET_MESSAGE)

    hour_ago = _now() - timedelta(hours=1)
    recent_count = PasswordResetToken.query.filter(
        PasswordResetToken.user_id == user.id,
        PasswordResetToken.created_at >= hour_ago
    ).count()
    if recent_count >= int(os.getenv("PASSWORD_RESET_MAX_PER_HOUR", "5")):
        return jsonify(success=True, message=RESET_MESSAGE)

    # New request invalidates all older links for this account.
    PasswordResetToken.query.filter(
        PasswordResetToken.user_id == user.id,
        PasswordResetToken.used_at.is_(None)
    ).update({"used_at": _now()}, synchronize_session=False)

    raw_token = secrets.token_urlsafe(48)
    reset = PasswordResetToken(
        user_id=user.id,
        token_hash=_hash_token(raw_token),
        expires_at=_now() + timedelta(
            minutes=int(os.getenv("PASSWORD_RESET_MINUTES", "30"))
        )
    )
    db.session.add(reset)
    db.session.commit()

    try:
        send_password_reset_email(user.email, _reset_url(raw_token))
    except Exception:
        # Do not expose mail configuration details to the browser.
        app_logger = __import__("logging").getLogger(__name__)
        app_logger.exception("Password reset email could not be sent.")
        return jsonify(
            success=False,
            message="We could not send the reset email right now. Please try again later."
        ), 503

    return jsonify(success=True, message=RESET_MESSAGE)


@account_bp.get("/reset-password/check")
def check_reset_password():
    raw_token = (request.args.get("token") or "").strip()
    if not raw_token:
        return jsonify(success=False, valid=False, message="Reset link is invalid."), 400

    reset = PasswordResetToken.query.filter_by(
        token_hash=_hash_token(raw_token)
    ).first()
    if reset is None or reset.used_at is not None or reset.expires_at <= _now():
        return jsonify(success=False, valid=False, message="Reset link is invalid or expired."), 400

    return jsonify(success=True, valid=True)


@account_bp.post("/reset-password")
def reset_password():
    data = request.get_json(silent=True) or {}
    raw_token = (data.get("token") or "").strip()
    password = data.get("password") or ""

    if not raw_token or not _password_ok(password):
        return jsonify(
            success=False,
            message=f"Password must be at least {os.getenv('MIN_PASSWORD_LENGTH', '8')} characters."
        ), 400

    reset = PasswordResetToken.query.filter_by(
        token_hash=_hash_token(raw_token)
    ).first()
    if reset is None or reset.used_at is not None or reset.expires_at <= _now():
        return jsonify(success=False, message="Reset link is invalid or expired."), 400

    user = User.query.get(reset.user_id)
    if user is None:
        return jsonify(success=False, message="Reset link is invalid or expired."), 400

    user.set_password(password)
    reset.used_at = _now()

    # Invalidate every other outstanding reset token as well.
    PasswordResetToken.query.filter(
        PasswordResetToken.user_id == user.id,
        PasswordResetToken.id != reset.id,
        PasswordResetToken.used_at.is_(None)
    ).update({"used_at": _now()}, synchronize_session=False)

    db.session.commit()
    return jsonify(success=True, message="Password reset successfully. Please sign in again.")


@account_bp.post("/change-password")
@user_required
def change_password():
    data = request.get_json(silent=True) or {}
    current_password = data.get("current_password") or ""
    new_password = data.get("new_password") or ""

    user = current_user()
    if user is None:
        return jsonify(success=False, message="Session is no longer valid."), 401

    if not user.check_password(current_password):
        return jsonify(success=False, message="Current password is incorrect."), 400

    if not _password_ok(new_password):
        return jsonify(
            success=False,
            message=f"Password must be at least {os.getenv('MIN_PASSWORD_LENGTH', '8')} characters."
        ), 400

    if user.check_password(new_password):
        return jsonify(success=False, message="New password must be different."), 400

    user.set_password(new_password)
    db.session.commit()

    # Keep the device that made the change signed in with a fresh token pair.
    from auth import _tokens_for
    return jsonify(success=True, message="Password changed successfully.", **_tokens_for(user))
