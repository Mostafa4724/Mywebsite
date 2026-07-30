from flask import Blueprint, request, jsonify

from models import Product
from database import db
from security import admin_required

products_bp = Blueprint("products", __name__)

@products_bp.route("/products", methods=["GET"])
def get_products():

    products = Product.query.all()

    return jsonify({

        "success": True,

        "products": [

            product.to_dict()

            for product in products

        ]

    })

@products_bp.route("/products/<int:id>", methods=["GET"])
def get_product(id):

    product = Product.query.get(id)

    if product is None:

        return jsonify({

            "success": False,

            "message": "Product not found"

        }),404

    return jsonify({

        "success": True,

        "product": product.to_dict()

    })

@products_bp.route("/admin/products", methods=["POST"])
@admin_required
def add_product():

    data = request.get_json()

    product = Product(

        title=data["title"],

        description=data.get("description",""),

        category=data.get("category",""),

        price=float(data["price"]),

        stock=int(data["stock"]),

        image=data.get("image","")

    )

    db.session.add(product)

    db.session.commit()

    return jsonify({

        "success": True,

        "message": "Product added",

        "product": product.to_dict()

    })

@products_bp.route("/admin/products/<int:id>", methods=["PUT"])
@admin_required
def edit_product(id):

    product = Product.query.get(id)

    if product is None:

        return jsonify({

            "success":False,

            "message":"Product not found"

        }),404

    data = request.get_json()

    product.title = data.get("title",product.title)

    product.description = data.get("description",product.description)

    product.category = data.get("category",product.category)

    product.price = float(

        data.get("price",product.price)

    )

    product.stock = int(

        data.get("stock",product.stock)

    )

    product.image = data.get(

        "image",

        product.image

    )

    db.session.commit()

    return jsonify({

        "success":True,

        "message":"Product updated",

        "product":product.to_dict()

    })

@products_bp.route("/admin/products/<int:id>", methods=["DELETE"])
@admin_required
def delete_product(id):

    product = Product.query.get(id)

    if product is None:

        return jsonify({

            "success":False,

            "message":"Product not found"

        }),404

    db.session.delete(product)

    db.session.commit()

    return jsonify({

        "success":True,

        "message":"Product deleted"

    })

