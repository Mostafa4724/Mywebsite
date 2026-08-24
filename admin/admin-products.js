(function () {
  "use strict";

  const API_BASE = "http://127.0.0.1:5000";

  const publishedGrid = document.getElementById("publishedProductsGrid");
  const draftGrid = document.getElementById("draftProductsGrid");

  const publishedCount = document.getElementById("publishedProductsCount");
  const draftCount = document.getElementById("draftProductsCount");

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
    if (product.category && String(product.category).trim()) {
      return String(product.category).trim();
    }

    if (
      product.category_id != null &&
      categoriesById[String(product.category_id)]
    ) {
      return categoriesById[String(product.category_id)];
    }

    return "Uncategorized";
  }

  function getImageUrl(product) {
    if (product.image) {
      return (
        API_BASE +
        "/uploads/products/" +
        encodeURIComponent(product.image)
      );
    }

    return (
      "https://picsum.photos/300/300?random=" +
      encodeURIComponent(product.id)
    );
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

  function normalizeStatus(product) {
    const status = String(product.status || "draft").toLowerCase();

    if (status === "published") return "published";
    return "draft";
  }


  function createProductCard(product) {
    const stock = getStockState(product);
    const saleActive = isSaleActive(product);
    const regularPrice = Number(product.price || 0);
    const salePrice = Number(product.sale_price || 0);
    const currentPrice = saleActive ? salePrice : regularPrice;
    const categoryName = getCategoryName(product);
    const status = normalizeStatus(product);

    const card = document.createElement("div");
    card.className = "product-admin-card";
    card.dataset.productId = product.id;
    card.dataset.status = status;

    const statusBadge =
      status === "draft"
        ? '<span class="product-publish-status draft">Draft</span>'
        : '<span class="product-publish-status published">Published</span>';


    card.innerHTML =
      '<div class="product-admin-thumb">' +
        '<img src="' +
        escapeHtml(getImageUrl(product)) +
        '" alt="' +
        escapeHtml(product.title) +
        '" loading="lazy">' +
        statusBadge +
        '<span class="product-stock ' +
        stock.className +
        '">' +
        stock.label +
        "</span>" +
      '</div>' +
      '<div class="product-admin-body">' +
        '<h4>' +
        escapeHtml(product.title) +
        "</h4>" +
        '<span class="product-admin-id">ID: ' +
        escapeHtml(product.id) +
        "</span>" +
        '<span class="product-category">' +
        escapeHtml(categoryName) +
        "</span>" +
        '<span class="product-admin-price">$' +
        currentPrice.toFixed(2) +
        (saleActive
          ? ' <span class="product-admin-original-price">$' +
            regularPrice.toFixed(2) +
            "</span>"
          : "") +
        "</span>" +
        (saleActive
          ? '<span class="product-admin-sale">' +
            escapeHtml(product.sale_badge || "Sale") +
            "</span>"
          : "") +
        '<p class="product-admin-stock-text">Stock: ' +
        escapeHtml(product.stock) +
        " units</p>" +
      "</div>" +
      '<div class="product-admin-actions">' +
        '<a class="btn-text" href="edit.html?id=' +
        encodeURIComponent(product.id) +
        '">Edit</a>' +
        '<button class="btn-text danger delete-product-btn" type="button">Delete</button>' +
      "</div>";

    card
      .querySelector(".delete-product-btn")
      .addEventListener("click", function () {
        deleteProduct(product);
      });

    return card;
  }

  function renderSection(grid, countEl, list, emptyMessage) {
    if (!grid) return;

    grid.innerHTML = "";

    if (countEl) {
      countEl.textContent = String(list.length);
    }

    if (!list.length) {
      grid.innerHTML =
        '<div class="admin-products-message">' +
        escapeHtml(emptyMessage) +
        "</div>";
      return;
    }

    list.forEach(function (product) {
      grid.appendChild(createProductCard(product));
    });
  }

  function filterProducts(list) {
    const query = (searchInput ? searchInput.value : "")
      .trim()
      .toLowerCase();

    if (!query) return list;

    return list.filter(function (product) {
      return (
        String(product.id).toLowerCase().includes(query) ||
        String(product.title || "").toLowerCase().includes(query) ||
        getCategoryName(product).toLowerCase().includes(query)
      );
    });
  }

  function renderProducts(list) {
    const filtered = filterProducts(list);

    const published = filtered.filter(function (product) {
      return normalizeStatus(product) === "published";
    });

    const draft = filtered.filter(function (product) {
      return normalizeStatus(product) === "draft";
    });

    renderSection(
      publishedGrid,
      publishedCount,
      published,
      "No published products."
    );

    renderSection(
      draftGrid,
      draftCount,
      draft,
      "No draft products."
    );

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
    if (publishedGrid) {
      publishedGrid.innerHTML =
        '<div class="admin-products-message">Loading products...</div>';
    }

    try {
      const response = await fetch(API_BASE + "/products");

      if (!response.ok) {
        throw new Error(
          "Products request failed: " + response.status
        );
      }

      const data = await response.json();

      if (!data.success || !Array.isArray(data.products)) {
        throw new Error(
          data.message || "Invalid products response"
        );
      }

      products = data.products;
      renderProducts(products);
    } catch (error) {
      console.error(
        "Failed to load admin products:",
        error
      );

      const errorHtml =
        '<div class="admin-products-message">Unable to load products. Please try again.</div>';

      if (publishedGrid) publishedGrid.innerHTML = errorHtml;
      if (draftGrid) draftGrid.innerHTML = errorHtml;
    }
  }

  async function deleteProduct(product) {
    if (
      !window.confirm(
        'Delete "' +
          product.title +
          '"? This will remove it from the database.'
      )
    ) {
      return;
    }

    const token = getToken();

    if (!token) {
      window.alert(
        "Your admin session has expired. Please log in again."
      );
      return;
    }

    try {
      const response = await fetch(
        API_BASE +
          "/admin/products/" +
          product.id,
        {
          method: "DELETE",
          headers: {
            Authorization: "Bearer " + token,
          },
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            "Could not delete product."
        );
      }

      await loadProducts();
    } catch (error) {
      console.error(
        "Failed to delete product:",
        error
      );

      window.alert(
        error.message ||
          "Unable to delete product. Please try again."
      );
    }
  }


  // ---------------------------------------------------------------------------
  // Category management
  // ---------------------------------------------------------------------------
  const addCategoryBtn = document.getElementById("addCategoryBtn");
  const categoryManagerModal = document.getElementById("categoryManagerModal");
  const categoryManagerClose = document.getElementById("categoryManagerClose");
  const categoryManagerCancel = document.getElementById("categoryManagerCancel");
  const categoryManagerSave = document.getElementById("categoryManagerSave");
  const categoryManagerName = document.getElementById("categoryManagerName");
  const categoryManagerError = document.getElementById("categoryManagerError");
  const categoryManagerList = document.getElementById("categoryManagerList");

  function getCategoryAuthHeaders() {
    const token = getToken();
    return token ? { Authorization: "Bearer " + token } : {};
  }

  function setCategoryError(message) {
    if (categoryManagerError) categoryManagerError.textContent = message || "";
  }

  function renderCategoryManagerList(categories) {
    if (!categoryManagerList) return;

    categoryManagerList.innerHTML = "";

    if (!categories.length) {
      categoryManagerList.innerHTML =
        '<div class="category-list-message">No categories have been added yet.</div>';
      return;
    }

    categories.forEach((category) => {
      const row = document.createElement("div");
      row.className = "category-manager-item";
      row.dataset.categoryId = String(category.id);

      const name = document.createElement("span");
      name.className = "category-manager-name";
      name.textContent = category.name;

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "category-delete-btn";
      deleteBtn.title = "Delete category";
      deleteBtn.setAttribute("aria-label", `Delete category ${category.name}`);
      deleteBtn.textContent = "×";

      deleteBtn.addEventListener("click", () => deleteCategory(category));

      row.appendChild(name);
      row.appendChild(deleteBtn);
      categoryManagerList.appendChild(row);
    });
  }

  async function fetchCategoriesForManager() {
    const response = await fetch(API_BASE + "/categories");
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Could not load categories.");
    }

    const categories = Array.isArray(data.categories) ? data.categories : [];
    categoriesById = {};
    categories.forEach((category) => {
      categoriesById[String(category.id)] = category.name;
    });

    renderCategoryManagerList(categories);
    return categories;
  }

  function openCategoryManager() {
    if (!categoryManagerModal) return;

    setCategoryError("");
    if (categoryManagerName) categoryManagerName.value = "";

    categoryManagerModal.removeAttribute("hidden");
    categoryManagerModal.classList.add("show");
    categoryManagerModal.style.display = "flex";

    fetchCategoriesForManager().catch((error) => {
      console.error("Failed to load categories:", error);
      if (categoryManagerList) {
        categoryManagerList.innerHTML =
          '<div class="category-list-message">Could not load categories.</div>';
      }
      setCategoryError(error.message);
    });

    setTimeout(() => categoryManagerName?.focus(), 50);
  }

  function closeCategoryManager() {
    if (!categoryManagerModal) return;
    categoryManagerModal.classList.remove("show");
    categoryManagerModal.style.display = "none";
    categoryManagerModal.setAttribute("hidden", "");
    setCategoryError("");
  }

  async function createCategoryFromManager() {
    if (!categoryManagerName || !categoryManagerSave) return;

    const name = categoryManagerName.value.trim();
    if (!name) {
      setCategoryError("Category name is required.");
      categoryManagerName.focus();
      return;
    }

    const token = getToken();
    if (!token) {
      setCategoryError("Your admin session has expired. Please log in again.");
      return;
    }

    setCategoryError("");
    categoryManagerSave.disabled = true;
    categoryManagerSave.textContent = "Saving...";

    try {
      const response = await fetch(API_BASE + "/categories", {
        method: "POST",
        headers: {
          ...getCategoryAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Could not create category.");
      }

      categoryManagerName.value = "";
      await fetchCategoriesForManager();

      // Let already-open Add/Edit Product pages refresh their dropdowns.
      localStorage.setItem("categoryListChanged", String(Date.now()));

      showToast(`Category "${data.category.name}" created!`);
      categoryManagerName.focus();
    } catch (error) {
      console.error("Failed to create category:", error);
      setCategoryError(error.message || "Could not create category.");
    } finally {
      categoryManagerSave.disabled = false;
      categoryManagerSave.textContent = "Add Category";
    }
  }

  async function deleteCategory(category) {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${category.name}"?`
    );

    if (!confirmed) return;

    const token = getToken();
    if (!token) {
      window.alert("Your admin session has expired. Please log in again.");
      return;
    }

    try {
      const response = await fetch(
        API_BASE + "/categories/" + encodeURIComponent(category.id),
        {
          method: "DELETE",
          headers: getCategoryAuthHeaders(),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Could not delete category.");
      }

      await fetchCategoriesForManager();
      localStorage.setItem("categoryListChanged", String(Date.now()));
      showToast(`Category "${category.name}" deleted.`);
    } catch (error) {
      console.error("Failed to delete category:", error);
      window.alert(error.message || "Could not delete category. Please try again.");
    }
  }

  if (addCategoryBtn) {
    addCategoryBtn.addEventListener("click", openCategoryManager);
  }

  categoryManagerClose?.addEventListener("click", closeCategoryManager);
  categoryManagerCancel?.addEventListener("click", closeCategoryManager);
  categoryManagerSave?.addEventListener("click", createCategoryFromManager);

  categoryManagerName?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      createCategoryFromManager();
    }
  });

  categoryManagerModal?.addEventListener("click", (event) => {
    if (event.target === categoryManagerModal) closeCategoryManager();
  });

  if (searchInput) {
    searchInput.addEventListener(
      "input",
      function () {
        renderProducts(products);
      }
    );
  }

  if (addProductBtn) {
    addProductBtn.addEventListener(
      "click",
      function () {
        window.location.href =
          "add.html";
      }
    );
  }

  async function init() {
    await loadCategories();
    await loadProducts();
  }

  init();
})();
