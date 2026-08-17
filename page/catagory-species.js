function isStorefrontProductVisible(product) {
  return String(product && product.status || "draft").toLowerCase() === "published";
}

// SHOP_API_BASE is provided globally by /script.js (loaded first).
const params = new URLSearchParams(window.location.search);
const categoryId = params.get("category");

const productGrid = document.getElementById("productGrid");
const crumbName = document.getElementById("crumbName");
const heroTitle = document.getElementById("heroTitle");
const heroCount = document.getElementById("heroCount");
const heroDesc = document.getElementById("heroDesc");
const heroTags = document.getElementById("heroTags");

document.title = "Loading...";

function renderProductCard(product, index) {
  var built = buildProductCard(product, index);
  var wrapper = document.createElement("div");
  wrapper.innerHTML = built.html.trim();
  return wrapper.firstChild;
}

function showEmptyMessage() {
  productGrid.innerHTML =
    '<p class="category-empty" style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--fg-muted);font-size:1rem;">' +
    "No products in this category yet.</p>";
  heroCount.textContent = "0 Products";
}

async function loadCategoryProducts() {
  if (!productGrid) return;

  try {
    var catRes = await fetch(SHOP_API_BASE + "/categories/" + categoryId);
    var catData = await catRes.json();
    var category = catData.success ? catData.category : null;

    var name = category ? category.name : "Category";

    document.title = name;
    if (crumbName) crumbName.textContent = name;
    if (heroTitle) heroTitle.textContent = name;
    if (heroTags) {
      heroTags.innerHTML = '<span class="fw-tag">' + name + "</span>";
    }

    var prodUrl =
      SHOP_API_BASE +
      "/products" +
      (categoryId ? "?category_id=" + encodeURIComponent(categoryId) : "");

    var res = await fetch(prodUrl);
    var data = await res.json();

    if (!data.success) {
      showEmptyMessage();
      return;
    }

    if (heroDesc) {
      heroDesc.textContent =
        "Browse all products in the " + name + " category.";
    }

    productGrid.innerHTML = "";

    const visibleProducts = data.products.filter(isStorefrontProductVisible);

    if (visibleProducts.length === 0) {
      showEmptyMessage();
      return;
    }

    if (heroCount) heroCount.textContent = visibleProducts.length + " Products";

    visibleProducts.forEach(function (product, index) {
      var card = renderProductCard(product, index);
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
      var productId = this.dataset.id || null;

      if (typeof addToCart === "function") {
        addToCart(name, price, image, productId);
      }

      refreshCartAfterAdd(this, name);
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
        rx +
        "deg) rotateY(" +
        ry +
        "deg)";
    });

    card.addEventListener("mouseleave", function () {
      this.style.transform = "";
    });
  });
}

loadCategoryProducts();