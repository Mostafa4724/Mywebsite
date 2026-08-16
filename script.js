// ===== Account-isolatated user's JWT subject.
// This prevents User A's cart from appearing when User B logs into the
// same browser. The backend remains the security authority for orders.
function getCurrentAccountId() {
    const token = sessionStorage.getItem("token");
  if (!token) return null;

  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    const claims = JSON.parse(atob(padded));
    return claims.sub != null ? String(claims.sub) : null;
  } catch {
    return null;
  }
}

function getCartStorageKey() {
  const accountId = getCurrentAccountId();
  return accountId ? `shopping_cart_user_${accountId}` : null;
}

function getBuyNowStorageKey() {
  const accountId = getCurrentAccountId();
  return accountId ? `buy_now_checkout_user_${accountId}` : null;
}

function getCart() {
  const key = getCartStorageKey();
  if (!key) return [];
  try {
    return JSON.parse(sessionStorage.getItem(key)) || [];
  } catch {
    return [];
  }
}

function saveCart(cart) {
  const key = getCartStorageKey();
  if (key) {
    sessionStorage.setItem(key, JSON.stringify(cart));
  }
  updateCartBubble();
}

const SHOP_API_BASE = "http://127.0.0.1:5000";
let _allProductsCache = null;
let _productByIdCache = {};

