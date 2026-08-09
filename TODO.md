# TODO — Complete Order System + Sales Fix

## Backend
- [x] Inspect existing models, routes, DB schema
- [x] models.py: extend Order (customer info, pricing breakdown, timestamps, relationship) + OrderItem (product_name, original_price, sale_price, discount, unit_price, total)
- [x] app.py: add migrate() column-ensure for orders/order_items
- [x] orders.py: rewrite POST /orders (customer info, server-side validation, pricing), add GET /orders, GET /orders/<id>, PUT /orders/<id>/status

## Frontend — Checkout
- [x] script.js: fix double add-to-cart binding (ensure productId), empty-checkout messaging
- [x] checkout-form.js: gather customer info and forward to placeOrder()
- [x] script.js placeOrder(): send customer info + items to backend

## Admin
- [x] admin/orders.html: load real orders from backend, render table, link view-order.html?id=N
- [x] admin/view-order.html + view-order.js: load selected order from backend, render customer/items/pricing/status

## Sales
- [x] Verify sale display on home.html + catagory-species.html (shared renderer)

## Testing
- [x] Start server, run full order flow (normal, multi-product, sale, out-of-stock, deleted, duplicate)
- [x] Verify admin orders list + view-order + status update
- [x] Verify sale on home + category
