# Account Isolation Fix

- Cart and Buy-Now sessionStorage are now scoped by the authenticated JWT `sub` (user id).
- Legacy global `shopping_cart` and `buy_now_checkout` keys are removed on login and are no longer read.
- `POST /orders` already uses the logged-in JWT identity for `Order.user_id`.
- `GET /orders` returns all orders only to admins; normal users receive only their own orders.
- `GET /orders/<id>` returns the order only to its owner or an admin. Other users receive 404 so order existence is not disclosed.

## Test
1. Log in as User A, add products to cart, and create an order.
2. Log in as User B in the same browser without clearing sessionStorage.
3. User B must see an empty/different cart and must not see User A's order.
4. Log back in as User A. User A's account-scoped cart should be restored.
5. As User B, manually request User A's order id with `GET /orders/<id>` and expect 404.
6. As admin, `GET /orders` should show all orders.