function generateId(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ==========================================================================
// SHARED PRODUCT-CARD SYSTEM
// --------------------------------------------------------------------------
// Single source of truth for how product cards are rendered on home.html and
// catagory-species.html (and any future page). Both pages load /script.js, so
// they share the exact same markup, sale logic, and navigation so the cards
// look and behave identically everywhere.
// ==========================================================================

// A sale is considered ACTIVE when there's a valid lower sale price and we are
// within the optional sale_start/sale_end window. This mirrors what cart,
// buy-now and checkout use when picking the current price, so the price shown
// on the card always matches what is charged.
function isSaleActive(product) {
  if (!product) return false;
  const salePrice = Number(product.sale_price ?? 0);
  const regularPrice = Number(product.price ?? 0);
  const hasValidSalePrice = salePrice > 0 && regularPrice > salePrice;
  if (!hasValidSalePrice) return false;

  const now = new Date();

  if (product.sale_start) {
    const start = new Date(product.sale_start);
    if (!Number.isNaN(start.getTime()) && now < start) return false;
  }

  if (product.sale_end) {
    const end = new Date(product.sale_end);
    if (!Number.isNaN(end.getTime()) && now > end) return false;
  }

  return true;
}

// Returns the current displayed/charged price for a product (sale price when
// the sale is active, otherwise the regular price). Kept in sync with the
// price used by addToCart / checkout so the card price always matches.
function getDisplayPrice(product) {
  const saleActive = isSaleActive(product);
  const salePrice = Number(product.sale_price ?? 0);
  const regularPrice = Number(product.price ?? 0);
  return saleActive && salePrice > 0 ? salePrice : regularPrice;
}

// Builds the HTML string for a product card, producing the SAME structure that
// home.css was designed for (so home.html keeps its exact styling):
//
//   .product-card
//     a.product-card-link          (whole info area clickable -> product.html?id=..)
//       img
//       h3                          (title)
//       .price-row                  (current price + optional original price)
//         p.price
//         p.original-price
//       .sale-info                  (sale chip + discount, only when sale active)
//         span.sale-chip
//         span.sale-discount
//     button.add-to-cart-btn        (sibling, add to cart)
//
// catagory-species.css includes matching rules for this same structure so the
// category cards look and behave identically to the home cards.
// Returns: { html, image, displayPrice, onSale, outOfStock }
function buildProductCard(product, index) {
  const image =
    product.image && product.image !== ""
      ? SHOP_API_BASE + "/uploads/products/" + product.image
      : "https://picsum.photos/300/250?random=" + product.id;

  const originalPrice = Number(product.price || 0);
  const salePrice = Number(product.sale_price || 0);
  const saleActive = isSaleActive(product);
  const displayPrice = saleActive && salePrice > 0 ? salePrice : originalPrice;
  const discountPercent =
    saleActive && originalPrice > 0
      ? Math.round(((originalPrice - displayPrice) / originalPrice) * 100)
      : 0;

  const stockStatus = (product.stock_status || "in").toLowerCase();
  const outOfStock = stockStatus === "out";

  // Price row: sale price + crossed-out original when sale active.
  const priceHTML =
    '<div class="price-row">' +
    '<p class="price">$' +
    displayPrice.toFixed(2) +
    "</p>" +
    (saleActive && product.sale_price
      ? '<p class="original-price">$' + originalPrice.toFixed(2) + "</p>"
      : "") +
    "</div>";

  // Sale info banner: sale chip (uses saved badge color/text) + discount.
  const saleHTML =
    saleActive && product.sale_price
      ? '<div class="sale-info">' +
        '<span class="sale-chip" style="background:' +
        (product.sale_badge_color || "#dc2626") +
        ';">' +
        (product.sale_badge || "Sale") +
        "</span>" +
        '<span class="sale-discount">Save ' +
        discountPercent +
        "%</span>" +
        "</div>"
      : "";

  return {
    image: image,
    displayPrice: displayPrice,
    onSale: saleActive && product.sale_price,
    outOfStock: outOfStock,
    html:
      '<div class="product-card" data-name="' +
      product.title +
      '" data-price="' +
      displayPrice +
      '" data-image="' +
      image +
      '">' +
      '<a href="product.html?id=' +
      product.id +
      '" class="product-card-link" style="text-decoration:none;color:inherit;">' +
      '<img src="' +
      image +
      '" alt="' +
      product.title +
      '" loading="lazy" />' +
      "<h3>" +
      product.title +
      "</h3>" +
      priceHTML +
      saleHTML +
      "</a>" +
      '<button class="add-to-cart-btn" data-id="' +
      product.id +
      '" data-name="' +
      product.title +
      '" data-price="' +
      displayPrice +
      '" data-image="' +
      image +
      '"' +
      (outOfStock ? " disabled" : "") +
      ">" +
      (outOfStock
        ? " Sold Out"
        : " Add To Cart") +
      "</button>" +
      "</div>",
  };
}

// Shared "add to cart" visual feedback used by product-card buttons on any page.
function refreshCartAfterAdd(btn, name) {
  var originalHTML = btn.innerHTML;
  btn.innerHTML =
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Added';
  btn.classList.add("added");
  setTimeout(function () {
    btn.innerHTML = originalHTML;
    btn.classList.remove("added");
  }, 1500);
  updateCartBubble();
}

function addToCart(name, price, image, productId) {
  console.log("addToCart called");
  console.log(name, price, image, productId);
  const cart = getCart();
  const id = productId ? String(productId) : generateId(name);
  const existing = cart.find((item) => item.id === id);

  if (existing) {
    existing.quantity += 1;
  } else {
    const newItem = {
      id: id,
      name: name,
      price: parseFloat(price) || 0,
      image: image || "",
      quantity: 1,
    };
    if (productId !== undefined && productId !== null) {
      newItem.productId = Number(productId);
    }
    cart.push(newItem);
  }

  saveCart(cart);
  return cart;
}

function removeFromCart(id) {
  let cart = getCart();
  cart = cart.filter((item) => item.id !== id);
  saveCart(cart);
  return cart;
}

function updateCartItemQuantity(id, delta) {
  const cart = getCart();
  const item = cart.find((item) => item.id === id);
  if (!item) return cart;

  item.quantity += delta;
  if (item.quantity <= 0) {
    return removeFromCart(id);
  }
  saveCart(cart);
  return cart;
}

function getCartCount() {
  const cart = getCart();
  return cart.reduce((sum, item) => sum + item.quantity, 0);
}

// A product is considered OUT OF STOCK only when:
//   1. The product no longer exists/is no longer available in the store (null), OR
//   2. The admin explicitly marked it out of stock via `stock_status === "out"`.
// The `stock_status` field ("in"/"low"/"out") is the system's actual
// availability/out-of-stock control (see backend/models.py and product.js).
// The `status` field ("draft"/"published") is the publish status and is NOT
// used to determine cart availability.
function isProductAvailable(product) {
  if (!product) return false;
  const stockStatus = (product.stock_status || "in").toLowerCase();
  return stockStatus !== "out";
}

async function fetchProductById(productId) {
  if (!productId) return null;
  const key = String(productId);
  if (_productByIdCache[key]) {
    return _productByIdCache[key];
  }

  try {
    const response = await fetch(`${SHOP_API_BASE}/products/${productId}`);
    if (!response.ok) return null;
    const data = await response.json();
    if (!data.success) return null;
    _productByIdCache[key] = data.product;
    return data.product;
  } catch (err) {
    console.error("Failed to fetch product", err);
    return null;
  }
}

async function fetchAllProducts() {
  if (_allProductsCache) return _allProductsCache;
  try {
    const response = await fetch(`${SHOP_API_BASE}/products`);
    const data = await response.json();
    if (!data.success) return [];
    _allProductsCache = data.products;
    return _allProductsCache;
  } catch (err) {
    console.error("Failed to fetch product list", err);
    return [];
  }
}

function getProductTaxRate(product) {
  if (!product) return 8;
  const raw = product.tax_rate ?? product.tax_class;
  const legacy = { standard: 8, reduced: 4, zero: 0, none: 0 };
  const rate = legacy[String(raw).toLowerCase()] ?? Number(raw);
  return Number.isFinite(rate) ? Math.max(0, Math.min(100, rate)) : 8;
}

function matchCartItemToProduct(item, product) {
  if (!product) return false;
  if (item.productId && Number(item.productId) === Number(product.id)) {
    return true;
  }

  if (String(item.id) === String(product.id)) {
    return true;
  }

  if (String(item.name).trim() && String(item.name).trim() === String(product.title).trim()) {
    return true;
  }

  return generateId(product.title) === String(item.id);
}

async function normalizeCartItems(cart) {
  if (!Array.isArray(cart) || cart.length === 0) {
    return cart;
  }

  let updated = false;
  const allProducts = await fetchAllProducts();

  for (const item of cart) {
    let currentProduct = null;

    if (item.productId) {
      currentProduct = await fetchProductById(item.productId);
    }

    if (!currentProduct) {
      currentProduct = allProducts.find((product) => matchCartItemToProduct(item, product));
      if (currentProduct) {
        item.productId = Number(currentProduct.id);
        if (String(item.id) !== String(currentProduct.id)) {
          item.id = String(currentProduct.id);
        }
        updated = true;
      }
    }

    if (currentProduct) {
      const currentPrice = Number(currentProduct.sale_price) > 0 && Number(currentProduct.sale_price) < Number(currentProduct.price)
        ? Number(currentProduct.sale_price)
        : Number(currentProduct.price || 0);

      if (item.price !== currentPrice) {
        item.price = currentPrice;
        updated = true;
      }
      if (item.name !== currentProduct.title) {
        item.name = currentProduct.title;
        updated = true;
      }
      const currentImage = currentProduct.image && currentProduct.image !== ""
        ? `${SHOP_API_BASE}/uploads/products/${currentProduct.image}`
        : item.image;
      if (item.image !== currentImage) {
        item.image = currentImage;
        updated = true;
      }
    }
  }

  if (updated) {
    saveCart(cart);
  }

  return cart;
}

function buildCartItemState(item, currentProduct) {
  const isAvailable = isProductAvailable(currentProduct);
  const productName = currentProduct ? currentProduct.title : item.name;
  const productPrice = currentProduct
    ? Number(currentProduct.sale_price) > 0 && Number(currentProduct.sale_price) < Number(currentProduct.price)
      ? Number(currentProduct.sale_price)
      : Number(currentProduct.price || 0)
    : Number(item.price || 0);
  const productImage = currentProduct && currentProduct.image
    ? `${SHOP_API_BASE}/uploads/products/${currentProduct.image}`
    : item.image;
const statusText = currentProduct
    ? (currentProduct.stock_status || "in").toLowerCase()
    : "missing";

  return {
    available: isAvailable,
    name: productName,
    price: productPrice,
    image: productImage,
    status: statusText,
    taxRate: getProductTaxRate(currentProduct),
    currentProduct: currentProduct,
  };
}

function updateCartBubble() {

    const bubbles = document.querySelectorAll(".cart-bubble");

    const count = getCartCount();

    bubbles.forEach(bubble => {

        bubble.textContent = count;

        if (count > 0) {
            bubble.classList.remove("pop");

          void bubble.offsetWidth;

          bubble.classList.add("pop");

            bubble.style.display = "flex";

            bubble.style.alignItems = "center";
            bubble.style.justifyContent = "center";

        } else {

            bubble.style.display = "none";

        }

    });

}

// ===== Render Cart Items from  =====
async function renderCartItems() {
  const container = document.getElementById("cart-items");
  if (!container) return;

  const cart = await normalizeCartItems(getCart());
  container.innerHTML = "";

  if (cart.length === 0) {
    checkEmptyCart();
    updateOrderSummary();
    return;
  }

  await Promise.all(
    cart.map(async (item) => {
      const currentProduct = item.productId
        ? await fetchProductById(item.productId)
        : null;
      const state = buildCartItemState(item, currentProduct);

      const article = document.createElement("article");
      article.className = `cart-item${state.available ? "" : " cart-item-unavailable"}`;
      article.dataset.name = state.name;
      article.dataset.price = state.price;
      article.dataset.available = state.available ? "true" : "false";
      article.dataset.taxRate = String(state.taxRate);

      const availabilityMessage = state.available
        ? ""
        : `<p class="item-availability-message">Out of stock — We’ll remind you when this product is back in stock.</p>`;

      article.innerHTML = `
      <div class="cart-item-img">
        <img src="${state.image || "https://picsum.photos/300/250?default"}" alt="${state.name}" />
      </div>
      <div class="cart-item-info">
        <h3>${state.name}</h3>
        <p class="item-price">$${state.price.toFixed(2)}</p>
        <p class="item-tax">Tax: ${state.taxRate}%</p>
        ${availabilityMessage}
      </div>
      <div class="cart-item-actions">
        <div class="qty-controls">
          <button class="qty-btn qty-minus" data-id="${item.id}">−</button>
          <span class="qty-value">${item.quantity}</span>
          <button class="qty-btn qty-plus" data-id="${item.id}" ${state.available ? "" : "disabled"}>+</button>
        </div>
        <button class="remove-btn" data-id="${item.id}">Remove</button>
      </div>
    `;

      container.appendChild(article);
    }),
  );

  // Setup event listeners for the rendered items
  setupQtyControls();
  setupRemoveButtons();
  updateOrderSummary();
  checkEmptyCart();
}

// ===== Order Summary =====
function updateOrderSummary() {
  const items = document.querySelectorAll("#cart-items .cart-item");
  let subtotal = 0;
  let tax = 0;
  let totalItems = 0;
  let hasUnavailable = false;

  items.forEach((item) => {
    if (item.dataset.available === "false") {
      hasUnavailable = true;
      return;
    }
    const price = parseFloat(item.dataset.price) || 0;
    const qty = parseInt(item.querySelector(".qty-value").textContent) || 0;
    const taxRate = parseFloat(item.dataset.taxRate) || 0;
    subtotal += price * qty;
    tax += price * qty * (taxRate / 100);
    totalItems += qty;
  });

  const shipping = totalItems > 0 ? 12.0 : 0;
  tax = Number(tax.toFixed(2));
  const total = subtotal + shipping + tax;

  const subtotalEl = document.getElementById("subtotal-value");
  const shippingEl = document.getElementById("shipping-value");
  const taxEl = document.getElementById("tax-value");
  const totalEl = document.getElementById("total-value");
  const noteContainer = document.getElementById("cart-summary-note");
  const checkoutBtn = document.getElementById("cart-checkout-btn");

  if (subtotalEl) subtotalEl.textContent = `$${subtotal.toFixed(2)}`;
  if (shippingEl)
    shippingEl.textContent = shipping > 0 ? `$${shipping.toFixed(2)}` : "$0.00";
  if (taxEl) taxEl.textContent = `$${tax.toFixed(2)}`;
  if (totalEl) totalEl.textContent = `$${total.toFixed(2)}`;

const hasAvailableItems = totalItems > 0;

  if (!hasAvailableItems && items.length > 0) {
    // All items in the cart are unavailable — keep the user on the cart page.
    if (!noteContainer && checkoutBtn) {
      const note = document.createElement("p");
      note.id = "cart-summary-note";
      note.className = "cart-summary-note";
      note.textContent = "No available products to checkout.";
      checkoutBtn.insertAdjacentElement("afterend", note);
    } else if (noteContainer) {
      noteContainer.textContent = "No available products to checkout.";
    }
  } else if (hasUnavailable) {
    if (!noteContainer && checkoutBtn) {
      const note = document.createElement("p");
      note.id = "cart-summary-note";
      note.className = "cart-summary-note";
      note.textContent =
        "Some items are unavailable and excluded from your total.";
      checkoutBtn.insertAdjacentElement("afterend", note);
    } else if (noteContainer) {
      noteContainer.textContent =
        "Some items are unavailable and excluded from your total.";
    }
  } else if (noteContainer) {
    noteContainer.remove();
  }

  if (checkoutBtn) {
    if (!hasAvailableItems) {
      checkoutBtn.classList.add("disabled");
      checkoutBtn.removeAttribute("href");
      checkoutBtn.setAttribute(
        "aria-disabled",
        "true"
      );
    } else {
      checkoutBtn.classList.remove("disabled");
      checkoutBtn.href = "checkout.html";
      checkoutBtn.removeAttribute("aria-disabled");
    }
  }

  updateCartBubble();
}

// ===== Quantity Controls =====
function setupQtyControls() {
  document.querySelectorAll(".qty-plus").forEach((btn) => {
    btn.addEventListener("click", function () {
      const id = this.dataset.id;
      if (id) {
        updateCartItemQuantity(id, 1);
        renderCartItems();
        return;
      }
      const valueEl = this.parentElement.querySelector(".qty-value");
      let val = parseInt(valueEl.textContent) || 1;
      valueEl.textContent = val + 1;
      updateOrderSummary();
    });
  });

  document.querySelectorAll(".qty-minus").forEach((btn) => {
    btn.addEventListener("click", function () {
      const id = this.dataset.id;
      if (id) {
        updateCartItemQuantity(id, -1);
        renderCartItems();
        return;
      }
      const valueEl = this.parentElement.querySelector(".qty-value");
      let val = parseInt(valueEl.textContent) || 1;
      if (val > 1) {
        valueEl.textContent = val - 1;
        updateOrderSummary();
      }
    });
  });
}

// ===== Remove Items =====
function setupRemoveButtons() {
  document.querySelectorAll(".remove-btn").forEach((btn) => {
    btn.addEventListener("click", function () {
      const id = this.dataset.id;
      if (id) {
        removeFromCart(id);
        renderCartItems();
        return;
      }
      const item = this.closest(".cart-item");
      if (item) {
        item.remove();
        updateOrderSummary();
        checkEmptyCart();
      }
    });
  });
}

// ===== Empty Cart State =====
function checkEmptyCart() {
  const items = document.querySelectorAll("#cart-items .cart-item");
  const layout = document.getElementById("cart-layout");
  const existingEmpty = document.querySelector(".cart-empty");

  if (items.length === 0 && layout) {
    // Hide normal layout
    layout.style.display = "none";

    // Show empty state if not already shown
    if (!existingEmpty) {
      const emptyState = document.createElement("div");
      emptyState.className = "cart-empty";
      emptyState.innerHTML = `
        <svg width="80" height="80" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M6 6h15l-1.5 9h-12L4 2H2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="10" cy="20" r="1" fill="currentColor"/>
          <circle cx="18" cy="20" r="1" fill="currentColor"/>
        </svg>
        <h3>Your cart is empty</h3>
        <p>Looks like you haven't added anything yet.</p>
        <a href="home.html" class="shop-btn">Continue Shopping</a>
      `;
      const cartPage = document.querySelector(".cart-page");
      if (cartPage) cartPage.appendChild(emptyState);
    }
  } else if (items.length > 0 && layout) {
    layout.style.display = "grid";
    if (existingEmpty) existingEmpty.remove();
  }
}

// ===== Checkout (placeholder) =====
function setupCheckout() {
  const checkoutBtn = document.getElementById("checkout-btn");
  if (checkoutBtn) {
    checkoutBtn.addEventListener("click", function () {
      const totalItems = getTotalItems();
      if (totalItems === 0) {
        alert("Your cart is empty. Add some items first!");
      } else {
        alert("Thank you for your purchase! This is a demo checkout.");
      }
    });
  }
}

// ===== Load Product From URL =====
function loadProductFromURL() {
  const params = getUrlParams();
  if (!params.name) return;

  const productNameEl = document.getElementById("product-name");
  const productPriceEl = document.getElementById("product-price");
  const productImageEl = document.getElementById("product-image");
  const productId = generateId(params.name);

  if (productNameEl) productNameEl.textContent = params.name;
  if (productPriceEl)
    productPriceEl.textContent = `$${parseFloat(params.price).toFixed(2)}`;
  if (productImageEl) {
    productImageEl.src =
      params.image || "https://picsum.photos/500/400?product";
    productImageEl.alt = params.name;
  }

  // Update about section
  const productData =
    productDataMap[productId] || productDataMap["wireless-headphone"];
  const aboutDesc = document.querySelector(".about-section p");
  const aboutList = document.querySelector(".about-section ul");

  if (aboutDesc) aboutDesc.textContent = productData.description;
  if (aboutList) {
    aboutList.innerHTML = productData.features
      .map((f) => `<li>${f}</li>`)
      .join("");
  }
}

// ===== Home Page Init =====
function initHomePage() {
  // Handle Add to Cart buttons on home page. The dynamic cards rendered by
  // home.js (appendProductCard) already bind their own handler with the
  // productId, so guard against double-binding here and always pass the id.
  document.querySelectorAll(".add-to-cart-btn").forEach((btn) => {
    if (btn.dataset.homeBound) return;
    btn.dataset.homeBound = "1";

    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();

      const name = this.dataset.name || "";
      const price = this.dataset.price || "0";
      const image = this.dataset.image || "";
      const productId = this.dataset.id || null;

      addToCart(name, price, image, productId);
      refreshCartAfterAdd(this, name);
    });
  });

  // Shop Now button
  const shopNowBtn = document.getElementById("shop-now-btn");
  if (shopNowBtn) {
    shopNowBtn.addEventListener("click", function (e) {
      e.preventDefault();

      const productsSection = document.querySelector(".products");
      if (!productsSection) return;

      // Animate the button
      this.style.transform = "scale(0.9)";
      this.textContent = "↓ Scrolling...";

      // Smooth scroll to products
      productsSection.scrollIntoView({ behavior: "smooth", block: "start" });

      // Staggered fade-in animation for product cards
      const cards = document.querySelectorAll(".product-card");
      cards.forEach((card, i) => {
        card.style.opacity = "0";
        card.style.transform = "translateY(30px)";
        setTimeout(
          () => {
            card.style.transition = "all 0.6s cubic-bezier(0.4, 0, 0.2, 1)";
            card.style.opacity = "1";
            card.style.transform = "translateY(0)";
          },
          200 + i * 120,
        );
      });

      // Reset button after scroll
      setTimeout(() => {
        this.style.transform = "scale(1)";
        this.textContent = "Shop Now";
      }, 800);
    });
  }
}

