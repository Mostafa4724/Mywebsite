function isStorefrontProductVisible(product) {
  return String(product && product.status || "draft").toLowerCase() === "published";
}

const productsContainer = document.getElementById("product-container");
const homeSearch = document.getElementById("homeProductSearch");
const homeSearchEmpty = document.getElementById("product-search-empty");
let homeProducts = [];

// ==========================================================================
// Home page uses the SHARED product-card renderer from /script.js
// (buildProductCard / isSaleActive / getDisplayPrice). This keeps home cards
// and category cards identical — same markup, sale logic, navigation to
// product.html?id=..., add-to-cart, availability, etc.
// ==========================================================================

// Render one product card into the container and wire up its Add to Cart.
function appendProductCard(product, index) {
  const built = buildProductCard(product, index);

  const wrapper = document.createElement("div");
  wrapper.innerHTML = built.html.trim();
  const card = wrapper.firstChild;
  productsContainer.appendChild(card);

  const images = (card.dataset.images || "").split("|").filter(Boolean);
  if (images.length > 1) {
    let current = 0;
    const layers = Array.from(card.querySelectorAll(".product-card-img"));
    const timer = setInterval(() => {
      if (!document.body.contains(card)) {
        clearInterval(timer);
        return;
      }
      layers[current]?.classList.remove("active");
      if (layers[current]) {
        layers[current].style.opacity = "0";
        layers[current].style.transform = "scale(1.02)";
      }
      current = (current + 1) % layers.length;
      if (layers[current]) {
        layers[current].classList.add("active");
        layers[current].style.opacity = "1";
        layers[current].style.transform = "scale(1)";
      }
    }, 3000);
    card._imageRotationTimer = timer;
  }

  // Bind Add to Cart while leaving the rest of the card clickable (navigates
  // to product.html?id=... via the wrapper link built in buildProductCard).
  const button = card.querySelector(".add-to-cart-btn");
  if (button && button.getAttribute("disabled") === null) {
    button.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();

      const name = this.dataset.name || "";
      const price = this.dataset.price || "0";
      const image = this.dataset.image || "";
      const productId = this.dataset.id || null;

      if (typeof addToCart === "function") {
        addToCart(name, price, image, productId);
      }

      refreshCartAfterAdd(this, name);
    });
  }
}

function matchesHomeSearch(product, rawQuery) {
  const query = String(rawQuery || "").trim().toLowerCase();
  if (!query) return true;
  const salePrice = Number(product.sale_active ? product.sale_price : product.price) || 0;
  const text = [
    product.title,
    product.category,
    product.tags,
    Array.isArray(product.tags) ? product.tags.join(" ") : "",
  ].filter(Boolean).join(" ").toLowerCase();
  const range = query.match(/^price\s*(<=|>=|=|<|>)\s*([0-9]+(?:\.[0-9]+)?)$/i) || query.match(/^(<=|>=|=|<|>)\s*([0-9]+(?:\.[0-9]+)?)$/);
  if (range) {
    const op = range[1], value = Number(range[2]);
    return op === "<" ? salePrice < value : op === "<=" ? salePrice <= value : op === ">" ? salePrice > value : op === ">=" ? salePrice >= value : Math.abs(salePrice - value) < 0.01;
  }
  if (/^price\s*:\s*/i.test(query)) {
    const value = Number(query.replace(/^price\s*:\s*/i, ""));
    return Number.isFinite(value) && Math.abs(salePrice - value) < 0.01;
  }
  if (/^\$?\d+(?:\.\d+)?$/.test(query)) {
    const value = Number(query.replace("$", ""));
    return Math.abs(salePrice - value) < 0.01;
  }
  return text.includes(query) || String(salePrice).includes(query);
}

function renderHomeProducts() {
  productsContainer.querySelectorAll(".product-card").forEach((card) => {
    if (card._imageRotationTimer) clearInterval(card._imageRotationTimer);
  });
  productsContainer.innerHTML = "";
  const query = homeSearch?.value || "";
  const visibleProducts = homeProducts.filter(isStorefrontProductVisible).filter((p) => matchesHomeSearch(p, query));
  visibleProducts.forEach((product, index) => appendProductCard(product, index));
  if (homeSearchEmpty) homeSearchEmpty.hidden = visibleProducts.length > 0;
}

async function loadProducts() {
  try {
    const response = await fetch("http://127.0.0.1:5000/products");
    const data = await response.json();
    if (!data.success) return;
    homeProducts = data.products || [];
    renderHomeProducts();
  } catch (err) {
    console.log(err);
  }
}

homeSearch?.addEventListener("input", renderHomeProducts);

loadProducts();

