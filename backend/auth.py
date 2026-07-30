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