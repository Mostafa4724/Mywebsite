// ===== LocalStorage Cart System =====
function getCart() {
  try {
    return JSON.parse(localStorage.getItem("shopping_cart")) || [];
  } catch {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem("shopping_cart", JSON.stringify(cart));
  updateCartBubble();
}

function generateId(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function addToCart(name, price, image) {
  const cart = getCart();
  const id = generateId(name);
  const existing = cart.find((item) => item.id === id);

  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({
      id: id,
      name: name,
      price: parseFloat(price) || 0,
      image: image || "",
      quantity: 1,
    });
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

// ===== Cart Counter =====
function getTotalItems() {
  // On cart page, use DOM; elsewhere use localStorage
  if (document.querySelector("#cart-items")) {
    const qtyElements = document.querySelectorAll("#cart-items .qty-value");
    let total = 0;
    qtyElements.forEach((el) => {
      total += parseInt(el.textContent) || 0;
    });
    return total;
  }
  return getCartCount();
}

function updateCartBubble() {
  const bubble = document.querySelector(".cart-bubble");
  if (!bubble) return;
  const count = getCartCount();
  bubble.textContent = count;
  bubble.style.display = count > 0 ? "flex" : "none";
}

// ===== Render Cart Items from localStorage =====
function renderCartItems() {
  const container = document.getElementById("cart-items");
  if (!container) return;

  const cart = getCart();
  container.innerHTML = "";

  if (cart.length === 0) {
    checkEmptyCart();
    updateOrderSummary();
    return;
  }

  cart.forEach((item) => {
    const article = document.createElement("article");
    article.className = "cart-item";
    article.dataset.name = item.name;
    article.dataset.price = item.price;

    article.innerHTML = `
      <div class="cart-item-img">
        <img src="${item.image || "https://picsum.photos/300/250?default"}" alt="${item.name}" />
      </div>
      <div class="cart-item-info">
        <h3>${item.name}</h3>
        <p class="item-price">$${item.price.toFixed(2)}</p>
      </div>
      <div class="cart-item-actions">
        <div class="qty-controls">
          <button class="qty-btn qty-minus" data-id="${item.id}">−</button>
          <span class="qty-value">${item.quantity}</span>
          <button class="qty-btn qty-plus" data-id="${item.id}">+</button>
        </div>
        <button class="remove-btn" data-id="${item.id}">Remove</button>
      </div>
    `;

    container.appendChild(article);
  });

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
  let totalItems = 0;

  items.forEach((item) => {
    const price = parseFloat(item.dataset.price) || 0;
    const qty = parseInt(item.querySelector(".qty-value").textContent) || 0;
    subtotal += price * qty;
    totalItems += qty;
  });

  const shipping = totalItems > 0 ? 12.0 : 0;
  const tax = subtotal * 0.08;
  const total = subtotal + shipping + tax;

  const subtotalEl = document.getElementById("subtotal-value");
  const shippingEl = document.getElementById("shipping-value");
  const taxEl = document.getElementById("tax-value");
  const totalEl = document.getElementById("total-value");

  if (subtotalEl) subtotalEl.textContent = `$${subtotal.toFixed(2)}`;
  if (shippingEl)
    shippingEl.textContent = shipping > 0 ? `$${shipping.toFixed(2)}` : "$0.00";
  if (taxEl) taxEl.textContent = `$${tax.toFixed(2)}`;
  if (totalEl) totalEl.textContent = `$${total.toFixed(2)}`;

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

// ===== Promo Code (placeholder) =====
function setupPromoCode() {
  const applyBtn = document.getElementById("apply-promo");
  const promoInput = document.getElementById("promo-input");
  if (applyBtn && promoInput) {
    applyBtn.addEventListener("click", function () {
      const code = promoInput.value.trim().toUpperCase();
      if (code === "SAVE10") {
        alert("Promo code applied! 10% discount will be reflected.");
      } else if (code) {
        alert(`"${code}" is not a valid promo code.`);
      } else {
        alert("Please enter a promo code.");
      }
    });
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

// ===== Product Page - Reviews Data =====
let productReviews = [
  {
    name: "Sarah M.",
    rating: 5,
    text: "Amazing quality! Highly recommend this product.",
    date: "2025-01-15",
  },
  {
    name: "James K.",
    rating: 4,
    text: "Great value for the price. Would buy again.",
    date: "2025-02-03",
  },
  {
    name: "Emily R.",
    rating: 5,
    text: "Exceeded my expectations. Fast shipping too!",
    date: "2025-02-20",
  },
];

let selectedRating = 0;

// ===== Star Input (clickable stars) =====
function initStarInput() {
  const starBtns = document.querySelectorAll(".star-input .star-btn");
  starBtns.forEach((btn) => {
    btn.addEventListener("click", function () {
      selectedRating = parseInt(this.dataset.value);
      starBtns.forEach((s) => s.classList.remove("active"));
      // Highlight selected and all before it (since direction is rtl)
      starBtns.forEach((s) => {
        if (parseInt(s.dataset.value) <= selectedRating) {
          s.classList.add("active");
        }
      });
    });

    btn.addEventListener("mouseenter", function () {
      const val = parseInt(this.dataset.value);
      starBtns.forEach((s) => {
        s.classList.remove("active");
        if (parseInt(s.dataset.value) <= val) {
          s.style.color = "#f59e0b";
        } else {
          s.style.color = "#e2e8f0";
        }
      });
    });

    btn.addEventListener("mouseleave", function () {
      starBtns.forEach((s) => {
        s.style.color = "";
        if (selectedRating > 0 && parseInt(s.dataset.value) <= selectedRating) {
          s.classList.add("active");
        }
      });
    });
  });
}

// ===== Submit Review =====
function initReviewSubmit() {
  const submitBtn = document.querySelector(".submit-review-btn");
  const textarea = document.querySelector(".review-form textarea");

  if (!submitBtn || !textarea) return;

  submitBtn.addEventListener("click", function () {
    const text = textarea.value.trim();
    if (selectedRating === 0) {
      alert("Please select a star rating.");
      return;
    }
    if (!text) {
      alert("Please write a review comment.");
      return;
    }

    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];

    productReviews.push({
      name: "You",
      rating: selectedRating,
      text: text,
      date: dateStr,
    });

    // Reset form
    textarea.value = "";
    selectedRating = 0;
    document
      .querySelectorAll(".star-input .star-btn")
      .forEach((s) => s.classList.remove("active"));

    // Refresh displays
    displayReviews();
    displayAverageRating();
    alert("Thank you for your review!");
  });
}

// ===== Display Reviews =====
function displayReviews() {
  const reviewsList = document.querySelector(".reviews-list");
  if (!reviewsList) return;

  if (productReviews.length === 0) {
    reviewsList.innerHTML =
      '<p class="no-reviews">No reviews yet. Be the first to review!</p>';
    return;
  }

  reviewsList.innerHTML = productReviews
    .map((review) => {
      const starsHtml = Array.from(
        { length: 5 },
        (_, i) =>
          `<span class="star ${i < review.rating ? "" : "empty"}">★</span>`,
      ).join("");

      return `
      <div class="review-card">
        <div class="review-header">
          <span class="reviewer-name">${review.name}</span>
          <span class="review-date">${review.date}</span>
        </div>
        <div class="review-stars">${starsHtml}</div>
        <p class="review-text">${review.text}</p>
      </div>
    `;
    })
    .join("");
}

// ===== Calculate & Display Average Rating =====
function calculateAverageRating() {
  if (productReviews.length === 0) return 0;
  const total = productReviews.reduce((sum, r) => sum + r.rating, 0);
  return total / productReviews.length;
}

function displayAverageRating() {
  const starsDisplay = document.querySelector(".stars-display");
  const averageText = document.querySelector(".average-text");
  const reviewCount = document.querySelector(".review-count");

  if (!starsDisplay) return;

  const avg = calculateAverageRating();
  const fullStars = Math.floor(avg);
  const hasHalf = avg - fullStars >= 0.25 && avg - fullStars < 0.75;
  const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);

  let html = "";
  for (let i = 0; i < fullStars; i++) {
    html += '<span class="star filled">★</span>';
  }
  if (hasHalf) {
    html += '<span class="star half">★</span>';
  }
  for (let i = 0; i < emptyStars; i++) {
    html += '<span class="star">★</span>';
  }

  starsDisplay.innerHTML = html;
  if (averageText) averageText.textContent = avg > 0 ? avg.toFixed(1) : "0.0";
  if (reviewCount)
    reviewCount.textContent = `(${productReviews.length} review${productReviews.length !== 1 ? "s" : ""})`;
}

// ===== Add To Cart =====
function initAddToCart() {
  const addToCartBtn = document.querySelector(".product-actions .btn-primary");
  if (addToCartBtn) {
    addToCartBtn.addEventListener("click", function () {
      const productName =
        document.querySelector(".product-name")?.textContent || "Product";
      const priceText =
        document.querySelector(".product-price")?.textContent || "$0.00";
      const price = priceText.replace(/[^0-9.]/g, "");
      const productImage = document.querySelector("#product-image")?.src || "";

      addToCart(productName, price, productImage);

      // Show feedback
      const cartBubble = document.querySelector(".cart-bubble");
      if (cartBubble) {
        cartBubble.style.transform = "scale(1.3)";
        setTimeout(() => {
          cartBubble.style.transform = "scale(1)";
        }, 200);
      }

      alert(`"${productName}" has been added to your cart!`);
    });
  }
}

// ===== Init Product Page =====
function initProductPage() {
  initStarInput();
  initReviewSubmit();
  displayReviews();
  displayAverageRating();
  initAddToCart();
  initBuyNow();
}

// ===== Get URL Parameters =====
function getUrlParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    name: params.get("name") || "",
    price: params.get("price") || "",
    image: params.get("image") || "",
  };
}

// ===== Product Data Store =====
const productDataMap = {
  "wireless-headphone": {
    description:
      "Experience premium sound quality with our Wireless Headphone. Designed for comfort and long-lasting use, this headphone delivers rich bass, clear highs, and a balanced mid-range that brings your music to life.",
    features: [
      "Bluetooth 5.0 with 30ft range",
      "Up to 20 hours of battery life",
      "Memory foam ear cushions for all-day comfort",
      "Built-in microphone for hands-free calls",
      "Foldable design for easy portability",
      "Compatible with all Bluetooth-enabled devices",
    ],
  },
  "smart-watch": {
    description:
      "Stay connected and track your fitness with our Smart Watch. Featuring a vibrant display, heart rate monitoring, and seamless smartphone integration, this smartwatch is your perfect daily companion.",
    features: [
      '1.4" AMOLED display with always-on mode',
      "Heart rate & SpO2 monitoring",
      "GPS tracking for runs and rides",
      "Water resistant up to 50 meters",
      "7-day battery life",
      "Compatible with iOS and Android",
    ],
  },
  "running-shoes": {
    description:
      "Take your running to the next level with our lightweight Running Shoes. Engineered with responsive cushioning and breathable mesh, these shoes provide the perfect balance of comfort and performance.",
    features: [
      "Lightweight knit upper for breathability",
      "Responsive foam midsole cushioning",
      "Rubber outsole for durable traction",
      "Padded collar and tongue for comfort",
      "Reflective details for visibility",
      "Weight: only 9.5 oz (size 9)",
    ],
  },
  "gaming-mouse": {
    description:
      "Dominate the competition with our high-precision Gaming Mouse. Equipped with a custom optical sensor and programmable buttons, this mouse gives you the edge you need in every game.",
    features: [
      "16,000 DPI optical sensor",
      "8 programmable buttons",
      "Customizable RGB lighting",
      "Lightweight honeycomb shell design",
      "Braided cable for durability",
      "Onboard memory for profile storage",
    ],
  },
};

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
  // Handle Add to Cart buttons on home page
  document.querySelectorAll(".add-to-cart-btn").forEach((btn) => {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();

      const name = this.dataset.name || "";
      const price = this.dataset.price || "0";
      const image = this.dataset.image || "";

      addToCart(name, price, image);

      // Visual feedback
      const cartBubble = document.querySelector(".cart-bubble");
      if (cartBubble) {
        cartBubble.style.transform = "scale(1.3)";
        setTimeout(() => {
          cartBubble.style.transform = "scale(1)";
        }, 200);
      }

      alert(`"${name}" has been added to your cart!`);
    });
  });

  // Shop Now button - smooth scroll to products section with animation
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
function initBuyNow() {
  const buyNowBtn = document.querySelector(".product-actions .btn-secondary");
  if (buyNowBtn) {
    buyNowBtn.addEventListener("click", function (e) {
      e.preventDefault();

      const productName =
        document.querySelector(".product-name")?.textContent || "Product";
      const priceText =
        document.querySelector(".product-price")?.textContent || "$0.00";
      const price = priceText.replace(/[^0-9.]/g, "");
      const productImage = document.querySelector("#product-image")?.src || "";

      // Clear cart and add only this product
      localStorage.removeItem("shopping_cart");
      addToCart(productName, price, productImage);

      // Navigate to checkout
      window.location.href = "checkout.html";
    });
  }
}

