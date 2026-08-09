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

// ==========================================================================
// Category products page uses the SAME SHARED product-card renderer from
// /script.js (buildProductCard / isSaleActive / getDisplayPrice) that home.html
// uses. This guarantees the category cards are pixel-for-pixel identical and
// behave the same: sale display, price, image, whole-card navigation to
// product.html?id=..., add-to-cart, availability/out-of-stock.
// ==========================================================================

function renderProductCard(product, index) {
  // Build a detached element using the shared renderer.
  const built = buildProductCard(product, index);
  const wrapper = document.createElement("div");
  wrapper.innerHTML = built.html.trim();
  return wrapper.firstChild;
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
    const prodUrl =
      SHOP_API_BASE +
      "/products" +
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

