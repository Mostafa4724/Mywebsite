# TODO — Fix products incorrectly marked as Out of Stock

## Steps
- [x] 1. Fix `isProductAvailable()` in `script.js` to respect the actual `stock_status` field (in/low = available, out = unavailable, missing product = unavailable).
- [x] 2. Update `buildCartItemState()` statusText in `script.js` to use `stock_status` for consistency.
- [x] 3. Update `edit_product` in `backend/products.py` to persist `stock_status` (and `status`) so the admin Out-of-Stock toggle is saved.
- [x] 4. Test the 5 cases (available / out-of-stock / removed / re-available / mixed).
