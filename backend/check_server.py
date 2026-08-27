import re
import os
import pathlib
import urllib.request
import urllib.error



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


if __name__ == "__main__":
    st, data = req("/products")
    if st is None:
        print("NO_SERVER:", data.get("message"))
    else:
        prods = data.get("products", [])
        print("SERVER_OK status=", st, "count=", len(prods))
        # Show first few products with sale info
        for p in prods[:5]:
            print("  id=", p.get("id"), "title=", p.get("title"),
                  "price=", p.get("price"), "sale_price=", p.get("sale_price"),
                  "sale_enabled=", p.get("sale_enabled"),
                  "stock_status=", p.get("stock_status"),
                  "status=", p.get("status"))
        # Check orders
        st2, d2 = req("/orders")
        print("ORDERS status=", st2, "count=", len(d2.get("orders", [])))
