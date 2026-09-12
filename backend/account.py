import hashlib
import os
import re
import secrets
from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request

from database import db
from mailer import send_password_reset_email
from models import PasswordResetToken, User
from security import current_user, user_required
from auth import _env_int


account_bp = Blueprint("account", __name__)

RESET_MESSAGE = (
    "If an account with that email exists, a password reset link has been sent."
)


def _now():
    return datetime.utcnow()


def _password_ok(password):
    minimum = _env_int("MIN_PASSWORD_LENGTH", 8, minimum=8)
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
    if recent_count >= _env_int("PASSWORD_RESET_MAX_PER_HOUR", 5, minimum=1):
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
            minutes=_env_int("PASSWORD_RESET_MINUTES", 30, minimum=1)
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


# ============================================================
# /me -- customer profile (view + edit own name and email)
# ============================================================
#
# Deliberately separate from /admin/account:
#   * /admin/account is for the shop owner and enforces "not the shipped
#     default email/password" rules.
#   * /me is for any signed-in user, admin or customer, editing their own
#     display name and login email. It bumps token_version on an email
#     change so old sessions on other devices are invalidated.

_USERNAME_RE = re.compile(r"[A-Za-z0-9_.\-]+")
_EMAIL_RE = re.compile(r"[^@\s]+@[^@\s]+\.[^@\s]+")


@account_bp.get("/me")
@user_required
def me_get():
    """Return the signed-in user's own profile, including join date."""
    user = current_user()
    if user is None:
        return jsonify(success=False, message="Session is no longer valid."), 401

    payload = user.to_dict()
    # to_dict() intentionally omits fields not always safe for admin lists;
    # created_at is fine to expose on the /me route because the caller *is*
    # the user. Fall back gracefully when the column doesn't exist yet on
    # an older shopping.db that predates the timestamp.
    created_at = getattr(user, "created_at", None)
    if created_at is not None:
        try:
            payload["created_at"] = created_at.isoformat()
        except AttributeError:
            payload["created_at"] = str(created_at)

    return jsonify(success=True, user=payload)


@account_bp.post("/me")
@user_required
def me_update():
    """Update the signed-in user's own display name and login email.

    Password changes go through /change-password so the required-current-
    password check stays a single code path.
    """
    user = current_user()
    if user is None:
        return jsonify(success=False, message="Session is no longer valid."), 401

    data = request.get_json(silent=True) or {}
    new_username = (data.get("username") or "").strip()
    new_email = (data.get("email") or "").strip()

    if not new_username or not new_email:
        return jsonify(
            success=False,
            message="Name and email are both required.",
        ), 400

    changed = []

    if new_username != user.username:
        if len(new_username) < 2 or len(new_username) > 60:
            return jsonify(
                success=False,
                message="Name must be between 2 and 60 characters.",
            ), 400
        if not _USERNAME_RE.fullmatch(new_username):
            return jsonify(
                success=False,
                message="Name may only contain letters, numbers, dot, dash and underscore.",
            ), 400
        # A duplicate name isn't a login collision (email is what people
        # sign in with) but the User model has unique=True on username, so
        # the commit would fail -- catch it up front with a friendly note.
        clash = User.query.filter(
            db.func.lower(User.username) == new_username.lower(),
            User.id != user.id,
        ).first()
        if clash:
            return jsonify(
                success=False,
                message="That name is already in use. Try another.",
            ), 400
        user.username = new_username
        changed.append("username")

    if new_email.lower() != (user.email or "").lower():
        if not _EMAIL_RE.fullmatch(new_email):
            return jsonify(
                success=False,
                message="Enter a valid email address.",
            ), 400
        clash = User.query.filter(
            db.func.lower(User.email) == new_email.lower(),
            User.id != user.id,
        ).first()
        if clash:
            return jsonify(
                success=False,
                message="An account already uses that email address.",
            ), 400
        user.email = new_email
        # Changing the login email invalidates every other session for this
        # account -- the token they were issued was tied to the old address.
        user.token_version = int(user.token_version or 0) + 1
        changed.append("email")

    if not changed:
        return jsonify(success=True, message="Nothing to change.", user=user.to_dict())

    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify(
            success=False,
            message="Could not save the changes.",
        ), 500

    # Return a fresh token pair so THIS browser stays signed in even though
    # token_version was bumped for the email change.
    from auth import _tokens_for
    return jsonify(
        success=True,
        message="Profile updated.",
        changed=changed,
        **_tokens_for(user),
    )