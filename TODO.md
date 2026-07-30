# TODO - Home Page Product Card Navigation & Add to Cart

## Steps

### Step 1: Update `page/home.html` ✅
- Add `data-name`, `data-price`, `data-image` attributes to each `.product-card`
- Wrap card content (except button) in a clickable link/div that navigates to `product.html?name=...&price=...&image=...`
- Keep "Add To Cart" button with `add-to-cart-btn` class for add-to-cart functionality

### Step 2: Update `stylle.css` ✅
- Add `.product-card-link` styles for the clickable card link
- Add `.product-card .add-to-cart-btn` styles for the cart buttons

### Step 3: Update `script.js` ✅
- Add `initHomePage()` function:
  - Attaches click handlers to `.add-to-cart-btn` buttons → calls `addToCart()` with data attributes
- Add `loadProductFromURL()` function:
  - Reads URL params and updates product page DOM (#product-name, #product-price, #product-image)
  - Updates about section description and features based on `productDataMap`
- Add `productDataMap` with descriptions for all 4 products
- Wire up in `DOMContentLoaded` for both home page and product page

### Step 4: Test ⬜
- ✅ Card click → navigates to `product.html?name=...&price=...&image=...` (via `<a>` href)
- ✅ Product page loads data from URL params and updates DOM dynamically
- ✅ Add to Cart on home page works via data attributes
- Verify the "Add to Cart" on product page also works (uses existing `initAddToCart()`)


