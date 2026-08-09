# TODO — Fix Product Sales + Card Navigation

## Investigation (DONE)
- [x] Inspected add.html/add.js sale-saving flow
- [x] Inspected backend/product model/API sale fields (all returned correctly)
- [x] Inspected home.js vs catagory-species.js card rendering (duplicated)
- [x] Confirmed Bug 2: category card only title wrapped in link
- [x] Confirmed Bug 1: duplicated rendering causes inconsistent sale display

## Implementation
- [ ] Add shared `isSaleActive` + `renderProductCardHTML` to script.js
- [ ] Rewrite home.js to use shared renderer
- [ ] Rewrite catagory-species.js to use shared renderer
- [ ] Add CSS for clickable card wrapper in catagory-species.css
- [ ] Verify sales display + navigation + cart/checkout

## Testing
- [ ] Test product without sale (Mouse $50)
- [ ] Test product with sale (Orig $100 / Sale $75)
- [ ] Test click category product -> product.html
- [ ] Test same product from home + category -> same product page
- [ ] Test sale product from category -> sale price in cart/buy now/checkout

