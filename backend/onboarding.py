"""Admin account security and first-run onboarding state.

Ships-with-a-default-password is the normal way to hand a system over, and
the normal way it gets breached. These endpoints exist so the handover has
a visible, finishable ending: the panel nags until the owner has replaced
the credentials that came in the box.

    GET  /admin/setup-status   what still needs doing (drives the sidebar dots)
    POST /admin/account        change the admin's own login email and password

The default credentials are declared in the environment rather than baked
in, so a reseller can ship whatever pair they like and detection still
works:

    DEFAULT_ADMIN_EMAIL=Admin@gmail.com
    DEFAULT_ADMIN_PASSWORD=Admin@1234
"""

import os
import re

from flask import Blueprint, jsonify, request

from database import db
from models import User
from security import admin_required, current_user


onboarding_bp = Blueprint("onboarding", __name__)

DEFAULT_ADMIN_EMAIL = "Admin@gmail.com"
DEFAULT_ADMIN_PASSWORD = "Admin@1234"

EMAIL_RE = re.compile(r"[^@\s]+@[^@\s]+\.[^@\s]+")
USERNAME_RE = re.compile(r"[A-Za-z0-9_.-]+")


def _default_email():
    return (os.getenv("DEFAULT_ADMIN_EMAIL") or DEFAULT_ADMIN_EMAIL).strip()


def _default_password():
    return os.getenv("DEFAULT_ADMIN_PASSWORD") or DEFAULT_ADMIN_PASSWORD


def _min_password_length():
    try:
        return max(8, int(os.getenv("MIN_PASSWORD_LENGTH", "8")))
    except ValueError:
        return 8


def account_state(user):
    """Which shipped credentials this admin is still using."""
    default_email = _default_email()
    using_default_email = (
        bool(default_email)
        and (user.email or "").strip().lower() == default_email.lower()
    )

    # Checking the password means one hash verification per call. That is
    # the only honest test -- comparing emails alone would clear an admin
    # who changed the address but kept "Admin@1234".
    try:
        using_default_password = user.check_password(_default_password())
    except Exception:
        using_default_password = False

    return using_default_email, using_default_password


def email_is_configured():
    """True when .env has enough for mailer.send_email to even try."""
    return all(
        (os.getenv(key) or "").strip()
        for key in ("EMAIL_HOST", "EMAIL_USERNAME", "EMAIL_PASSWORD")
    )


@onboarding_bp.get("/admin/setup-status")
@admin_required
def setup_status():
    user = current_user()
    using_default_email, using_default_password = account_state(user)
    account_secure = not (using_default_email or using_default_password)
    mail_ready = email_is_configured()

    tasks = []
    if not account_secure:
        tasks.append({
            "id": "account",
            "section": "security",
            "badge": "!",
            "title": "Please secure your account",
            "urgent": True,
        })
    if not mail_ready:
        tasks.append({
            "id": "email",
            "section": "email",
            "badge": "!",
            "title": "Set up sending email",
            "urgent": False,
        })

    return jsonify(
        success=True,
        account_secure=account_secure,
        using_default_email=using_default_email,
        using_default_password=using_default_password,
        email_configured=mail_ready,
        username=user.username,
        email=user.email,
        min_password_length=_min_password_length(),
        tasks=tasks,
    )


@onboarding_bp.post("/admin/account")
@admin_required
def update_account():
    """Change the signed-in admin's own username, email and password.

    All three move together because that is how a handover actually works:
    the owner replaces the whole shipped identity in one sitting. Partial
    updates are allowed so the page can also be used later to change just
    one thing.
    """
    user = current_user()
    data = request.get_json(silent=True) or {}

    current_password = data.get("current_password") or ""
    new_username = (data.get("username") or "").strip()
    new_email = (data.get("email") or "").strip()
    new_password = data.get("new_password") or ""
    confirm_password = data.get("confirm_password") or ""

    # Always required, even while the account is still on the shipped
    # password. Without it, anything that can make a request as the admin
    # -- a stolen tab, a malicious extension -- could lock the owner out of
    # their own shop by changing both the address and the password.
    if not user.check_password(current_password):
        return jsonify(
            success=False,
            errors={"current_password": "That is not your current password."},
        ), 400

    errors = {}
    changes = []
    minimum = _min_password_length()

    if new_username and new_username != user.username:
        if len(new_username) < 3 or len(new_username) > 30:
            errors["username"] = "Between 3 and 30 characters."
        elif not USERNAME_RE.fullmatch(new_username):
            errors["username"] = "Letters, numbers, dot, dash and underscore only."
        else:
            clash = User.query.filter(
                db.func.lower(User.username) == new_username.lower(),
                User.id != user.id,
            ).first()
            if clash:
                errors["username"] = "That username is taken."
            else:
                changes.append("username")

    if new_email and new_email.lower() != (user.email or "").lower():
        if not EMAIL_RE.fullmatch(new_email):
            errors["email"] = "Enter a valid email address."
        elif new_email.strip().lower() == _default_email().lower():
            errors["email"] = (
                "That is the address the shop was delivered with. "
                "Use your own."
            )
        else:
            clash = User.query.filter(
                db.func.lower(User.email) == new_email.lower(),
                User.id != user.id,
            ).first()
            if clash:
                errors["email"] = "An account already uses that address."
            else:
                changes.append("email")

    if new_password:
        if len(new_password) < minimum:
            errors["new_password"] = f"At least {minimum} characters."
        elif new_password == current_password:
            errors["new_password"] = "This is your current password."
        elif new_password == _default_password():
            errors["new_password"] = (
                "That is the password the shop was delivered with. "
                "Choose your own."
            )
        elif new_password != confirm_password:
            errors["confirm_password"] = "The two passwords do not match."
        else:
            changes.append("password")
    elif confirm_password:
        errors["new_password"] = "Enter the new password too."

    if errors:
        return jsonify(
            success=False,
            message="Nothing was changed.",
            errors=errors,
        ), 400

    if not changes:
        return jsonify(
            success=False,
            message="Nothing to change.",
            errors={},
        ), 400

    if "username" in changes:
        user.username = new_username
    if "email" in changes:
        user.email = new_email
    if "password" in changes:
        # set_password() bumps token_version, which invalidates every token
        # already issued for this account -- including the one that made
        # this request. That is the point: if the shipped password leaked,
        # any session opened with it dies here.
        user.set_password(new_password)

    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify(
            success=False,
            message="Could not save the changes. Nothing was modified.",
        ), 500

    using_default_email, using_default_password = account_state(user)

    from auth import _tokens_for

    return jsonify(
        success=True,
        message="Your account details were updated.",
        changed=changes,
        account_secure=not (using_default_email or using_default_password),
        # Fresh tokens keep the browser that made the change signed in.
        # Every other device is now logged out.
        **_tokens_for(user),
    )