// ===== Buy Now =====
async function handleBuyNow() {
  const buyNowBtn = document.getElementById("buyNowBtn");
  if (!buyNowBtn) return;

  const messageEl = document.getElementById("buyNowMessage");
  const showMessage = (text) => {
    if (messageEl) {
      messageEl.textContent = text;
      messageEl.style.display = "block";
    }
    alert(text);
  };

  const productId = new URLSearchParams(window.location.search).get("id");
  if (!productId) {
    showMessage("Unable to determine the product.");
    return;
  }

  // Always use the backend as the source of truth for the current product.
  const product = await fetchProductById(productId);

  if (!product) {
    showMessage("This product is no longer available.");
    return;
  }

  // Availability rule: unobtainable only when the product is missing OR the
  // admin explicitly marked it out of stock (stock_status === "out").
  if (!isProductAvailable(product)) {
    showMessage(
      "This product is currently out of stock and cannot be purchased."
    );
    return;
  }

  const quantity = Math.max(
    1,
    Math.floor(
      Number(document.getElementById("buyNowQtyValue")?.textContent) || 1
    )
  );

  const image =
    product.image && product.image !== ""
      ? `${SHOP_API_BASE}/uploads/products/${product.image}`
      : "https://picsum.photos/500/400?random=" + product.id;

  // Store a dedicated Buy-Now payload. This does NOT touch the user's cart,
  // keeping the Buy Now and Cart checkout flows fully independent.
  const buyNowKey = getBuyNowStorageKey();
  if (!buyNowKey) {
    showMessage("Please log in before using Buy Now.");
    return;
  }

  sessionStorage.setItem(
    buyNowKey,
    JSON.stringify({
      id: String(product.id),
      productId: Number(product.id),
      name: product.title,
      price: Number(product.price),
      sale_price: Number(product.sale_price),
      stock_status: product.stock_status,
      status: product.status,
      image: image,
      quantity: quantity,
      source: "buy-now",
    })
  );

  window.location.href = "checkout.html";
}

