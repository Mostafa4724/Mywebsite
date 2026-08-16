"""Final verification: (A) active-sale pricing in an order, and (B) admin
status update. Uses product 14 (SaleTest2) which has an active sale window
(start 2026-08-08, end 2026-08-10, now 2026-08-09)."""
import json
import urllib.request
import urllib.error

API = "http://127.0.0.1:5000"


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


print("=== PART A: Active-sale pricing in an order (product 14) ===")
_, pd = req("/products/14")
prod = pd.get("product", {})
print("Product:", prod.get("title"), "price=", prod.get("price"),
      "sale_price=", prod.get("sale_price"), "sale_enabled=", prod.get("sale_enabled"),
      "start=", prod.get("sale_start"), "end=", prod.get("sale_end"))

st, d = req("/orders", "POST", {
    "items": [{"product_id": 14, "quantity": 2}],
    "customer": {
        "firstName": "Active", "lastName": "Sale",
        "email": "active@example.com", "phone": "555",
        "address": "1 St", "architecture": "Modern", "floor": "2",
        "lat": "40.7", "lng": "-74.0",
    },
    "payment_method": "card",
})
print("POST status:", st, "success:", d.get("success"))
if d.get("success"):
    o = d["order"]
    for it in o.get("items", []):
        print("  item:", it.get("product_name"), "qty", it.get("quantity"),
              "orig", it.get("original_price"), "sale", it.get("sale_price"),
              "unit", it.get("unit_price"), "discount", it.get("discount"),
              "total", it.get("total"))
    print("  order total:", o.get("total"), "| payment:", o.get("payment_method"))
    oid = o["id"]

    print("\n=== PART B: Admin status update (pending -> processing) ===")
    st2, d2 = req("/orders/%d/status" % oid, "PUT", {"status": "processing"})
    print("PUT status:", st2, "success:", d2.get("success"), "msg:", d2.get("message"))
    if d2.get("success"):
        print("  new status:", d2["order"].get("status"))

    print("\n=== PART C: Invalid status rejected ===")
    st3, d3 = req("/orders/%d/status" % oid, "PUT", {"status": "bogus"})
    print("PUT bad status:", st3, "success:", d3.get("success"), "msg:", d3.get("message"))

    print("\n=== PART D: Order reflects updated status ===")
    st4, d4 = req("/orders/%d" % oid)
    print("GET order status:", d4.get("order", {}).get("status"))
