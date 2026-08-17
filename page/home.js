function isStorefrontProductVisible(product) {
  const status = String(product && product.status || "draft").toLowerCase();

  if (status === "published") return true;

  if (status === "scheduled") {
    if (!product.scheduled_date) return false;
    const scheduled = new Date(product.scheduled_date);
    return !Number.isNaN(scheduled.getTime()) && new Date() >= scheduled;
  }

  return false;
}

const productsContainer = document.getElementById("product-container");

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

async function loadProducts() {
  try {
    const response = await fetch("http://127.0.0.1:5000/products");
    const data = await response.json();

    if (!data.success) {
      return;
    }

    productsContainer.innerHTML = "";

    const visibleProducts = data.products.filter(isStorefrontProductVisible);

    visibleProducts.forEach((product, index) => {
      appendProductCard(product, index);
    });
  } catch (err) {
    console.log(err);
  }
}

loadProducts();