function initBuyNow() {
  const buyNowBtn = document.getElementById("buyNowBtn");
  if (buyNowBtn) {
    buyNowBtn.addEventListener("click", function (e) {
      e.preventDefault();
      handleBuyNow();
    });
  }
}

// ===== Get items for the checkout summary =====
// Returns the Buy-Now payload (if present) OR the cart items. Buy Now and the
// cart are independent flows; the Buy-Now payload takes precedence so a single
// product purchase is not mixed with the ongoing cart.
function getCheckoutItems() {
  try {
    const buyNowKey = getBuyNowStorageKey();
    const buyNow = buyNowKey ? JSON.parse(sessionStorage.getItem(buyNowKey)) : null;
    if (buyNow && buyNow.productId) {
      return [{ ...buyNow, id: String(buyNow.productId) }];
    }
  } catch {
    // ignore and fall back to cart
  }
  return getCart();
}

// ===== Checkout Page - Render Order Summary from Cart =====
async function renderCheckoutOrderSummary() {
  const orderItemsContainer = document.querySelector(".order-items");
  const checkoutSubtotal = document.getElementById("checkout-subtotal");
  const checkoutShipping = document.getElementById("checkout-shipping");
  const checkoutTax = document.getElementById("checkout-tax");
  const checkoutTotal = document.getElementById("checkout-total");
  const confirmBtn = document.querySelector(".checkout-btn-primary");

  if (!orderItemsContainer) return;

  const cart = await normalizeCartItems(getCheckoutItems());
  orderItemsContainer.innerHTML = "";

  if (cart.length === 0) {
    orderItemsContainer.innerHTML =
      '<p style="text-align:center;color:#94a3b8;padding:20px;">Your cart is empty. <a href="home.html" style="color:#2563eb;">Continue shopping</a></p>';
    if (checkoutSubtotal) checkoutSubtotal.textContent = "$0.00";
    if (checkoutShipping) checkoutShipping.textContent = "$0.00";
    if (checkoutTax) checkoutTax.textContent = "$0.00";
    if (checkoutTotal) checkoutTotal.textContent = "$0.00";
if (confirmBtn) {
      confirmBtn.innerHTML = "Confirm and Pay $0.00";
      confirmBtn.disabled = true;
    }
    return { empty: true };
  }

  let subtotal = 0;
  let tax = 0;
  let totalItems = 0;
  let unavailableCount = 0;

  await Promise.all(
    cart.map(async (item) => {
      const currentProduct = item.productId
        ? await fetchProductById(item.productId)
        : null;
      const state = buildCartItemState(item, currentProduct);

      if (!state.available) {
        unavailableCount += 1;
        return;
      }

      const itemTotal = state.price * item.quantity;
      subtotal += itemTotal;
      tax += itemTotal * (state.taxRate / 100);
      totalItems += item.quantity;

      const itemEl = document.createElement("div");
      itemEl.className = "order-item";
      itemEl.innerHTML = `
        <div class="order-item-thumb">
          <img src="${state.image || "https://picsum.photos/104/104?default"}" alt="${state.name}" />
          <span class="order-item-qty">${item.quantity}</span>
        </div>
        <div class="order-item-info">
          <h4>${state.name}</h4>
          <span>$${state.price.toFixed(2)} each · Tax: ${state.taxRate}%</span>
        </div>
        <span class="order-item-price">$${itemTotal.toFixed(2)}</span>
      `;
      orderItemsContainer.appendChild(itemEl);
    }),
  );

  if (unavailableCount > 0 && cart.length !== unavailableCount) {
    const note = document.createElement("p");
    note.className = "checkout-note";
    note.textContent =
      "Some unavailable products were excluded from your checkout total.";
    orderItemsContainer.insertAdjacentElement("afterend", note);
  }

  const shipping = totalItems > 0 ? 12.0 : 0;
  tax = Number(tax.toFixed(2));
  const total = subtotal + shipping + tax;

  if (checkoutSubtotal)
    checkoutSubtotal.textContent = `$${subtotal.toFixed(2)}`;
  if (checkoutShipping)
    checkoutShipping.textContent = `$${shipping.toFixed(2)}`;
  if (checkoutTax) checkoutTax.textContent = `$${tax.toFixed(2)}`;
  if (checkoutTotal) checkoutTotal.textContent = `$${total.toFixed(2)}`;

if (confirmBtn) {
    if (totalItems === 0) {
      confirmBtn.innerHTML = `Confirm and Pay $${total.toFixed(2)}`;
      confirmBtn.disabled = true;
      confirmBtn.style.cursor = "not-allowed";
      confirmBtn.style.opacity = "0.6";
    } else {
      confirmBtn.disabled = false;
      confirmBtn.style.cursor = "pointer";
      confirmBtn.style.opacity = "1";
      confirmBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        Confirm and Pay $${total.toFixed(2)}
      `;
    }
  }

  // Requirement #9: if every item is unavailable, do not keep an empty
  // checkout open. Signal the caller to redirect back to the cart.
  if (cart.length > 0 && totalItems === 0) {
    return { empty: true };
  }
}

// ===== Place Order (server-side validation) =====
// The frontend is NOT the final authority on order validity. This sends the
// available checkout items (plus the customer's shipping/payment info) to the
// backend, which re-validates that each product still exists, is still
// available, has sufficient stock, and uses the current price before creating
// the order. Customer info is gathered from the checkout form by
// gatherCheckoutCustomer() (defined in checkout-form.js).
async function placeOrder(extraData) {
  const items = await normalizeCartItems(getCheckoutItems());
  const availableItems = [];

  for (const item of items) {
    const currentProduct = item.productId
      ? await fetchProductById(item.productId)
      : null;
    const state = buildCartItemState(item, currentProduct);
    if (state.available && state.currentProduct) {
      availableItems.push({
        product_id: Number(state.currentProduct.id),
        quantity: Math.max(1, Number(item.quantity) || 1),
      });
    }
  }

  if (availableItems.length === 0) {
    return {
      success: false,
      message: "No available products to checkout.",
    };
  }

  let customer = {};
  if (typeof gatherCheckoutCustomer === "function") {
    try {
      customer = gatherCheckoutCustomer() || {};
    } catch (err) {
      console.error("Failed to gather customer info", err);
    }
  } else if (extraData && extraData.customer) {
    customer = extraData.customer;
  }

  let paymentMethod = "card";
  const selectedPayment = document.querySelector(
    'input[name="payment"]:checked'
  );
  if (selectedPayment) {
    paymentMethod = selectedPayment.value;
  } else if (extraData && extraData.payment_method) {
    paymentMethod = extraData.payment_method;
  }

  try {
    const response = await fetch(`${SHOP_API_BASE}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + (sessionStorage.getItem("token") || "") },
      body: JSON.stringify({
        items: availableItems,
        customer: customer,
        payment_method: paymentMethod,
      }),
    });
    const data = await response.json();
    return data;
  } catch (err) {
    console.error("Failed to place order", err);
    return {
      success: false,
      message: "Unable to place your order right now. Please try again.",
    };
  }
}

