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


  // ---------------------------------------------------------------------------
  // Category Management (Admin Products page only)
  // ---------------------------------------------------------------------------
  const addCategoryBtn = document.getElementById("addCategoryBtn");
  const categoryModal = document.getElementById("categoryManagementModal");
  const categoryNameInput = document.getElementById("adminNewCategoryName");
  const categoryImageInput = document.getElementById("adminCategoryImage");
  const categoryImagePreview = document.getElementById("adminCategoryImagePreview");
  const categoryList = document.getElementById("adminCategoryList");
  const categoryError = document.getElementById("adminCategoryError");

  function authHeaders() {
    const t = getToken();
    return t ? { Authorization: "Bearer " + t } : {};
  }

  function renderCategoryManagementList(categories) {
    if (!categoryList) return;
    categoryList.innerHTML = "";
    if (!categories.length) {
      categoryList.innerHTML = '<div class="admin-category-empty">No categories yet.</div>';
      return;
    }
    categories.forEach((cat) => {
      const row = document.createElement("div"); row.className = "admin-category-row";
      if (cat.image_url) {
        const img = document.createElement("img"); img.className="admin-category-thumb"; img.src=API_BASE+cat.image_url; img.alt=cat.name;
        row.appendChild(img);
      } else {
        const spacer=document.createElement("div"); spacer.className="admin-category-thumb"; row.appendChild(spacer);
      }
      const name=document.createElement("span"); name.className="admin-category-name"; name.textContent=cat.name; row.appendChild(name);
      const del=document.createElement("button"); del.type="button"; del.className="admin-category-delete"; del.textContent="×"; del.setAttribute("aria-label","Delete "+cat.name);
      del.addEventListener("click",()=>deleteAdminCategory(cat.id,cat.name)); row.appendChild(del);
      categoryList.appendChild(row);
    });
  }

  async function refreshCategoryManagementList() {
    const response=await fetch(API_BASE+"/categories",{cache:"no-store"});
    const data=await response.json();
    if(!response.ok || !data.success) throw new Error(data.message || "Could not load categories.");
    categoriesById={}; (data.categories||[]).forEach(c=>categoriesById[String(c.id)]=c.name);
    renderCategoryManagementList(data.categories||[]);
    window.dispatchEvent(new CustomEvent("categoriesUpdated",{detail:data.categories||[]}));
  }

  function openCategoryManagement() {
    if(!categoryModal) return;
    categoryModal.hidden=false; categoryModal.style.display="flex";
    categoryNameInput.value=""; categoryImageInput.value=""; categoryError.textContent="";
    categoryImagePreview.innerHTML="<span>Image preview</span>";
    refreshCategoryManagementList().catch(e=>categoryError.textContent=e.message);
    setTimeout(()=>categoryNameInput.focus(),30);
  }
  function closeCategoryManagement(){ if(categoryModal){categoryModal.hidden=true;categoryModal.style.display="none";} }

  categoryImageInput?.addEventListener("change",()=>{
    const file=categoryImageInput.files && categoryImageInput.files[0];
    if(!file){categoryImagePreview.innerHTML="<span>Image preview</span>";return;}
    const url=URL.createObjectURL(file); const img=new Image(); img.onload=()=>URL.revokeObjectURL(url); img.src=url;
    categoryImagePreview.innerHTML=""; categoryImagePreview.appendChild(img);
  });

  async function createAdminCategory(e) {
    e?.preventDefault();
    // IMPORTANT: read the live fields, not cached values.
    const name=(document.getElementById("adminNewCategoryName")?.value || "").trim();
    const file=document.getElementById("adminCategoryImage")?.files?.[0] || null;
    categoryError.textContent="";
    if(!name){categoryError.textContent="Category name is required.";return;}
    if(!file){categoryError.textContent="Please choose a category image.";return;}
    const token=getToken(); if(!token){categoryError.textContent="Your admin session has expired. Please log in again.";return;}
    const formData=new FormData(); formData.append("name",name); formData.append("image",file);
    const button=document.getElementById("adminSaveCategory"); button.disabled=true; button.textContent="Creating...";
    try{
      const response=await fetch(API_BASE+"/categories",{method:"POST",headers:{Authorization:"Bearer "+token},body:formData});
      const data=await response.json();
      if(!response.ok || !data.success) throw new Error(data.message || "Could not create category.");
      await refreshCategoryManagementList();
      window.dispatchEvent(new StorageEvent("storage",{key:"categoryListChanged"}));
      categoryNameInput.value=""; categoryImageInput.value=""; categoryImagePreview.innerHTML="<span>Image preview</span>";
      categoryError.textContent="";
    }catch(error){categoryError.textContent=error.message || "Could not create category.";}
    finally{button.disabled=false;button.textContent="Create Category";}
  }

  async function deleteAdminCategory(id,name){
    if(!window.confirm('Are you sure you want to delete "'+name+'"?')) return;
    const token=getToken(); if(!token){window.alert("Your admin session has expired. Please log in again.");return;}
    try{
      const response=await fetch(API_BASE+"/categories/"+encodeURIComponent(id),{method:"DELETE",headers:{Authorization:"Bearer "+token}});
      const data=await response.json(); if(!response.ok || !data.success) throw new Error(data.message || "Could not delete category.");
      await refreshCategoryManagementList(); await loadProducts();
      window.dispatchEvent(new StorageEvent("storage",{key:"categoryListChanged"}));
    }catch(error){window.alert(error.message || "Could not delete category.");}
  }

  addCategoryBtn?.addEventListener("click",openCategoryManagement);
  document.getElementById("categoryManagementClose")?.addEventListener("click",closeCategoryManagement);
  document.getElementById("categoryManagementCancel")?.addEventListener("click",closeCategoryManagement);
  document.getElementById("adminSaveCategory")?.addEventListener("click",createAdminCategory);
  categoryNameInput?.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();createAdminCategory(e);}});
  categoryModal?.addEventListener("click",e=>{if(e.target===categoryModal)closeCategoryManagement();});

  async function init() {
    await loadCategories();
    await refreshCategoryManagementList().catch(console.warn);
    await loadProducts();
  }

  init();
})();
