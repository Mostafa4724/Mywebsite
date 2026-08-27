"""End-to-end test of the order flow + sales using real API calls.

Requires the Flask server to already be running on the configured API domain.
Start it with:  python app.py   (from the backend dir)
"""
import json
import urllib.request
import urllib.error
import os
import pathlib
import re


def get_config(key, path, default=None):
    env_value = os.getenv(key)
    if env_value:
        return env_value.rstrip("/")

    p = pathlib.Path(path)
    if not p.is_absolute():
        p = pathlib.Path(__file__).parent / p

    try:
        text = p.read_text(encoding="utf-8")
    except (FileNotFoundError, OSError):
        return default

    pattern = (r'(?:export\s+)?(?:const|let|var)\s+' + re.escape(key) +
               r'\s*=\s*["\']([^"\']+)["\']|' +
               r'["\']' + re.escape(key) + r'["\']\s*:\s*["\']([^"\']+)["\']|' +
               r'(?:^|[\n\r])\s*' + re.escape(key) + r'\s*=\s*([^\s#;]+)')
    m = re.search(pattern, text, flags=re.I)
    if not m:
        return default

    value = next((g for g in m.groups() if g is not None), default)
    return str(value).strip().rstrip("/") if value else default


API = get_config("API", "../config.js", "http://127.0.0.1:5000")


def req(path, method="GET", body=None):
    url = API + path
    data = None
    headers = {}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode("utf-8"))
        except Exception:
            return e.code, {"success": False, "message": e.read().decode("utf-8")}


def main():
    print("=== 1. List current products ===")
    _, data = req("/products")
    products = data.get("products", [])

    product_id = None
    for p in products:
        if p.get("title") and p.get("id"):
            product_id = p["id"]
            break

    if product_id is None:
        print("No products found. Cannot test order. Please add a product via admin add.html first.")
        # If no products, still test the /orders list and empty-vs-validations
        st, d = req("/orders")
        print("GET /orders status:", st, "-> success:", d.get("success"), "count:", len(d.get("orders", [])))
        return

    print(f"Using product id={product_id}")

    # Grab product info to know price/sale
    _, pdata = req(f"/products/{product_id}")
    prod = pdata.get("product", {})
    print("Product title:", prod.get("title"), "price:", prod.get("price"), "sale:", prod.get("sale_price"),
          "sale_enabled:", prod.get("sale_enabled"), "stock_status:", prod.get("stock_status"))

    # ---- Test: Normal order ----
    print("\n=== 2. POST /orders (normal, 2 qty) ===")
    st, d = req("/orders", "POST", {
        "items": [{"product_id": product_id, "quantity": 2}],
        "customer": {
            "firstName": "Mohamed",
            "lastName": "Ali",
            "email": "mohamed@example.com",
            "phone": "+1 555-000-1111",
            "address": "123 Main Street",
            "architecture": "Modern",
            "floor": "3",
            "lat": "40.7128",
            "lng": "-74.0060",
        },
        "payment_method": "card",
    })
    print("status:", st, "-> success:", d.get("success"), "message:", d.get("message"))
    if d.get("success"):
        order_id = d["order_id"]
        print("Order id:", order_id, "total:", d.get("total"))
        o = d["order"]
        print("  customer_name:", o.get("customer_name"), "email:", o.get("customer_email"))
        print("  subtotal:", o.get("subtotal"), "shipping:", o.get("shipping"), "tax:", o.get("tax"), "total:", o.get("total"))
        print("  items count:", len(o.get("items", [])))
        for it in o.get("items", []):
            print("    -", it.get("product_name"), "qty", it.get("quantity"), "unit", it.get("unit_price"),
                  "original", it.get("original_price"), "sale", it.get("sale_price"), "total", it.get("total"))

        # ---- Test: GET /orders list ----
        print("\n=== 3. GET /orders ===")
        st2, d2 = req("/orders")
        print("status:", st2, "-> count:", len(d2.get("orders", [])))

        # ---- Test: GET /orders/<id> ----
        print("\n=== 4. GET /orders/{id} ===")
        st3, d3 = req(f"/orders/{order_id}")
        print("status:", st3, "-> success:", d3.get("success"))
        if d3.get("success"):
            od = d3["order"]
            print("  order #:", od.get("id"), "status:", od.get("status"), "payment:", od.get("payment_method"))
            print("  customer:", od.get("customer_name"), od.get("customer_email"))
            print("  total:", od.get("total"))

        # ---- Test: PUT /orders/<id>/status ----
        print("\n=== 5. PUT /orders/{id}/status (processing) ===")
        st4, d4 = req(f"/orders/{order_id}/status", "PUT", {"status": "processing"})
        print("status:", st4, "-> success:", d4.get("success"), "new status:", d4.get("order", {}).get("status"))

# ---- Test: Sale product order (active sale) ----
    print("\n=== 5b. POST /orders with active-sale product id=14 ===")
    stS, dS = req("/orders", "POST", {
        "items": [{"product_id": 14, "quantity": 2}],
        "customer": {
            "firstName": "Mona",
            "lastName": "S",
            "email": "mona@example.com",
            "phone": "111",
            "address": "Addr",
            "architecture": "Mod",
            "floor": "1",
            "lat": "1",
            "lng": "2",
        },
        "payment_method": "cod",
    })
    print("status:", stS, "-> success:", dS.get("success"))
    if dS.get("success"):
        o = dS["order"]
        print("  total:", o.get("total"), "subtotal:", o.get("subtotal"))
        for it in o.get("items", []):
            print("    -", it.get("product_name"), "unit", it.get("unit_price"),
                  "orig", it.get("original_price"), "sale", it.get("sale_price"),
                  "disc", it.get("discount"), "total", it.get("total"))
        print("  order_id:", o.get("id"))

    # ---- Test: Out of stock rejection (a synthetic fake quantity order) ----
    print("\n=== 6. POST /orders (invalid/out-of-stock simulation) ===")
    # Use a huge quantity to trigger insufficient-stock rejection (if stock field exists).
    st5, d5 = req("/orders", "POST", {
        "items": [{"product_id": product_id, "quantity": 99999}],
        "customer": {},
    })
    print("status:", st5, "-> success:", d5.get("success"), "message:", d5.get("message"))
    if d5.get("success"):
        print("NOTE: order with huge qty was accepted (stock may not be enforced). Check stock value.")
    else:
        print("Rejected as expected (no partial order created).")


if __name__ == "__main__":
    main()