// Removes the consumed Buy-Now payload and/or purchased cart items after a
// successful order so the next checkout starts fresh.
function clearConsumedCheckout(placedItems) {
  const buyNowKey = getBuyNowStorageKey();
  if (buyNowKey) sessionStorage.removeItem(buyNowKey);
  if (placedItems && placedItems.length > 0) {
    const placedIds = new Set(placedItems.map((i) => String(i.product_id)));
    const cart = getCart().filter((item) => !placedIds.has(String(item.id)));
    saveCart(cart);
  }
}

// ===== Init =====
document.addEventListener("DOMContentLoaded", async function () {
  // Cart page
  if (document.querySelector(".cart-page")) {
    const buyNowKey = getBuyNowStorageKey();
    if (buyNowKey) sessionStorage.removeItem(buyNowKey);
    await renderCartItems();
  } else {
    setupQtyControls();
    setupRemoveButtons();
    updateOrderSummary();
    checkEmptyCart();
  }

if (typeof setupPromoCode === "function") {
    setupPromoCode();
  }
  setupCheckout();
  updateCartBubble();

  // Check if we're on the product page
  if (document.querySelector(".product-page")) {
    initBuyNow();
  }

  // Check if we're on the home page
  if (
    document.querySelector(".hero") &&
    document.querySelector("#product-container")
  ) {
    initHomePage();
  }

  // Check if we're on the checkout page
  if (document.querySelector(".checkout-page")) {
    const result = await renderCheckoutOrderSummary();
    if (result && result.empty) {
      // No available products to checkout — do not show an empty checkout.
      alert("No available products to checkout.");
      window.location.href = "cart.html";
    }
  }
});
(function () {
  "use strict";

  // ===== Credentials =====
  const VALID_USER = "Admin";
  const VALID_PASS = "Admin@1234";

  // ===== Detect current page =====
  const isLoginPage = document.getElementById("loginScreen") !== null;
  const isDashPage = document.querySelector(".admin-body") !== null;

  // =============================================
  //  LOGIN PAGE LOGIC
  // =============================================
  if (isLoginPage) {
    const adminForm = document.getElementById("adminForm");
    const adminUser = document.getElementById("adminUser");
    const adminPass = document.getElementById("adminPass");
    const userError = document.getElementById("userError");
    const passError = document.getElementById("passError");
    const loginFailMsg = document.getElementById("loginFailMsg");
    const adminLoginBtn = document.getElementById("adminLoginBtn");
    const adminEye = document.getElementById("adminEye");

    // Password toggle
    if (adminEye) {
      adminEye.addEventListener("click", () => {
        const show = adminEye.querySelector(".eye-show");
        const hide = adminEye.querySelector(".eye-hide");
        if (adminPass.type === "password") {
          adminPass.type = "text";
          show.style.display = "none";
          hide.style.display = "block";
        } else {
          adminPass.type = "password";
          show.style.display = "block";
          hide.style.display = "none";
        }
      });
    }

    // Clear errors on typing
    if (adminUser) {
      adminUser.addEventListener("input", () => {
        userError.textContent = "";
        adminUser.style.borderColor = "";
        loginFailMsg.style.display = "none";
      });
    }
    if (adminPass) {
      adminPass.addEventListener("input", () => {
        passError.textContent = "";
        adminPass.style.borderColor = "";
        loginFailMsg.style.display = "none";
      });
    }

    // Form submit — validates input, checks credentials, sets the session
    // flag on success, and redirects to the dashboard.
    if (adminForm) {
      adminForm.addEventListener("submit", (e) => {
        e.preventDefault();
        let valid = true;

        userError.textContent = "";
        passError.textContent = "";
        adminUser.style.borderColor = "";
        adminPass.style.borderColor = "";
        loginFailMsg.style.display = "none";

        if (!adminUser.value.trim()) {
          userError.textContent = "Username is required.";
          adminUser.style.borderColor = "#ef4444";
          valid = false;
        }
        if (!adminPass.value) {
          passError.textContent = "Password is required.";
          adminPass.style.borderColor = "#ef4444";
          valid = false;
        }

        if (!valid) return;

        // Show loading
        const btnLabel = adminLoginBtn.querySelector(".btn-label");
        const btnSpinner = adminLoginBtn.querySelector(".btn-spinner");
        btnLabel.style.display = "none";
        btnSpinner.style.display = "inline-flex";
        btnSpinner.style.animation = "adminSpin 1s linear infinite";
        adminLoginBtn.disabled = true;

        setTimeout(() => {
          btnLabel.style.display = "inline";
          btnSpinner.style.display = "none";
          btnSpinner.style.animation = "";
          adminLoginBtn.disabled = false;

          if (
            adminUser.value.trim() === VALID_USER &&
            adminPass.value === VALID_PASS
          ) {
            // SUCCESS → save login state and redirect to dashboard
            sessionStorage.setItem("adminLoggedIn", "true");
            window.location.href = "dashboard.html";
          } else {
            // FAIL
            loginFailMsg.style.display = "flex";
            adminUser.style.borderColor = "#ef4444";
            adminPass.style.borderColor = "#ef4444";
            adminPass.value = "";
            adminPass.focus();
          }
        }, 1500);
      });
    }

    // Check if already logged in (session flag)
    if (sessionStorage.getItem("adminLoggedIn") === "true") {
      window.location.href = "dashboard.html";
    }
  }

  // =============================================
  //  DASHBOARD PAGES LOGIC
  // =============================================
  async function checkAdminAuth() {
    const token = sessionStorage.getItem("token");

    if (!token) {
      window.location.href = "/page/login.html";
      return false;
    }

    try {
      const response = await fetch("http://127.0.0.1:5000/me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        sessionStorage.removeItem("token");
        sessionStorage.removeItem("auth_user");
        window.location.href = "/page/login.html";
        return false;
      }

      const data = await response.json();

      if (data.user.role !== "admin") {
        window.location.href = "../page/home.html";
        return false;
      }

      return true;
    } catch (error) {
      console.error("Authentication check failed:", error);
      return false;
    }
  }

  if (isDashPage) {
    checkAdminAuth();
  }

  // Mobile menu toggle
  const menuToggle = document.getElementById("menuToggle");
  const sidebar = document.getElementById("adminSidebar");

  if (menuToggle) {
    menuToggle.addEventListener("click", () => {
      sidebar.classList.toggle("open");
    });
  }

  // Close sidebar on outside click (mobile)
  document.addEventListener("click", (e) => {
    if (
      sidebar &&
      sidebar.classList.contains("open") &&
      !sidebar.contains(e.target) &&
      menuToggle &&
      !menuToggle.contains(e.target)
    ) {
      sidebar.classList.remove("open");
    }
  });

  // Logout
  const logoutBtn = document.getElementById("adminLogout");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      sessionStorage.removeItem("adminLoggedIn");
      window.location.href = "/page/login.html";
    });
  }

  // Chart bar tooltips
  document.querySelectorAll(".chart-bar").forEach((bar) => {
    bar.addEventListener("mouseenter", () => bar.classList.add("hovered"));
    bar.addEventListener("mouseleave", () => bar.classList.remove("hovered"));
  });

  // ===== ORDERS PAGE: Search & Filter =====
  const orderSearch = document.getElementById("orderSearch");
  const statusFilter = document.getElementById("statusFilter");
  const ordersBody = document.getElementById("ordersTableBody");

  function filterOrders() {
    if (!ordersBody) return;
    const search = (orderSearch ? orderSearch.value : "").toLowerCase();
    const status = statusFilter ? statusFilter.value : "all";
    const rows = ordersBody.querySelectorAll("tr");

    rows.forEach((row) => {
      const text = row.textContent.toLowerCase();
      const rowStatus = row.getAttribute("data-status") || "";
      const matchSearch = !search || text.includes(search);
      const matchStatus = status === "all" || rowStatus === status;
      row.style.display = matchSearch && matchStatus ? "" : "none";
    });
  }

  if (orderSearch) orderSearch.addEventListener("input", filterOrders);
  if (statusFilter) statusFilter.addEventListener("change", filterOrders);

  // Pagination buttons (visual only)
  document.querySelectorAll(".page-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".page-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      if (btn.textContent === "Previous" || btn.textContent === "Next") {
        btn.classList.remove("active");
      }
    });
  });

  // ===== PRODUCTS PAGE: Search & Modal =====
  const productSearch = document.getElementById("productSearch");
  const addProductBtn = document.getElementById("addProductBtn");

  if (productSearch) {
    productSearch.addEventListener("input", () => {
      const q = productSearch.value.toLowerCase();
      document.querySelectorAll(".product-admin-card").forEach((card) => {
        const text = card.textContent.toLowerCase();
        card.style.display = text.includes(q) ? "" : "none";
      });
    });
  }

  if (addProductBtn)
    addProductBtn.addEventListener("click", () => {
      window.location.href = "add.html";
    });

  // ===== CUSTOMERS PAGE: Search =====
  const customerSearch = document.getElementById("customerSearch");
  if (customerSearch) {
    customerSearch.addEventListener("input", () => {
      const q = customerSearch.value.toLowerCase();
      document.querySelectorAll(".customer-card").forEach((card) => {
        const text = card.textContent.toLowerCase();
        card.style.display = text.includes(q) ? "" : "none";
      });
    });
  }
})();

