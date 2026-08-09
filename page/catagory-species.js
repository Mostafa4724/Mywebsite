const SHOP_API_BASE = "http://127.0.0.1:5000";

const params = new URLSearchParams(window.location.search);
const categoryId = params.get("category");

const productGrid = document.getElementById("productGrid");
const crumbName = document.getElementById("crumbName");
const heroTitle = document.getElementById("heroTitle");
const heroCount = document.getElementById("heroCount");
const heroDesc = document.getElementById("heroDesc");
const heroTags = document.getElementById("heroTags");

document.title = "Loading...";

// Mirrors home.js isSaleActive so product cards behave identically
function isSaleActive(product) {
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

// Reuses the same product-card structure/logic as page/home.js
function renderProductCard(product, index) {
  const image =
    product.image && product.image !== ""
      ? SHOP_API_BASE + "/uploads/products/" + product.image
      : "https://picsum.photos/300/250?random=" + product.id;

  const originalPrice = Number(product.price || 0);
  const salePrice = Number(product.sale_price || 0);
  const saleActive = isSaleActive(product);
  const displayPrice = saleActive && salePrice > 0 ? salePrice : originalPrice;
  const discountPercent = saleActive && originalPrice > 0
    ? Math.round(((originalPrice - displayPrice) / originalPrice) * 100)
    : 0;

  const num = String(index + 1).padStart(2, "0");
  const delay = Math.min((index % 8) + 1, 8);

  // Reuse the .product-card / .product-card__* markup from home.js and the
  // catagory-species.css styling so the cards look identical to home.html.
  const card = document.createElement("div");
  card.className = "product-card reveal reveal-d" + delay;
  card.dataset.name = product.title;
  card.dataset.price = displayPrice;
  card.dataset.image = image;

  const badgeHTML = saleActive && product.sale_price
    ? '<span class="product-card__badge sale">-' + discountPercent + "%</span>"
    : (product.status === "published" ? '<span class="product-card__badge">New</span>' : "");

  const priceHTML = saleActive && product.sale_price
    ? '<div class="product-card__pricing">' +
      '<span class="product-card__price sale-price">$' + displayPrice.toFixed(2) + "</span>" +
      '<span class="product-card__old-price">$' + originalPrice.toFixed(2) + "</span>" +
      "</div>"
    : '<span class="product-card__price">$' + displayPrice.toFixed(2) + "</span>";

  const stockStatus = (product.stock_status || "in").toLowerCase();
  const outOfStock = stockStatus === "out";

  card.innerHTML =
    '<div class="product-card__img">' +
    '<span class="product-card__num">' + num + "</span>" +
    '<img src="' + image + '" alt="' + product.title + '" loading="lazy" />' +
    badgeHTML +
    "</div>" +
    '<div class="product-card__body">' +
    '<span class="product-card__type">' + (product.category || product.brand || "Product") + "</span>" +
    '<a href="product.html?id=' + product.id + '" style="text-decoration:none;color:inherit;">' +
    '<h3 class="product-card__name">' + product.title + "</h3>" +
    "</a>" +
    '<div class="product-card__bottom">' +
    priceHTML +
    '<button class="add-to-cart-btn" data-id="' + product.id + '" data-name="' + product.title + '" data-price="' + displayPrice + '" data-image="' + image + '"' + (outOfStock ? " disabled" : "") + ">" +
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' +
    (outOfStock ? " Sold Out" : " Add") +
    "</button>" +
    "</div>" +
    "</div>";

  return card;
}

function showEmptyMessage() {
  productGrid.innerHTML =
    '<p class="category-empty" style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--fg-muted);font-size:1rem;">' +
    "No products in this category yet.</p>";
  heroCount.textContent = "0 Products";
}

// Load category + its products from the backend
async function loadCategoryProducts() {
  if (!productGrid) return;

  try {
    // Fetch category details (by id) to populate the hero
    const catRes = await fetch(SHOP_API_BASE + "/categories/" + categoryId);
    const catData = await catRes.json();
    const category = catData.success ? catData.category : null;

    const name = category ? category.name : "Category";

    document.title = name;
    if (crumbName) crumbName.textContent = name;
    if (heroTitle) heroTitle.textContent = name;
    if (heroTags) {
      heroTags.innerHTML = '<span class="fw-tag">' + name + "</span>";
    }

    // Fetch products filtered by category id (backend filtering)
    const prodUrl = SHOP_API_BASE + "/products" +
      (categoryId ? "?category_id=" + encodeURIComponent(categoryId) : "");

    const res = await fetch(prodUrl);
    const data = await res.json();

    if (!data.success) {
      showEmptyMessage();
      return;
    }

    if (heroDesc) {
      heroDesc.textContent =
        "Browse all products in the " + name + " category.";
    }

    productGrid.innerHTML = "";

    if (data.products.length === 0) {
      showEmptyMessage();
      return;
    }

    if (heroCount) heroCount.textContent = data.products.length + " Products";

    data.products.forEach((product, index) => {
      const card = renderProductCard(product, index);
      productGrid.appendChild(card);
    });

    initReveal();
    bindAddToCart();
    initTilt();
  } catch (err) {
    console.error("Failed to load category products:", err);
    if (productGrid) showEmptyMessage();
  }
}

/* ===== SCROLL REVEAL ===== */
function initReveal() {
  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
        }
      });
    },
    { threshold: 0.06, rootMargin: "0px 0px -30px 0px" }
  );

  document.querySelectorAll(".reveal").forEach(function (el) {
    observer.observe(el);
  });
}

/* ===== ADD TO CART ===== */
function bindAddToCart() {
  document.querySelectorAll(".add-to-cart-btn").forEach(function (btn) {
    if (btn.dataset.cartBound) return;
    btn.dataset.cartBound = "1";

    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();

      var name = this.dataset.name || "";
      var price = this.dataset.price || "0";
      var image = this.dataset.image || "";

      if (typeof addToCart === "function") {
        const productId = this.dataset.id || null;
        addToCart(name, price, image, productId);
        updateCartBubble();
      }

      var originalHTML = this.innerHTML;
      this.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Added';
      this.classList.add("added");

      var self = this;
      setTimeout(function () {
        self.innerHTML = originalHTML;
        self.classList.remove("added");
      }, 1500);
    });
  });
}

/* ===== CARD TILT ===== */
function initTilt() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  document.querySelectorAll(".product-card").forEach(function (card) {
    if (card.dataset.tiltBound) return;
    card.dataset.tiltBound = "1";

    card.addEventListener("mousemove", function (e) {
      var rect = this.getBoundingClientRect();
      var x = e.clientX - rect.left;
      var y = e.clientY - rect.top;
      var cx = rect.width / 2;
      var cy = rect.height / 2;
      var rx = ((y - cy) / cy) * -2.5;
      var ry = ((x - cx) / cx) * 2.5;
      this.style.transform =
        "translateY(-8px) perspective(700px) rotateX(" +
        rx + "deg) rotateY(" + ry + "deg)";
    });

    card.addEventListener("mouseleave", function () {
      this.style.transform = "";
    });
  });
}

loadCategoryProducts();

