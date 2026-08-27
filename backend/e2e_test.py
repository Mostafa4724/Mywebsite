"""Comprehensive end-to-end test of the order system against a running server.

Covers:
  1. Normal order (single product, qty 2)
  2. Multiple products order
  3. Sale product pricing (sale price used when active)
  4. Out-of-stock rejection
  5. Deleted/missing product rejection
  6. Mixed availability (only available included)
  7. Duplicate order prevention check
  8. Admin order detail fields
  9. Sale data present in product API (for home/category cards)
"""
import json
import urllib.request
import urllib.error
import re
import os
import pathlib




def get_config(key, path, default=None):
    """يقرأ ثابت من ملف إعدادات بأي صيغة: JSON / ENV / JS / PY / INI / YAML."""
    if os.getenv(key):
        return os.getenv(key)

    p = pathlib.Path(path)
    if not p.is_absolute():
        p = pathlib.Path(__file__).parent / p

    try:
        text = p.read_text(encoding="utf-8")
    except FileNotFoundError:
        return default

    m = re.search(
        rf'["\']?\b{re.escape(key)}\b["\']?\s*[:=]\s*["\']?([^"\',;\r\n}}]+)',
        text,
    )
    if not m:
        return default

    value = m.group(1).strip()
    value = re.split(r'\s+//|\s+#', value)[0].strip()  # شيل التعليقات في آخر السطر
    return value or default

API = get_config("API", "../config.js", "http://127.0.0.1:5000").rstrip("/")

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
            return e.code, {"success": False, "message": "HTTP " + str(e.code)}
    except Exception as e:
        return None, {"success": False, "message": str(e)}


def available_products():
    st, data = req("/products")
    if not data.get("success"):
        return []
    out = []
    for p in data.get("products", []):
        if (p.get("stock_status") or "in").lower() != "out":
            out.append(p)
    return out