// ===== Checkout Page - Render Order Summary from Cart =====
function renderCheckoutOrderSummary() {
  const orderItemsContainer = document.querySelector(".order-items");
  const checkoutSubtotal = document.getElementById("checkout-subtotal");
  const checkoutShipping = document.getElementById("checkout-shipping");
  const checkoutTax = document.getElementById("checkout-tax");
  const checkoutTotal = document.getElementById("checkout-total");
  const confirmBtn = document.querySelector(".checkout-btn-primary");

  if (!orderItemsContainer) return;

  const cart = getCart();
  orderItemsContainer.innerHTML = "";

  if (cart.length === 0) {
    orderItemsContainer.innerHTML =
      '<p style="text-align:center;color:#94a3b8;padding:20px;">Your cart is empty. <a href="home.html" style="color:#2563eb;">Continue shopping</a></p>';
    if (checkoutSubtotal) checkoutSubtotal.textContent = "$0.00";
    if (checkoutShipping) checkoutShipping.textContent = "$0.00";
    if (checkoutTax) checkoutTax.textContent = "$0.00";
    if (checkoutTotal) checkoutTotal.textContent = "$0.00";
    if (confirmBtn) confirmBtn.innerHTML = "Confirm and Pay $0.00";
    return;
  }

  let subtotal = 0;
  let totalItems = 0;

  cart.forEach((item) => {
    const itemTotal = item.price * item.quantity;
    subtotal += itemTotal;
    totalItems += item.quantity;

    const itemEl = document.createElement("div");
    itemEl.className = "order-item";
    itemEl.innerHTML = `
      <div class="order-item-thumb">
        <img src="${item.image || "https://picsum.photos/104/104?default"}" alt="${item.name}" />
        <span class="order-item-qty">${item.quantity}</span>
      </div>
      <div class="order-item-info">
        <h4>${item.name}</h4>
        <span>$${item.price.toFixed(2)} each</span>
      </div>
      <span class="order-item-price">$${itemTotal.toFixed(2)}</span>
    `;
    orderItemsContainer.appendChild(itemEl);
  });

  const shipping = totalItems > 0 ? 12.0 : 0;
  const tax = subtotal * 0.08;
  const total = subtotal + shipping + tax;

  if (checkoutSubtotal)
    checkoutSubtotal.textContent = `$${subtotal.toFixed(2)}`;
  if (checkoutShipping)
    checkoutShipping.textContent = `$${shipping.toFixed(2)}`;
  if (checkoutTax) checkoutTax.textContent = `$${tax.toFixed(2)}`;
  if (checkoutTotal) checkoutTotal.textContent = `$${total.toFixed(2)}`;

  // Update confirm button with dynamic total
  if (confirmBtn) {
    const svg = confirmBtn.querySelector("svg");
    confirmBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
      Confirm and Pay $${total.toFixed(2)}
    `;
  }
}

// ===== Init =====
document.addEventListener("DOMContentLoaded", function () {
  // Cart page: render from localStorage
  if (document.querySelector(".cart-page")) {
    renderCartItems();
  } else {
    setupQtyControls();
    setupRemoveButtons();
    updateOrderSummary();
    checkEmptyCart();
  }

  setupPromoCode();
  setupCheckout();
  updateCartBubble();

  // Check if we're on the product page
  if (document.querySelector(".product-page")) {
    loadProductFromURL();
    initProductPage();
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
    renderCheckoutOrderSummary();
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

    // Form submit
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
  if (isDashPage) {
    // Auth guard
    if (sessionStorage.getItem("adminLoggedIn") !== "true") {
      window.location.href = "login.html";
      return;
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
        window.location.href = "admin-login.html";
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
    const addProductModal = document.getElementById("addProductModal");
    const closeModal = document.getElementById("closeModal");
    const cancelModal = document.getElementById("cancelModal");
    const saveProduct = document.getElementById("saveProduct");

    if (productSearch) {
      productSearch.addEventListener("input", () => {
        const q = productSearch.value.toLowerCase();
        document.querySelectorAll(".product-admin-card").forEach((card) => {
          const text = card.textContent.toLowerCase();
          card.style.display = text.includes(q) ? "" : "none";
        });
      });
    }

    function openModal() {
      if (addProductModal) addProductModal.style.display = "flex";
    }
    function closeProductModal() {
      if (addProductModal) addProductModal.style.display = "none";
    }

    if (addProductBtn) addProductBtn.addEventListener("click", openModal);
    if (closeModal) closeModal.addEventListener("click", closeProductModal);
    if (cancelModal) cancelModal.addEventListener("click", closeProductModal);
    if (addProductModal) {
      addProductModal.addEventListener("click", (e) => {
        if (e.target === addProductModal) closeProductModal();
      });
    }
    if (saveProduct) {
      saveProduct.addEventListener("click", () => {
        closeProductModal();
      });
    }

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
  }

  // Set session on successful login (handled in submit above via redirect)
  // We set it right before redirect
  const origSubmit = document.getElementById("adminForm");
  if (origSubmit) {
    origSubmit.addEventListener("submit", function setSession() {
      // This runs after the validation in the main handler above
      // The session is set below
    });
  }

  // Patch: set session flag before redirect on login page
  if (isLoginPage) {
    const form = document.getElementById("adminForm");
    if (form) {
      const originalHandler = form.onsubmit;
      form.addEventListener(
        "submit",
        function () {
          const u = document.getElementById("adminUser");
          const p = document.getElementById("adminPass");
          if (
            u &&
            p &&
            u.value.trim() === VALID_USER &&
            p.value === VALID_PASS
          ) {
            sessionStorage.setItem("adminLoggedIn", "true");
          }
        },
        true,
      ); // capture phase so it runs before the main handler
    }
  }
})();
