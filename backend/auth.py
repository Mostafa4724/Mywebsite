import os
import re
import secrets
import json

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


def _env_int(name, default, minimum=None):
    """Read an integer setting without ever crashing a request.

    A malformed value in .env ("0.1", "", "five") falls back to `default`
    instead of raising ValueError inside a view function.
    """
    raw = os.getenv(name)
    if raw is None or str(raw).strip() == "":
        value = default
    else:
        try:
            value = int(str(raw).strip())
        except ValueError:
            try:
                # Tolerate "5.0"; reject anything that isn't a whole number.
                as_float = float(str(raw).strip())
            except ValueError:
                value = default
            else:
                value = int(as_float) if as_float.is_integer() else default
    if minimum is not None and value < minimum:
        value = minimum
    return value


def _generate_choices():
    """Three distinct random numbers in 0-99, as canonical unpadded strings.

    Canonical form matters: the correct code is stored only as a hash, so
    "7" and "07" must never both be possible for the same number.
    """
    return [str(n) for n in secrets.SystemRandom().sample(range(0, 100), 3)]


def _normalize_code(value):
    """Return the canonical string for a submitted code, or None if invalid."""
    text = str(value or "").strip()
    if not re.fullmatch(r"\d{1,2}", text):
        return None
    number = int(text)
    if not 0 <= number <= 99:
        return None
    return str(number)


def _minimum_password_length():
    return _env_int("MIN_PASSWORD_LENGTH", 8, minimum=8)


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
    """Start email verification; the User row is created only after the code is confirmed."""
    from models import RegistrationVerification
    from mailer import send_registration_verification_email
    from datetime import datetime, timedelta
    import hashlib

    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not username or not email or not password:
        return jsonify(
            success=False,
            message="Username, email and password are required."
        ), 400

    if len(username) < 3 or len(username) > 100:
        return jsonify(
            success=False,
            message="Username must be between 3 and 100 characters."
        ), 400

    if not re.fullmatch(r"[A-Za-z0-9_.-]+", username):
        return jsonify(
            success=False,
            message="Username can only contain letters, numbers, dots, underscores and hyphens."
        ), 400

    if not _password_valid(password):
        return jsonify(
            success=False,
            message=f"Password must be at least {_minimum_password_length()} characters."
        ), 400

    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        return jsonify(success=False, message="Please enter a valid email address."), 400

    if User.query.filter(db.func.lower(User.email) == email).first():
        return jsonify(success=False, message="Email is already registered."), 409

    if User.query.filter_by(username=username).first():
        return jsonify(success=False, message="Username is already registered."), 409

    now = datetime.utcnow()

    # Remove expired verification requests.
    RegistrationVerification.query.filter(
        RegistrationVerification.expires_at <= now
    ).delete(synchronize_session=False)

    # A genuine retry must produce a new email. Only collapse near-simultaneous
    # duplicate submits (double click, accidental reload) into the existing
    # request — anything older gets a fresh code and a fresh send, because the
    # stored code is hashed and cannot be re-sent.
    cooldown = timedelta(seconds=_env_int("REGISTRATION_RESEND_COOLDOWN_SECONDS", 60, minimum=0))
    active = RegistrationVerification.query.filter(
        db.func.lower(RegistrationVerification.email) == email,
        RegistrationVerification.username == username,
        RegistrationVerification.verified_at.is_(None),
        RegistrationVerification.expires_at > now,
        RegistrationVerification.created_at > now - cooldown,
    ).order_by(RegistrationVerification.created_at.desc()).first()
    if active is not None:
        return jsonify(
            success=True,
            verification_id=active.id,
            choices=json.loads(active.choices_json or "[]"),
            message="We just sent your verification email. Check your inbox and spam folder.",
            existing=True,
        ), 202

    # Limit repeated registration emails for the same address.
    hour_ago = now - timedelta(hours=1)
    recent = RegistrationVerification.query.filter(
        db.func.lower(RegistrationVerification.email) == email,
        RegistrationVerification.created_at >= hour_ago
    ).count()
    if recent >= _env_int("REGISTRATION_MAX_PER_HOUR", 5, minimum=1):
        return jsonify(
            success=False,
            message="Too many verification emails. Please try again later."
        ), 429

    # Only one active request for an email at a time.
    RegistrationVerification.query.filter(
        db.func.lower(RegistrationVerification.email) == email,
        RegistrationVerification.verified_at.is_(None)
    ).update({"verified_at": now}, synchronize_session=False)

    # The user sees three choices. Only the code sent to their email is correct.
    choices = _generate_choices()
    correct_code = secrets.choice(choices)

    verification = RegistrationVerification(
        username=username,
        email=email,
        password_hash=generate_password_hash(password),
        code_hash=hashlib.sha256(correct_code.encode("utf-8")).hexdigest(),
        choices_json=json.dumps(choices),
        expires_at=now + timedelta(
            minutes=_env_int("REGISTRATION_VERIFICATION_MINUTES", 10, minimum=1)
        )
    )
    db.session.add(verification)
    db.session.commit()

    try:
        send_registration_verification_email(
            email,
            correct_code,
            username,
            _env_int("REGISTRATION_VERIFICATION_MINUTES", 10, minimum=1)
        )
    except Exception:
        db.session.delete(verification)
        db.session.commit()
        import logging
        logging.getLogger(__name__).exception(
            "Registration verification email could not be sent."
        )
        return jsonify(
            success=False,
            message="We could not send the verification email right now. Please try again later."
        ), 503

    return jsonify(
        success=True,
        verification_id=verification.id,
        choices=choices,
        message="Check your email and click the matching number."
    ), 202


