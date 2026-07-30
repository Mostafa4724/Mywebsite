from functools import wraps

from flask import jsonify

from flask_jwt_extended import (
    verify_jwt_in_request,
    get_jwt_identity
)

from models import User


def admin_required(func):

    @wraps(func)

    def wrapper(*args, **kwargs):

        verify_jwt_in_request()

        user_id = get_jwt_identity()

        user = User.query.get(user_id)

        if user is None:

            return jsonify({

                "success": False,

                "message": "User not found"

            }),404

        if user.role != "admin":

            return jsonify({

                "success": False,

                "message": "Admin permission required"

            }),403

        return func(*args, **kwargs)

    return wrapper