/* =============================================================================
 *  ADD PRODUCT PAGE — Image Uploader
 *  Self-contained module. Runs only on pages that contain #uploadArea (add.html).
 *  Exposes:
 *    window.uploadedImages          -> live array [{ file, preview }]  (add.js reads this)
 *    window.ProductImages           -> { getFiles, getMainFile, clear, count }
 * ========================================================================== */
(function () {
  "use strict";

  // ----- Config -------------------------------------------------------------
  const MAX_IMAGES = 5;
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
  const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];

  // ----- DOM ----------------------------------------------------------------
  const dom = {
    area: document.getElementById("uploadArea"),
    placeholder: document.getElementById("uploadPlaceholder"),
    input: document.getElementById("imageInput"),
    grid: document.getElementById("previewGrid"),
  };

  // Not the add-product page -> do nothing.
  if (!dom.area || !dom.input || !dom.grid || !dom.placeholder) return;

  // ----- State --------------------------------------------------------------
  // NOTE: this array is mutated in place and never reassigned, so the reference
  // held by window.uploadedImages (used by add.js) always stays valid.
  const uploadedImages = [];
  window.uploadedImages = uploadedImages;

  let dragDepth = 0; // avoids dragleave flicker on child elements

  // ----- Helpers ------------------------------------------------------------
  function notify(message) {
    if (typeof window.showToast === "function") window.showToast(message);
    else console.warn(message);
  }

  function openFilePicker() {
    if (uploadedImages.length >= MAX_IMAGES) {
      notify("You can upload a maximum of " + MAX_IMAGES + " images.");
      return;
    }
    dom.input.click();
  }

  function validateFile(file) {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return '"' + file.name + '" is not a supported image (PNG, JPG, WebP).';
    }
    if (file.size > MAX_FILE_SIZE) {
      return '"' + file.name + '" exceeds the 5MB limit.';
    }
    return null;
  }

  function isDuplicate(file) {
    return uploadedImages.some(
      (img) =>
        img.file.name === file.name &&
        img.file.size === file.size &&
        img.file.lastModified === file.lastModified
    );
  }

  // ----- Core: add / remove -------------------------------------------------
  function addFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;

    const errors = [];
    let added = 0;

    for (const file of files) {
      if (uploadedImages.length >= MAX_IMAGES) {
        errors.push("Only " + MAX_IMAGES + " images allowed; extra files were skipped.");
        break;
      }

      const error = validateFile(file);
      if (error) {
        errors.push(error);
        continue;
      }

      if (isDuplicate(file)) {
        errors.push('"' + file.name + '" is already added.');
        continue;
      }

      // Object URLs are far cheaper than base64 data URLs from FileReader,
      // and preserve the exact order the user selected the files in.
      uploadedImages.push({ file: file, preview: URL.createObjectURL(file) });
      added++;
    }

    if (added) renderPreviews();
    if (errors.length) notify(errors[0]);
  }

  function removeImage(index) {
    const [removed] = uploadedImages.splice(index, 1);
    if (removed && removed.preview.startsWith("blob:")) {
      URL.revokeObjectURL(removed.preview); // free memory
    }
    renderPreviews();
  }

  // ----- Rendering ----------------------------------------------------------
  function buildPreviewItem(img, index) {
    const item = document.createElement("div");
    item.className = "preview-item";

    const picture = document.createElement("img");
    picture.src = img.preview;
    picture.alt = "Preview " + (index + 1);
    item.appendChild(picture);

    if (index === 0) {
      const badge = document.createElement("span");
      badge.className = "preview-badge";
      badge.textContent = "Main";
      item.appendChild(badge);
    }

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "preview-remove";
    remove.dataset.index = String(index);
    remove.setAttribute("aria-label", "Remove image");
    remove.innerHTML = "&times;";
    item.appendChild(remove);

    return item;
  }

  function buildAddMoreTile() {
    const tile = document.createElement("div");
    tile.className = "preview-add-more";
    tile.setAttribute("role", "button");
    tile.setAttribute("tabindex", "0");
    tile.innerHTML =
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="1.5" stroke-linecap="round" ' +
      'stroke-linejoin="round">' +
      '<line x1="12" y1="5" x2="12" y2="19"/>' +
      '<line x1="5" y1="12" x2="19" y2="12"/>' +
      "</svg><span>Add More</span>";
    return tile;
  }

  function renderPreviews() {
    if (uploadedImages.length === 0) {
      dom.placeholder.style.display = "";
      dom.grid.style.display = "none";
      dom.grid.innerHTML = "";
      return;
    }

    dom.placeholder.style.display = "none";
    dom.grid.style.display = "grid";

    // Build off-document, then swap in once -> a single reflow.
    const fragment = document.createDocumentFragment();
    uploadedImages.forEach((img, i) => fragment.appendChild(buildPreviewItem(img, i)));
    if (uploadedImages.length < MAX_IMAGES) fragment.appendChild(buildAddMoreTile());

    dom.grid.innerHTML = "";
    dom.grid.appendChild(fragment);
  }

  // ----- Events -------------------------------------------------------------
  // Click anywhere on the empty upload area opens the picker.
  dom.area.addEventListener("click", (e) => {
    if (e.target.closest(".preview-remove") || e.target.closest(".preview-add-more")) return;
    if (e.target.closest(".preview-item")) return;
    openFilePicker();
  });

  // Delegated handling for preview controls: bound once, not on every render.
  dom.grid.addEventListener("click", (e) => {
    const removeBtn = e.target.closest(".preview-remove");
    if (removeBtn) {
      e.stopPropagation();
      removeImage(Number(removeBtn.dataset.index));
      return;
    }

    if (e.target.closest(".preview-add-more")) {
      e.stopPropagation();
      openFilePicker();
    }
  });

  dom.grid.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target.closest(".preview-add-more")) {
      e.preventDefault();
      openFilePicker();
    }
  });

  dom.input.addEventListener("change", () => {
    addFiles(dom.input.files);
    dom.input.value = ""; // allow re-selecting the same file
  });

  // Drag & drop
  dom.area.addEventListener("dragenter", (e) => {
    e.preventDefault();
    dragDepth++;
    dom.area.classList.add("dragover");
  });

  dom.area.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  });

  dom.area.addEventListener("dragleave", () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) dom.area.classList.remove("dragover");
  });

  dom.area.addEventListener("drop", (e) => {
    e.preventDefault();
    dragDepth = 0;
    dom.area.classList.remove("dragover");
    addFiles(e.dataTransfer.files);
  });

  // Release object URLs when leaving the page.
  window.addEventListener("beforeunload", () => {
    uploadedImages.forEach((img) => {
      if (img.preview.startsWith("blob:")) URL.revokeObjectURL(img.preview);
    });
  });

  // ----- Public API ---------------------------------------------------------
  window.ProductImages = {
    count: () => uploadedImages.length,
    getFiles: () => uploadedImages.map((img) => img.file),
    getMainFile: () => (uploadedImages[0] ? uploadedImages[0].file : null),
    clear: () => {
      while (uploadedImages.length) removeImage(uploadedImages.length - 1);
    },
  };

  renderPreviews(); // initial paint (empty state)
})();
