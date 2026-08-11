(function () {
  "use strict";

  const API_BASE = "http://127.0.0.1:5000";
  const grid = document.getElementById("adminProductsGrid");
  const message = document.getElementById("adminProductsMessage");
  const searchInput = document.getElementById("productSearch");
  const addProductBtn = document.getElementById("addProductBtn");

  let products = [];
  let categoriesById = {};

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getToken() {
    return sessionStorage.getItem("token");
  }

  function getCategoryName(product) {
    // Prefer the category name already returned by the product API.
    if (product.category && String(product.category).trim()) {
      return String(product.category).trim();
    }

    // If the product stores only category_id, resolve it against the real
    // categories table through the existing public categories endpoint.
    if (product.category_id != null && categoriesById[String(product.category_id)]) {
      return categoriesById[String(product.category_id)];
    }

    return "Uncategorized";
  }

  function getImageUrl(product) {
    if (product.image) {
      return API_BASE + "/uploads/products/" + encodeURIComponent(product.image);
    }
    return "https://picsum.photos/300/300?random=" + encodeURIComponent(product.id);
  }

  function getStockState(product) {
    const state = String(product.stock_status || "").toLowerCase();

    if (state === "out") {
      return { label: "Out of Stock", className: "out-stock" };
    }
    if (state === "low") {
      return { label: "Low Stock", className: "low-stock" };
    }
    return { label: "In Stock", className: "in-stock" };
  }

  function isSaleActive(product) {
    if (!product || !product.sale_enabled) return false;

    const regular = Number(product.price || 0);
    const sale = Number(product.sale_price || 0);

    if (!(sale > 0 && regular > sale)) return false;

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

  function renderProducts(list) {
    grid.innerHTML = "";

    if (!list.length) {
      grid.innerHTML = '<div class="admin-products-message">No products found.</div>';
      return;
    }

    list.forEach(function (product) {
      const stock = getStockState(product);
      const saleActive = isSaleActive(product);
      const regularPrice = Number(product.price || 0);
      const salePrice = Number(product.sale_price || 0);
      const currentPrice = saleActive ? salePrice : regularPrice;
      const categoryName = getCategoryName(product);

      const card = document.createElement("div");
      card.className = "product-admin-card";
      card.dataset.productId = product.id;

      card.innerHTML =
        '<div class="product-admin-thumb">' +
          '<img src="' + escapeHtml(getImageUrl(product)) + '" alt="' + escapeHtml(product.title) + '" loading="lazy">' +
          '<span class="product-stock ' + stock.className + '">' + stock.label + '</span>' +
        '</div>' +
        '<div class="product-admin-body">' +
          '<h4>' + escapeHtml(product.title) + '</h4>' +
          '<span class="product-admin-id">ID: ' + escapeHtml(product.id) + '</span>' +
          '<span class="product-category">' + escapeHtml(categoryName) + '</span>' +
          '<span class="product-admin-price">$' + currentPrice.toFixed(2) +
            (saleActive ? ' <span class="product-admin-original-price">$' + regularPrice.toFixed(2) + '</span>' : '') +
          '</span>' +
          (saleActive
            ? '<span class="product-admin-sale">' + escapeHtml(product.sale_badge || "Sale") + '</span>'
            : '') +
          '<p class="product-admin-stock-text">Stock: ' + escapeHtml(product.stock) + ' units</p>' +
        '</div>' +
        '<div class="product-admin-actions">' +
          '<a class="btn-text" href="edit.html?id=' + encodeURIComponent(product.id) + '">Edit</a>' +
          '<button class="btn-text danger delete-product-btn" type="button">Delete</button>' +
        '</div>';

      card.querySelector(".delete-product-btn").addEventListener("click", function () {
        deleteProduct(product);
      });

      grid.appendChild(card);
    });
  }

  async function loadCategories() {
    try {
      const response = await fetch(API_BASE + "/categories");
      if (!response.ok) return;

      const data = await response.json();
      if (!data.success) return;

      categoriesById = {};
      (data.categories || []).forEach(function (category) {
        categoriesById[String(category.id)] = category.name;
      });
    } catch (error) {
      console.warn("Could not load categories:", error);
    }
  }

  async function loadProducts() {
    grid.innerHTML = '<div class="admin-products-message">Loading products...</div>';

    try {
      // Use the same product endpoint/source of truth as home.html.
      const response = await fetch(API_BASE + "/products");

      if (!response.ok) {
        throw new Error("Products request failed: " + response.status);
      }

      const data = await response.json();

      if (!data.success || !Array.isArray(data.products)) {
        throw new Error(data.message || "Invalid products response");
      }

      products = data.products;
      renderProducts(products);
    } catch (error) {
      console.error("Failed to load admin products:", error);
      grid.innerHTML =
        '<div class="admin-products-message">Unable to load products. Please try again.</div>';
    }
  }

  async function deleteProduct(product) {
    if (!window.confirm('Delete "' + product.title + '"? This will remove it from the database.')) {
      return;
    }

    const token = getToken();
    if (!token) {
      window.alert("Your admin session has expired. Please log in again.");
      return;
    }

    try {
      const response = await fetch(API_BASE + "/admin/products/" + product.id, {
        method: "DELETE",
        headers: {
          Authorization: "Bearer " + token
        }
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Could not delete product.");
      }

      await loadProducts();
    } catch (error) {
      console.error("Failed to delete product:", error);
      window.alert(error.message || "Unable to delete product. Please try again.");
    }
  }

  if (searchInput) {
    searchInput.addEventListener("input", function () {
      const query = this.value.trim().toLowerCase();

      if (!query) {
        renderProducts(products);
        return;
      }

      renderProducts(products.filter(function (product) {
        return (
          String(product.id).toLowerCase().includes(query) ||
          String(product.title || "").toLowerCase().includes(query) ||
          getCategoryName(product).toLowerCase().includes(query)
        );
      }));
    });
  }

  if (addProductBtn) {
    addProductBtn.addEventListener("click", function () {
      window.location.href = "add.html";
    });
  }

  async function init() {
    await loadCategories();
    await loadProducts();
  }

  init();
})();
