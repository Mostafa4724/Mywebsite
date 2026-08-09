# Category System Implementation

Goal: Dynamic categories from a real backend/database, linked to products by `category_id`, surfaced in admin (add/edit), `category.html`, and `catagory-species.html`.

## Steps

- [x] 1. Backend: Add `Category` model + `category_id` FK on `Product` (`backend/models.py`)
- [x] 2. Backend: Create `backend/categories.py` blueprint (GET all, GET by id, POST create with validation)
- [x] 3. Backend: Register blueprint + add idempotent migration for `products.category_id` (`backend/app.py`)
- [x] 4. Backend: Update `backend/products.py` — filter by `category_id`, set `category_id`+`category` on create/edit
- [x] 5. Admin: `admin/add.html` — remove static categories, add `+ Add Category` option + modal markup
- [x] 6. Admin: `admin/add.js` — load categories, modal create flow, submit `category_id`
- [x] 7. Admin: `admin/edit.html` + `edit-product.js` — dynamic category dropdown
- [x] 7b. Admin: Add `addCategoryModal` markup to `admin/add.html` + modal CSS in `stylle.css`
- [x] 8. Shop: `page/Catagory.html` — remove hardcoded cards, add empty container
- [x] 9. Shop: `page/category.js` — load categories + counts, render cards -> `catagory-species.html?category=<id>`
- [x] 10. Shop: `page/catagory-species.html` — rewrite to reuse `home.html` styling + container
- [x] 11. Shop: `page/catagory-species.js` — read `?category=`, fetch filtered products, render home-style cards, empty state
- [x] 12. Test the full admin -> category -> product -> user flow (via running backend)

