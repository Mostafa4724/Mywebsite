from functools import wraps

from flask import jsonify
from flask_jwt_extended import (
    get_jwt,
    get_jwt_identity,
    verify_jwt_in_request,
)

from models import User


def current_user():
    identity = get_jwt_identity()
    if identity is None:
        return None

    try:
        user = User.query.get(int(identity))
    except (TypeError, ValueError):
        return None

    if user is None:
        return None

    claims = get_jwt()
    token_version = claims.get("tv", 0)
    if int(token_version or 0) != int(getattr(user, "token_version", 0) or 0):
        return None

    return user


def current_user_optional():
    """Return the signed-in user if a valid JWT is present, or None.

    Never raises. Useful on endpoints that serve both anonymous and
    authenticated callers with slightly different data -- e.g. /products
    filtering out drafts for anonymous callers but returning them to
    admins so the same route powers the storefront and the admin panel.
    """
    try:
        verify_jwt_in_request(optional=True)
    except Exception:
        # A malformed or expired token isn't an error at this layer:
        # the caller just isn't signed in.
        return None
    return current_user()


def user_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        verify_jwt_in_request()
        user = current_user()
        if user is None:
            return jsonify(success=False, message="Session is no longer valid."), 401
        return fn(*args, **kwargs)
    return wrapper


def admin_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        verify_jwt_in_request()
        user = current_user()
        if user is None:
            return jsonify(success=False, message="Session is no longer valid."), 401
        if getattr(user, "role", None) != "admin":
            return jsonify(success=False, message="Admin permission required"), 403
        return fn(*args, **kwargs)
    return wrapper
