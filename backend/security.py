from functools import wraps
from flask import jsonify
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity
from models import User

def current_user():
    identity = get_jwt_identity()
    if identity is None:
        return None
    try:
        return User.query.get(int(identity))
    except (TypeError, ValueError):
        return None

def user_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        verify_jwt_in_request()
        user = current_user()
        if user is None:
            return jsonify(success=False, message="Authenticated user not found"), 401
        return fn(*args, **kwargs)
    return wrapper

def admin_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        verify_jwt_in_request()
        user = current_user()
        if user is None:
            return jsonify(success=False, message="Authenticated user not found"), 401
        if getattr(user, "role", None) != "admin":
            return jsonify(success=False, message="Admin permission required"), 403
        return fn(*args, **kwargs)
    return wrapper