@auth_bp.get("/register/verification/<int:verification_id>")
def get_registration_verification(verification_id):
    """Return the live choices for a pending verification.

    The verify page uses this instead of trusting the URL or localStorage,
    so a stale tab, an old bookmark or leftover browser state can never
    display numbers that no longer match the emailed code. The correct code
    is never returned — only the three options.
    """
    from models import RegistrationVerification
    from datetime import datetime

    now = datetime.utcnow()
    verification = db.session.get(RegistrationVerification, verification_id)

    if (
        verification is None
        or verification.verified_at is not None
        or verification.expires_at <= now
    ):
        return jsonify(
            success=False,
            restart=True,
            message="This verification request is invalid or expired."
        ), 400

    return jsonify(
        success=True,
        verification_id=verification.id,
        choices=[str(c) for c in json.loads(verification.choices_json or "[]")],
        email=verification.email,
    ), 200


@auth_bp.post("/register/resend")
def resend_registration_verification():
    """Issue a fresh code for an in-flight verification and email it again.

    The stored code is only a hash, so the original number cannot be re-sent.
    This invalidates the old row and returns a new verification_id + choices,
    which the verify page swaps in.
    """
    from models import RegistrationVerification
    from mailer import send_registration_verification_email
    from datetime import datetime, timedelta
    import hashlib

    data = request.get_json(silent=True) or {}
    try:
        verification_id = int(data.get("verification_id"))
    except (TypeError, ValueError):
        verification_id = 0

    if not verification_id:
        return jsonify(success=False, message="Nothing to resend."), 400

    now = datetime.utcnow()
    old = db.session.get(RegistrationVerification, verification_id)

    if old is None or old.verified_at is not None or old.expires_at <= now:
        return jsonify(
            success=False,
            message="This verification request expired. Please register again."
        ), 400

    # Same hourly cap as registration.
    hour_ago = now - timedelta(hours=1)
    recent = RegistrationVerification.query.filter(
        db.func.lower(RegistrationVerification.email) == old.email,
        RegistrationVerification.created_at >= hour_ago
    ).count()
    if recent >= _env_int("REGISTRATION_MAX_PER_HOUR", 5, minimum=1):
        return jsonify(
            success=False,
            message="Too many verification emails. Please try again later."
        ), 429

    if User.query.filter(db.func.lower(User.email) == old.email).first():
        return jsonify(success=False, message="Email is already registered."), 409

    minutes = _env_int("REGISTRATION_VERIFICATION_MINUTES", 10, minimum=1)
    choices = _generate_choices()
    correct_code = secrets.choice(choices)

    fresh = RegistrationVerification(
        username=old.username,
        email=old.email,
        password_hash=old.password_hash,
        code_hash=hashlib.sha256(correct_code.encode("utf-8")).hexdigest(),
        choices_json=json.dumps(choices),
        expires_at=now + timedelta(minutes=minutes)
    )
    old.verified_at = now  # consume the superseded request
    db.session.add(fresh)
    db.session.commit()

    try:
        send_registration_verification_email(
            fresh.email, correct_code, fresh.username, minutes
        )
    except Exception:
        db.session.delete(fresh)
        db.session.commit()
        import logging
        logging.getLogger(__name__).exception(
            "Registration verification email could not be resent."
        )
        return jsonify(
            success=False,
            message="We could not send the verification email right now. Please try again later."
        ), 503

    return jsonify(
        success=True,
        verification_id=fresh.id,
        choices=choices,
        message="A new verification email is on its way."
    ), 202


@auth_bp.post("/register/verify")
def verify_registration():
    """Verify the email code and create the account only after successful verification."""
    from models import RegistrationVerification
    from datetime import datetime
    import hashlib

    data = request.get_json(silent=True) or {}
    try:
        verification_id = int(data.get("verification_id"))
    except (TypeError, ValueError):
        verification_id = 0

    code = _normalize_code(data.get("code"))

    if not verification_id or code is None:
        return jsonify(
            success=False,
            message="Please choose one of the verification numbers."
        ), 400

    verification = db.session.get(RegistrationVerification, verification_id)
    now = datetime.utcnow()

    if (
        verification is None
        or verification.verified_at is not None
        or verification.expires_at <= now
    ):
        return jsonify(
            success=False,
            restart=True,
            message="This verification request is invalid or expired."
        ), 400

    choices = [str(c) for c in json.loads(verification.choices_json or "[]")]
    expected = hashlib.sha256(code.encode("utf-8")).hexdigest()

    if code not in choices or not secrets.compare_digest(expected, verification.code_hash):
        # One guess only. With three choices on screen, allowing retries would
        # let anyone brute-force the account into existence.
        verification.verified_at = now
        db.session.commit()
        return jsonify(
            success=False,
            restart=True,
            message="Incorrect verification number."
        ), 400

    # Re-check uniqueness because another account could have been created
    # while the verification screen was open.
    if User.query.filter(db.func.lower(User.email) == verification.email).first():
        verification.verified_at = now
        db.session.commit()
        return jsonify(success=False, restart=True,
                       message="Email is already registered."), 409

    if User.query.filter_by(username=verification.username).first():
        verification.verified_at = now
        db.session.commit()
        return jsonify(success=False, restart=True,
                       message="Username is already registered."), 409

    user = User(
        username=verification.username,
        email=verification.email,
        password=verification.password_hash,
        role="user",
        token_version=0,
    )
    db.session.add(user)
    verification.verified_at = now
    db.session.commit()

    return jsonify(
        success=True,
        message="Account verified successfully.",
        **_tokens_for(user)
    ), 201


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