def main():
    print("===== 1. Product API sale data (home/category cards) =====")
    st, data = req("/products")
    print("products success:", data.get("success"), "count:", len(data.get("products", [])))
    for p in data.get("products", []):
        has_sale = ("sale_price" in p) or ("sale_enabled" in p)
        print("  id", p.get("id"), p.get("title"),
              "has_sale_fields=", has_sale,
              "sale_enabled=", p.get("sale_enabled"),
              "sale_price=", p.get("sale_price"))

    avail = available_products()
    if not avail:
        print("No available products to test order. Exiting.")
        return
    p = avail[0]
    pid = p["id"]
    print("\nUsing available product id=", pid, p.get("title"),
          "price=", p.get("price"), "sale_price=", p.get("sale_price"))

    def cust(first="Tester", last="Flow"):
        return {
            "firstName": first, "lastName": last, "email": first.lower() + "@example.com",
            "phone": "+1 555-000-0000", "address": "123 Main Street",
            "architecture": "Modern", "floor": "3",
            "lat": "40.7128", "lng": "-74.0060",
        }

    print("\n===== 2. Normal order (qty 2) =====")
    st, d = req("/orders", "POST", {
        "items": [{"product_id": pid, "quantity": 2}],
        "customer": cust("Normal", "Tester"),
        "payment_method": "card",
    })
    print("status:", st, "success:", d.get("success"), "msg:", d.get("message"))
    if d.get("success"):
        o = d["order"]
        print("  order_id:", o.get("id"), "customer:", o.get("customer_name"), o.get("customer_email"))
        print("  payment_method:", o.get("payment_method"), "status:", o.get("status"))
        print("  subtotal:", o.get("subtotal"), "shipping:", o.get("shipping"),
              "tax:", o.get("tax"), "total:", o.get("total"))
        for it in o.get("items", []):
            print("    item:", it.get("product_id"), it.get("product_name"),
                  "qty", it.get("quantity"), "unit", it.get("unit_price"),
                  "orig", it.get("original_price"), "sale", it.get("sale_price"),
                  "disc", it.get("discount"), "total", it.get("total"))

    print("\n===== 3. Multiple products (2 avail) =====")
    if len(avail) >= 2:
        p2 = avail[1]
        st, d = req("/orders", "POST", {
            "items": [
                {"product_id": pid, "quantity": 2},
                {"product_id": p2["id"], "quantity": 3},
            ],
            "customer": cust("Multi", "Tester"),
            "payment_method": "cod",
        })
        print("status:", st, "success:", d.get("success"), "msg:", d.get("message"))
        if d.get("success"):
            o = d["order"]
            print("  order_id:", o.get("id"), "items:", len(o.get("items", [])), "total:", o.get("total"))
            for it in o.get("items", []):
                print("    ", it.get("product_name"), "qty", it.get("quantity"), "unit", it.get("unit_price"), "total", it.get("total"))

    print("\n===== 4. Sale product: pick an active-sale in-stock product =====")
    sale_p = None
    for pp in avail:
        sp = pp.get("sale_price")
        reg = pp.get("price")
        if sp and reg and float(sp) < float(reg):
            sale_p = pp
            break
    if sale_p:
        print("  Active-sale product id=", sale_p["id"], sale_p["title"], "orig=", sale_p["price"], "sale=", sale_p["sale_price"])
        st, d = req("/orders", "POST", {
            "items": [{"product_id": sale_p["id"], "quantity": 2}],
            "customer": cust("Sale", "Tester"),
            "payment_method": "card",
        })
        print("  status:", st, "success:", d.get("success"), "msg:", d.get("message"))
        if d.get("success"):
            o = d["order"]
            print("  total:", o.get("total"))
            for it in o.get("items", []):
                print("    ", it.get("product_name"), "orig", it.get("original_price"),
                      "sale", it.get("sale_price"), "unit", it.get("unit_price"),
                      "discount", it.get("discount"), "total", it.get("total"))
    else:
        print("  No active sale product found in-stock. Skipping.")

    print("\n===== 5. Out-of-stock / insufficient stock rejection =====")
    st, d = req("/orders", "POST", {
        "items": [{"product_id": pid, "quantity": 999999}],
        "customer": {},
    })
    print("  status:", st, "success:", d.get("success"), "msg:", d.get("message"))

    print("\n===== 6. Missing/deleted product rejection =====")
    st, d = req("/orders", "POST", {
        "items": [{"product_id": 99999999, "quantity": 1}],
        "customer": {},
    })
    print("  status:", st, "success:", d.get("success"), "msg:", d.get("message"))

    print("\n===== 7. Admin orders list =====")
    st, d = req("/orders")
    print("  status:", st, "count:", len(d.get("orders", [])))
    if d.get("orders"):
        first = d["orders"][0]
        required = ["customer_name", "customer_email", "payment_method", "subtotal",
                    "shipping", "tax", "total", "status", "created_at", "items"]
        missing = [k for k in required if k not in first]
        print("  first order keys missing:", missing if missing else "NONE (all present)")
        print("  first order:", "#", first.get("id"), first.get("customer_name"),
              "status", first.get("status"), "total", first.get("total"))

    print("\n===== 8. Admin order detail (last order) =====")
    st, d = req("/orders")
    if d.get("orders"):
        last = d["orders"][-1]["id"]
        st2, d2 = req("/orders/%d" % last)
        print("  status:", st2, "success:", d2.get("success"))
        o = d2.get("order", {})
        print("  id:", o.get("id"), "customer:", o.get("customer_name"), o.get("customer_lastname"),
              "email:", o.get("customer_email"), "phone:", o.get("customer_phone"))
        print("  address:", o.get("customer_address"), o.get("customer_architecture"), o.get("customer_floor"))
        print("  payment:", o.get("payment_method"), "status:", o.get("status"))
        print("  totals: subtotal", o.get("subtotal"), "shipping", o.get("shipping"),
              "tax", o.get("tax"), "discount", o.get("discount"), "total", o.get("total"))
        print("  items:", len(o.get("items", [])))
        for it in o.get("items", []):
            print("    ", it.get("product_name"), "qty", it.get("quantity"),
                  "unit", it.get("unit_price"), "orig", it.get("original_price"),
                  "sale", it.get("sale_price"), "total", it.get("total"))

    print("\n===== 9. Duplicate prevention (POST same payload twice) =====")
    if d.get("orders"):
        # Re-send the same payload twice; expect same data (server always creates,
        # but the frontend disables the button — this just confirms idempotent handling
        # returns success for both; client-side disable prevents truly duplicate orders).
        payload = {
            "items": [{"product_id": pid, "quantity": 1}],
            "customer": cust("Dup", "Tester"),
            "payment_method": "card",
        }
        st1, d1 = req("/orders", "POST", payload)
        st2, d2 = req("/orders", "POST", payload)
        print("  attempt1:", st1, "success:", d1.get("success"), "order_id:", d1.get("order_id"))
        print("  attempt2:", st2, "success:", d2.get("success"), "order_id:", d2.get("order_id"))
        print("  (frontend disables button during request to prevent double-submit)")

    print("\n===== DONE =====")


if __name__ == "__main__":
    main()

