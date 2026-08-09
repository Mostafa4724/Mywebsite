import sqlite3

c = sqlite3.connect(r'c:/Users/kc/My website/database/shopping.db')
conn = c.cursor()
print("===== PRODUCT SALE FIELDS =====")
for r in conn.execute(
    "SELECT id, title, price, sale_price, sale_enabled, sale_start, sale_end, "
    "stock_status, status FROM products ORDER BY id"
):
    print(r)

print("\n===== ORDERS (all columns) =====")
for r in conn.execute("SELECT * FROM orders ORDER BY id"):
    print(r)

print("\n===== ORDER_ITEMS (all columns) =====")
for r in conn.execute("SELECT * FROM order_items ORDER BY id"):
    print(r)
