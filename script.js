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
  console.log("addToCart called");
  console.log(name, price, image);
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

    if (addProductBtn) addProductBtn.addEventListener("click", () => {
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
(function () {
  'use strict';

  // ===== Image Upload =====
  const uploadArea = document.getElementById('uploadArea');
  const uploadPlaceholder = document.getElementById('uploadPlaceholder');
  const imageInput = document.getElementById('imageInput');
  const previewGrid = document.getElementById('previewGrid');
  const MAX_IMAGES = 5;
  let uploadedImages = [];
  
  window.uploadedImages = uploadedImages;

  if (uploadArea) {
    uploadArea.addEventListener('click', (e) => {
      if (e.target.closest('.preview-remove') || e.target.closest('.preview-add-more')) return;
      if (uploadedImages.length >= MAX_IMAGES) return;
      imageInput.click();
    });

    uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', () => {
      uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadArea.classList.remove('dragover');
      const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
      handleFiles(files);
    });

    imageInput.addEventListener('change', () => {
      const files = Array.from(imageInput.files);
      handleFiles(files);
      imageInput.value = '';
    });
  }

  function handleFiles(files) {

    const remaining = MAX_IMAGES - uploadedImages.length;
    const toAdd = files.slice(0, remaining);

    toAdd.forEach(file => {

        if (file.size > 5 * 1024 * 1024) {
            showToast('File "' + file.name + '" exceeds 5MB limit.');
            return;
        }

        const reader = new FileReader();

        reader.onload = (e) => {

            uploadedImages.push({
                file: file,
                preview: e.target.result
            });

            renderPreviews();

        };

        reader.readAsDataURL(file);

    });

}

  function renderPreviews() {
    if (uploadedImages.length === 0) {
      uploadPlaceholder.style.display = '';
      previewGrid.style.display = 'none';
      return;
    }

    uploadPlaceholder.style.display = 'none';
    previewGrid.style.display = 'grid';
    previewGrid.innerHTML = '';

    uploadedImages.forEach((img, i) => {
      const item = document.createElement('div');
      item.className = 'preview-item';
      item.innerHTML =
        '<img src="' + img.preview + '" alt="Preview ' + (i + 1) + '" />' +
        (i === 0 ? '<span class="preview-badge">Main</span>' : '') +
        '<button type="button" class="preview-remove" data-index="' + i + '" aria-label="Remove image">&times;</button>';
      previewGrid.appendChild(item);
    });

    if (uploadedImages.length < MAX_IMAGES) {
      const addMore = document.createElement('div');
      addMore.className = 'preview-add-more';
      addMore.innerHTML =
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' +
        '<span>Add More</span>';
      addMore.addEventListener('click', (e) => {
        e.stopPropagation();
        imageInput.click();
      });
      previewGrid.appendChild(addMore);
    }

    previewGrid.querySelectorAll('.preview-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.index);
        uploadedImages.splice(idx, 1);
        renderPreviews();
      });
    });
  }

  // ===== Character Counts =====
  const prodDesc = document.getElementById('prodDesc');
  const descCount = document.getElementById('descCount');
  const seoTitle = document.getElementById('seoTitle');
  const seoTitleCount = document.getElementById('seoTitleCount');
  const seoDesc = document.getElementById('seoDesc');
  const seoDescCount = document.getElementById('seoDescCount');

  function updateCount(input, counter, max) {
    if (!input || !counter) return;
    const len = input.value.length;
    counter.textContent = len;
    counter.parentElement.className = 'ap-field-bottom';
    if (len > max * 0.9) counter.parentElement.classList.add('warning');
    if (len > max) counter.parentElement.classList.add('over');
  }

  if (prodDesc) prodDesc.addEventListener('input', () => updateCount(prodDesc, descCount, 2000));
  if (seoTitle) seoTitle.addEventListener('input', () => updateCount(seoTitle, seoTitleCount, 60));
  if (seoDesc) seoDesc.addEventListener('input', () => updateCount(seoDesc, seoDescCount, 160));

  // ===== Auto-generate slug from name =====
  const prodName = document.getElementById('prodName');
  const seoSlug = document.getElementById('seoSlug');

  if (prodName && seoSlug) {
    prodName.addEventListener('input', () => {
      if (seoSlug.dataset.manual === 'true') return;
      seoSlug.value = prodName.value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
    });
    seoSlug.addEventListener('input', () => {
      seoSlug.dataset.manual = 'true';
    });
  }

  // ===== Profit Calculator =====
  const prodPrice = document.getElementById('prodPrice');
  const prodCost = document.getElementById('prodCost');
  const profitCalc = document.getElementById('profitCalc');
  const profitValue = document.getElementById('profitValue');
  const marginValue = document.getElementById('marginValue');

  function calcProfit() {
    if (!profitCalc) return;
    const price = parseFloat(prodPrice.value) || 0;
    const cost = parseFloat(prodCost.value) || 0;

    if (price > 0 && cost > 0) {
      profitCalc.style.display = '';
      const profit = price - cost;
      profitValue.textContent = '$' + profit.toFixed(2);
      const margin = ((profit / price) * 100).toFixed(1);
      marginValue.textContent = margin + '%';
      profitValue.style.color = profit >= 0 ? '#16a34a' : '#ef4444';
      marginValue.style.color = profit >= 0 ? '#16a34a' : '#ef4444';
    } else {
      profitCalc.style.display = 'none';
    }
  }

  if (prodPrice) prodPrice.addEventListener('input', () => { calcProfit(); updateDiscountPreview(); });
  if (prodCost) prodCost.addEventListener('input', calcProfit);

  // ===== Publish Status =====
  const scheduledDate = document.getElementById('scheduledDate');
  document.querySelectorAll('input[name="publishStatus"]').forEach(radio => {
    radio.addEventListener('change', () => {
      if (scheduledDate) {
        scheduledDate.style.display = radio.value === 'scheduled' ? '' : 'none';
      }
    });
  });

  // ===== Stock Status Chips =====
  document.querySelectorAll('.ap-stock-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.ap-stock-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      chip.querySelector('input').checked = true;
    });
  });

  // ===== Tags =====
  const tagInput = document.getElementById('tagInput');
  const tagsList = document.getElementById('tagsList');
  const tagsWrap = document.getElementById('tagsWrap');
  let tags = [];

  if (tagInput && tagsList) {
    tagsWrap.addEventListener('click', () => tagInput.focus());

    tagInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        addTag(tagInput.value.replace(',', '').trim());
        tagInput.value = '';
      }
      if (e.key === 'Backspace' && tagInput.value === '' && tags.length > 0) {
        removeTag(tags.length - 1);
      }
    });
  }

  function addTag(text) {
    if (!text || tags.includes(text.toLowerCase())) return;
    tags.push(text.toLowerCase());
    renderTags();
  }

  function removeTag(index) {
    tags.splice(index, 1);
    renderTags();
  }

  function renderTags() {
    if (!tagsList) return;
    tagsList.innerHTML = '';
    tags.forEach((tag, i) => {
      const el = document.createElement('span');
      el.className = 'ap-tag';
      el.innerHTML = tag + ' <button type="button" data-idx="' + i + '">&times;</button>';
      el.querySelector('button').addEventListener('click', () => removeTag(i));
      tagsList.appendChild(el);
    });
  }

  document.querySelectorAll('.suggested-tag').forEach(btn => {
    btn.addEventListener('click', () => {
      addTag(btn.dataset.tag);
      btn.style.display = 'none';
    });
  });

  // ===== Variants =====
  const addVariantBtn = document.getElementById('addVariantBtn');
  const variantsList = document.getElementById('variantsList');

  function bindVariantRemove() {
    variantsList.querySelectorAll('.variant-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        if (variantsList.children.length > 1) {
          const row = btn.closest('.ap-variant-row');
          row.style.opacity = '0';
          row.style.transform = 'translateY(-8px)';
          row.style.transition = 'all 0.2s';
          setTimeout(() => row.remove(), 200);
        }
      });
    });
  }

  if (addVariantBtn && variantsList) {
    addVariantBtn.addEventListener('click', () => {
      const row = document.createElement('div');
      row.className = 'ap-variant-row';
      row.innerHTML =
        '<div class="variant-field"><label>Size</label><select class="variant-select"><option value="xs">XS</option><option value="s">S</option><option value="m" selected>M</option><option value="l">L</option><option value="xl">XL</option><option value="xxl">XXL</option></select></div>' +
        '<div class="variant-field"><label>Color</label><input type="text" class="variant-input" placeholder="e.g. White" /></div>' +
        '<div class="variant-field"><label>Stock</label><input type="number" class="variant-input" placeholder="0" min="0" value="0" /></div>' +
        '<div class="variant-field"><label>Price</label><div class="ap-input-prefix sm"><span>$</span><input type="number" class="variant-input" placeholder="0.00" step="0.01" min="0" /></div></div>' +
        '<button type="button" class="variant-remove" aria-label="Remove variant"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>';
      variantsList.appendChild(row);
      bindVariantRemove();
    });

    bindVariantRemove();
  }

  // ===== Sale & Discount =====
  const saleToggle = document.getElementById('saleToggle');
  const saleFields = document.getElementById('saleFields');
  const saleOverlay = document.getElementById('saleOverlay');
  const salePriceField = document.getElementById('salePriceField');
  const discountPreview = document.getElementById('discountPreview');
  const discountPct = document.getElementById('discountPct');
  const discRegular = document.getElementById('discRegular');
  const discSale = document.getElementById('discSale');
  const discSave = document.getElementById('discSave');
  const saleBadge = document.getElementById('saleBadge');
  const badgeCount = document.getElementById('badgeCount');
  const saleBadgePreview = document.getElementById('saleBadgePreview');
  const mockBadge = document.getElementById('mockBadge');
  const mockRegular = document.getElementById('mockRegular');
  const mockSalePrice = document.getElementById('mockSalePrice');
  const saleColorOptions = document.getElementById('saleColorOptions');
  let selectedSaleColor = '#ef4444';

  if (saleToggle) {
    saleToggle.addEventListener('change', () => {
      const on = saleToggle.checked;
      saleFields.style.display = on ? '' : 'none';
      saleOverlay.style.display = on ? 'none' : '';
      if (on) {
        updateDiscountPreview();
        updateBadgePreview();
        const startDate = document.getElementById('saleStartDate');
        if (startDate && !startDate.value) {
          const now = new Date();
          now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
          startDate.value = now.toISOString().slice(0, 16);
        }
      }
    });
  }

  function updateDiscountPreview() {
    if (!salePriceField || !discountPreview) return;
    const regular = parseFloat(prodPrice ? prodPrice.value : 0) || 0;
    const sale = parseFloat(salePriceField.value) || 0;

    if (sale > 0 && regular > 0 && sale < regular) {
      const pct = Math.round(((regular - sale) / regular) * 100);
      const save = regular - sale;

      discountPct.textContent = pct + '%';
      discRegular.textContent = '$' + regular.toFixed(2);
      discSale.textContent = '$' + sale.toFixed(2);
      discSave.textContent = '$' + save.toFixed(2);

      const circle = discountPreview.querySelector('.discount-circle');
      if (pct >= 50) {
        circle.style.background = '#dc2626';
        circle.style.boxShadow = '0 4px 14px rgba(220, 38, 38, 0.3)';
      } else if (pct >= 25) {
        circle.style.background = '#ef4444';
        circle.style.boxShadow = '0 4px 14px rgba(239, 68, 68, 0.3)';
      } else {
        circle.style.background = '#f97316';
        circle.style.boxShadow = '0 4px 14px rgba(249, 115, 22, 0.3)';
      }

      discountPreview.style.display = '';
    } else {
      discountPreview.style.display = 'none';
    }

    if (mockRegular && mockSalePrice) {
      mockRegular.textContent = '$' + regular.toFixed(2);
      if (sale > 0 && sale < regular) {
        mockSalePrice.textContent = '$' + sale.toFixed(2);
        mockSalePrice.style.display = '';
        mockRegular.classList.add('struck');
      } else {
        mockSalePrice.style.display = 'none';
        mockRegular.classList.remove('struck');
      }
    }
  }

  if (salePriceField) {
    salePriceField.addEventListener('input', () => {
      salePriceField.classList.remove('error');
      updateDiscountPreview();
    });
  }

  if (saleBadge && badgeCount) {
    saleBadge.addEventListener('input', () => {
      badgeCount.textContent = saleBadge.value.length;
      updateBadgePreview();
    });
  }

  if (saleColorOptions) {
    saleColorOptions.querySelectorAll('.sale-color-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        saleColorOptions.querySelectorAll('.sale-color-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedSaleColor = btn.dataset.color;
        updateBadgePreview();
      });
    });
  }

  function updateBadgePreview() {
    if (!saleBadgePreview || !mockBadge) return;
    const text = saleBadge ? saleBadge.value.trim().toUpperCase() : '';
    const sale = salePriceField ? parseFloat(salePriceField.value) || 0 : 0;
    if (text || sale > 0) {
      saleBadgePreview.style.display = '';
      mockBadge.textContent = text || 'SALE';
      mockBadge.style.background = selectedSaleColor;
    } else {
      saleBadgePreview.style.display = 'none';
    }
    updateDiscountPreview();
  }

  const saleEndDate = document.getElementById('saleEndDate');
  if (saleEndDate) {
    saleEndDate.addEventListener('input', () => {
      saleEndDate.classList.remove('error');
    });
  }

  // ===== Form Submission =====
  const addProductForm = document.getElementById('addProductForm');
  const saveDraftBtn = document.getElementById('saveDraftBtn');

  function validateForm() {
    let valid = true;
    const required = [
      { id: 'prodName', label: 'Product name' },
      { id: 'prodCategory', label: 'Category' },
      { id: 'prodPrice', label: 'Regular price' },
      { id: 'prodStock', label: 'Stock quantity' },
      { id: 'prodDesc', label: 'Description' }
    ];

    document.querySelectorAll('.ap-field input.error, .ap-field select.error, .ap-field textarea.error').forEach(el => {
      el.classList.remove('error');
    });

    for (let i = 0; i < required.length; i++) {
      const el = document.getElementById(required[i].id);
      if (el && !el.value.trim()) {
        el.classList.add('error');
        el.focus();
        valid = false;
        break;
      }
    }

    const price = document.getElementById('prodPrice');
    if (price && parseFloat(price.value) <= 0) {
      price.classList.add('error');
      price.focus();
      valid = false;
    }

    if (!valid) {
      const firstError = document.querySelector('.ap-field input.error, .ap-field select.error, .ap-field textarea.error');
      if (firstError) {
        firstError.closest('.ap-card').scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    return valid;
  }

  function validateSale() {
    if (saleToggle && saleToggle.checked) {
      const regular = parseFloat(prodPrice ? prodPrice.value : 0) || 0;
      const sale = parseFloat(salePriceField ? salePriceField.value : 0) || 0;

      if (sale <= 0) {
        salePriceField.classList.add('error');
        salePriceField.focus();
        salePriceField.closest('.ap-field').scrollIntoView({ behavior: 'smooth', block: 'center' });
        return false;
      }

      if (sale >= regular) {
        salePriceField.classList.add('error');
        salePriceField.focus();
        salePriceField.closest('.ap-field').scrollIntoView({ behavior: 'smooth', block: 'center' });
        showToast('Sale price must be lower than the regular price.');
        return false;
      }

      const startEl = document.getElementById('saleStartDate');
      const endEl = document.getElementById('saleEndDate');
      if (startEl && endEl && startEl.value && endEl.value) {
        if (new Date(endEl.value) <= new Date(startEl.value)) {
          endEl.classList.add('error');
          endEl.focus();
          endEl.closest('.ap-field').scrollIntoView({ behavior: 'smooth', block: 'center' });
          showToast('Sale end date must be after the start date.');
          return false;
        }
      }
    }
    return true;
  }

  if (addProductForm) {
    addProductForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (validateForm() && validateSale()) {
        showToast('Product published successfully!');
      }
    });
  }

  if (saveDraftBtn) {
    saveDraftBtn.addEventListener('click', () => {
      showToast('Draft saved successfully!');
    });
  }

  // ===== Toast =====
  function showToast(msg) {
    const toast = document.getElementById('apToast');
    const toastMsg = document.getElementById('apToastMsg');
    if (!toast || !toastMsg) return;
    toastMsg.textContent = msg;
    toast.classList.add('visible');
    setTimeout(() => toast.classList.remove('visible'), 3000);
  }
})();

document.addEventListener("DOMContentLoaded", () => {

    updateCartBubble();

});