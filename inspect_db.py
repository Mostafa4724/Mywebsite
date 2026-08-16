import sqlite3
c = sqlite3.connect(r'c:/Users/kc/My website/database/shopping.db')
conn = c.cursor()
for name in ['products','orders','order_items','categories','users','cart']:
    row = conn.execute("SELECT sql FROM sqlite_master WHERE name=?", (name,)).fetchone()
    print("=====" + name + "=====")
    print(row[0] if row else "NOT FOUND")
print("=====PRODUCT SAMPLES=====")
try:
    for r in conn.execute("SELECT id, title, price, sale_price, sale_enabled, stock_status, status, category_id FROM products LIMIT 30"):
        print(r)
except Exception as e:
    print("ERR", e)
print("=====ORDERS COUNT=====")
try:
    print(conn.execute("SELECT COUNT(*) FROM orders").fetchone())
except Exception as e:
    print("ERR", e)

