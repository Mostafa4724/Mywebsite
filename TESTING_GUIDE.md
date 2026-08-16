# Website security and full-project test plan

## Start
1. Set SECRET_KEY and JWT_SECRET_KEY in PowerShell.
2. Set ADMIN_USERNAME, ADMIN_EMAIL, ADMIN_PASSWORD.
3. From `backend`, run `python create_admin.py`.
4. Run `python app.py`.
5. Open the site.

## Authentication
1. Open `page/login.html`.
2. Use Create account to make a normal user.
3. Confirm it redirects to the shop.
4. Check DevTools > Application > Local Storage for `token`.
5. Log out/clear the token and confirm protected actions require login.
6. Log in with the admin account and confirm it redirects to the admin dashboard.
7. Try a normal user's credentials in the admin login; it must not open the dashboard.

## Authorization
1. Normal user must not create products.
2. Normal user must not update order status.
3. Normal user must only receive their own orders.
4. Normal user must not retrieve another user's order.
5. Admin may retrieve/manage all orders.

## Order ownership
1. Create an order while logged in as a user.
2. Confirm its `user_id` matches the JWT user, regardless of any frontend `user_id` field.
3. Try changing a request's `user_id`; it must not change ownership.

## Admin bootstrap
`/create-admin` must not exist.
Admin creation is only through `backend/create_admin.py`.

## Production
Run Flask with debug disabled.
Do not commit `.env` or real secrets.
