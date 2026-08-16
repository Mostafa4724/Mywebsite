/* =============================================================================
 *  ADD PRODUCT — client script  (admin/add.js)
 *  Fixed version.
 *
 *  Requires (in this order, inside admin/add.html):
 *      <script src="script.js"></script>     <-- NOT "/script.js"
 *      <script src="add.js"></script>
 * ========================================================================== */
(function () {
  "use strict";

  const API_BASE = "http://127.0.0.1:5000";
  const ADD_CATEGORY_VALUE = "__add_category__";
  const LOGIN_PAGE = "../page/login.html";
  const PRODUCTS_PAGE = "admin_product.html";

  // ---------------------------------------------------------------------------
  // DOM
  // ---------------------------------------------------------------------------
  const form = document.getElementById("addProductForm");
  if (!form) return; // not the add-product page

  const el = (id) => document.getElementById(id);

  const categorySelect = el("prodCategory");
  const publishBtn = el("publishBtn");
  const saveDraftBtn = el("saveDraftBtn");

  const prodName = el("prodName");
  const prodDesc = el("prodDesc");
  const prodPrice = el("prodPrice");
  const prodCost = el("prodCost");
  const prodStock = el("prodStock");
  const prodLowStock = el("prodLowStock");
  const prodTax = el("prodTax");

  const addCategoryModal = el("addCategoryModal");
  const addCategoryClose = el("addCategoryClose");
  const cancelCategoryBtn = el("cancelCategoryBtn");
  const saveCategoryBtn = el("saveCategoryBtn");
  const newCategoryName = el("newCategoryName");
  const newCategoryError = el("newCategoryError");

  const saleToggle = el("saleToggle");
  const saleFields = el("saleFields");
  const saleOverlay = el("saleOverlay");
  const salePriceField = el("salePriceField");
  const saleBadge = el("saleBadge");
  const saleStartDate = el("saleStartDate");
  const saleEndDate = el("saleEndDate");
  const saleColorOptions = el("saleColorOptions");

  const discountPreview = el("discountPreview");
  const discountPct = el("discountPct");
  const discRegular = el("discRegular");
  const discSale = el("discSale");
  const discSave = el("discSave");
  const badgeCount = el("badgeCount");
  const saleBadgePreview = el("saleBadgePreview");
  const mockBadge = el("mockBadge");
  const mockRegular = el("mockRegular");
  const mockSalePrice = el("mockSalePrice");

  const profitCalc = el("profitCalc");
  const profitValue = el("profitValue");
  const marginValue = el("marginValue");
  const descCount = el("descCount");

  const tagInput = el("tagInput");
  const tagsList = el("tagsList");
  const tagsWrap = el("tagsWrap");

  const addVariantBtn = el("addVariantBtn");
  const variantsList = el("variantsList");
  const scheduledDate = el("scheduledDate");
  const scheduleDate = el("scheduleDate");

  let selectedSaleColor = "#ef4444";
  let stockStatusManual = false; // true once the user clicks a stock chip
  let submitting = false;

  // ---------------------------------------------------------------------------
  // Toast — exposed globally because script.js's image uploader calls it
  // ---------------------------------------------------------------------------
  function showToast(msg) {
    const toast = el("apToast");
    const toastMsg = el("apToastMsg");
    if (!toast || !toastMsg) {
      console.warn(msg);
      return;
    }
    toastMsg.textContent = msg;
    toast.classList.add("visible");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove("visible"), 3000);
  }
  window.showToast = showToast;

  // ---------------------------------------------------------------------------
  // Auth helpers
  // ---------------------------------------------------------------------------
  function getToken() {
    return sessionStorage.getItem("token") || "";
  }

  function getAuthHeaders(json) {
    // NOTE: never set Content-Type when sending FormData — the browser must
    // add the multipart boundary itself.
    const headers = { Authorization: "Bearer " + getToken() };
    if (json) headers["Content-Type"] = "application/json";
    return headers;
  }

  /** Reads a response safely: a Flask 500 returns HTML, not JSON. */
  async function readJson(response) {
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      return {
        success: false,
        message:
          "Server error (HTTP " +
          response.status +
          "). Check the Flask console for the traceback.",
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Categories
  // ---------------------------------------------------------------------------
  async function loadCategories() {
    if (!categorySelect) return;
    try {
      const response = await fetch(API_BASE + "/categories");
      const data = await readJson(response);
      if (!data.success) return;

      const currentValue = categorySelect.value;
      categorySelect.innerHTML =
        '<option value="" disabled selected>Select category</option>';

      (data.categories || []).forEach((cat) => {
        const opt = document.createElement("option");
        opt.value = String(cat.id);
        opt.dataset.name = cat.name;
        opt.textContent = cat.name;
        categorySelect.appendChild(opt);
      });

      const addOpt = document.createElement("option");
      addOpt.value = ADD_CATEGORY_VALUE;
      addOpt.textContent = "+ Add Category";
      categorySelect.appendChild(addOpt);

      if (currentValue && currentValue !== ADD_CATEGORY_VALUE) {
        const exists = Array.from(categorySelect.options).some(
          (o) => o.value === currentValue
        );
        if (exists) categorySelect.value = currentValue;
      }
    } catch (err) {
      console.error("Failed to load categories:", err);
      showToast("Could not load categories. Is the server running?");
    }
  }

  function openAddCategoryModal() {
    if (!addCategoryModal || !newCategoryName || !newCategoryError) return;
    newCategoryName.value = "";
    newCategoryError.textContent = "";
    addCategoryModal.removeAttribute("hidden");
    addCategoryModal.classList.add("show");
    addCategoryModal.style.display = "flex";
    setTimeout(() => newCategoryName.focus(), 50);
  }

  function closeAddCategoryModal() {
    if (!addCategoryModal) return;
    addCategoryModal.classList.remove("show");
    addCategoryModal.style.display = "none";
    addCategoryModal.setAttribute("hidden", "");
  }

  async function createCategory(event) {
    // Category creation must never submit/navigate the product form.
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    if (!newCategoryName || !newCategoryError || !saveCategoryBtn) return;

    const name = newCategoryName.value.trim();
    if (!name) {
      newCategoryError.textContent = "Category name is required.";
      return;
    }

    newCategoryError.textContent = "";
    saveCategoryBtn.disabled = true;
    saveCategoryBtn.textContent = "Saving...";

    try {
      const response = await fetch(API_BASE + "/categories", {
        method: "POST",
        headers: getAuthHeaders(true),
        body: JSON.stringify({ name: name }),
      });
      const data = await readJson(response);

      if (!response.ok || !data.success) {
        newCategoryError.textContent =
          data.message || "Could not create category.";
        return;
      }

      // Update the existing dropdown in place. Do not reload/rebuild the page.
      if (categorySelect && data.category) {
        const option = document.createElement("option");
        option.value = String(data.category.id);
        option.dataset.name = data.category.name;
        option.textContent = data.category.name;

        const addCategoryOption = Array.from(categorySelect.options).find(
          (opt) => opt.value === ADD_CATEGORY_VALUE
        );

        if (addCategoryOption) {
          categorySelect.insertBefore(option, addCategoryOption);
        } else {
          categorySelect.appendChild(option);
        }

        categorySelect.value = String(data.category.id);
      }

      closeAddCategoryModal();
      showToast('Category "' + data.category.name + '" created!');
    } catch (err) {
      console.error("Failed to create category:", err);
      newCategoryError.textContent = "Failed to connect. Please try again.";
    } finally {
      saveCategoryBtn.disabled = false;
      saveCategoryBtn.textContent = "Add Category";
    }
  }

  if (categorySelect) {
    categorySelect.addEventListener("change", function () {
      if (this.value === ADD_CATEGORY_VALUE) {
        openAddCategoryModal();
        this.value = "";
      }
    });
  }
  if (addCategoryClose)
    addCategoryClose.addEventListener("click", closeAddCategoryModal);
  if (cancelCategoryBtn)
    cancelCategoryBtn.addEventListener("click", closeAddCategoryModal);
  if (saveCategoryBtn) {
    saveCategoryBtn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      createCategory(e);
    }, true);
  }
  if (addCategoryModal) {
    addCategoryModal.addEventListener("click", (e) => {
      if (e.target === addCategoryModal) closeAddCategoryModal();
    });
  }
  if (newCategoryName) {
    newCategoryName.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        createCategory(e);
      }
    });
  }

  loadCategories();

  // ---------------------------------------------------------------------------
  // Stock status
  // ---------------------------------------------------------------------------
  function getDerivedStockStatus(stockValue, lowStockValue) {
    const stock = Number(stockValue) || 0;
    const lowStock = Number(lowStockValue) || 0;
    if (stock <= 0) return "out";
    if (stock <= lowStock) return "low";
    return "in";
  }

  function paintStockChips(status) {
    document.querySelectorAll('input[name="stockStatus"]').forEach((input) => {
      const chip = input.closest("label.ap-stock-chip");
      const active = input.value === status;
      if (chip) chip.classList.toggle("active", active);
      if (active) input.checked = true;
    });
  }

  function updateStockStatusUi() {
    if (stockStatusManual) return; // don't override an explicit user choice
    paintStockChips(
      getDerivedStockStatus(
        prodStock ? prodStock.value : 0,
        prodLowStock ? prodLowStock.value : 0
      )
    );
  }

  if (prodStock) prodStock.addEventListener("input", updateStockStatusUi);
  if (prodLowStock) prodLowStock.addEventListener("input", updateStockStatusUi);

  document.querySelectorAll(".ap-stock-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const input = chip.querySelector('input[name="stockStatus"]');
      if (!input) return;
      stockStatusManual = true;
      paintStockChips(input.value);
    });
  });

  updateStockStatusUi();

  // ---------------------------------------------------------------------------
  // Character counters + slug
  // ---------------------------------------------------------------------------
  function updateCount(input, counter, max) {
    if (!input || !counter) return;
    const len = input.value.length;
    counter.textContent = len;
    counter.parentElement.className = "ap-field-bottom";
    if (len > max * 0.9) counter.parentElement.classList.add("warning");
    if (len > max) counter.parentElement.classList.add("over");
  }

  if (prodDesc)
    prodDesc.addEventListener("input", () =>
      updateCount(prodDesc, descCount, 2000)
    );

  const seoTitle = el("seoTitle");
  const seoTitleCount = el("seoTitleCount");
  const seoDesc = el("seoDesc");
  const seoDescCount = el("seoDescCount");
  const seoSlug = el("seoSlug");

  if (seoTitle)
    seoTitle.addEventListener("input", () =>
      updateCount(seoTitle, seoTitleCount, 60)
    );
  if (seoDesc)
    seoDesc.addEventListener("input", () =>
      updateCount(seoDesc, seoDescCount, 160)
    );

  if (prodName && seoSlug) {
    prodName.addEventListener("input", () => {
      if (seoSlug.dataset.manual === "true") return;
      seoSlug.value = prodName.value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
    });
    seoSlug.addEventListener("input", () => {
      seoSlug.dataset.manual = "true";
    });
  }

  // ---------------------------------------------------------------------------
  // Profit calculator
  // ---------------------------------------------------------------------------
  function calcProfit() {
    if (!profitCalc || !prodPrice || !prodCost) return;
    const price = parseFloat(prodPrice.value) || 0;
    const cost = parseFloat(prodCost.value) || 0;

    if (price > 0 && cost > 0) {
      profitCalc.style.display = "";
      const profit = price - cost;
      profitValue.textContent = "$" + profit.toFixed(2);
      marginValue.textContent = ((profit / price) * 100).toFixed(1) + "%";
      const color = profit >= 0 ? "#16a34a" : "#ef4444";
      profitValue.style.color = color;
      marginValue.style.color = color;
    } else {
      profitCalc.style.display = "none";
    }
  }

  if (prodPrice)
    prodPrice.addEventListener("input", () => {
      calcProfit();
      updateDiscountPreview();
    });
  if (prodCost) prodCost.addEventListener("input", calcProfit);

  // ---------------------------------------------------------------------------
  // Publish status
  // ---------------------------------------------------------------------------
  document.querySelectorAll('input[name="publishStatus"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      if (scheduledDate) {
        scheduledDate.style.display = radio.value === "scheduled" ? "" : "none";
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Tags  (the `tags` array is the single source of truth)
  // ---------------------------------------------------------------------------
  const tags = [];

  function renderTags() {
    if (!tagsList) return;
    tagsList.innerHTML = "";
    tags.forEach((tag, i) => {
      const span = document.createElement("span");
      span.className = "ap-tag";
      span.textContent = tag + " ";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.innerHTML = "&times;";
      btn.addEventListener("click", () => removeTag(i));
      span.appendChild(btn);
      tagsList.appendChild(span);
    });
  }

  function addTag(text) {
    const value = (text || "").trim().toLowerCase();
    if (!value || tags.includes(value)) return;
    tags.push(value);
    renderTags();
  }

  function removeTag(index) {
    tags.splice(index, 1);
    renderTags();
  }

  if (tagInput && tagsList) {
    if (tagsWrap) tagsWrap.addEventListener("click", () => tagInput.focus());

    tagInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault(); // also stops Enter from submitting the form
        addTag(tagInput.value.replace(",", ""));
        tagInput.value = "";
      }
      if (e.key === "Backspace" && tagInput.value === "" && tags.length > 0) {
        removeTag(tags.length - 1);
      }
    });
  }

  document.querySelectorAll(".suggested-tag").forEach((btn) => {
    btn.addEventListener("click", () => {
      addTag(btn.dataset.tag);
      btn.style.display = "none";
    });
  });

  // ---------------------------------------------------------------------------
  // Variants (UI only — the backend has no variants table yet)
  // ---------------------------------------------------------------------------
  function bindVariantRemove() {
    if (!variantsList) return;
    variantsList.querySelectorAll(".variant-remove").forEach((btn) => {
      if (btn.dataset.bound === "1") return;
      btn.dataset.bound = "1";
      btn.addEventListener("click", () => {
        if (variantsList.children.length > 0) {
          const row = btn.closest(".ap-variant-row");
          row.style.transition = "all 0.2s";
          row.style.opacity = "0";
          row.style.transform = "translateY(-8px)";
          setTimeout(() => row.remove(), 200);
        }
      });
    });
  }

  if (addVariantBtn && variantsList) {
    addVariantBtn.addEventListener("click", () => {
      const row = document.createElement("div");
      row.className = "ap-variant-row";
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

  // ---------------------------------------------------------------------------
  // Sale & discount
  // ---------------------------------------------------------------------------
  if (saleToggle) {
    saleToggle.addEventListener("change", () => {
      const on = saleToggle.checked;
      if (saleFields) saleFields.style.display = on ? "" : "none";
      if (saleOverlay) saleOverlay.style.display = on ? "none" : "";
      if (on) {
        updateDiscountPreview();
        updateBadgePreview();
        if (saleStartDate && !saleStartDate.value) {
          const now = new Date();
          now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
          saleStartDate.value = now.toISOString().slice(0, 16);
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
      discountPct.textContent = pct + "%";
      discRegular.textContent = "$" + regular.toFixed(2);
      discSale.textContent = "$" + sale.toFixed(2);
      discSave.textContent = "$" + (regular - sale).toFixed(2);

      const circle = discountPreview.querySelector(".discount-circle");
      if (circle) {
        if (pct >= 50) {
          circle.style.background = "#dc2626";
          circle.style.boxShadow = "0 4px 14px rgba(220, 38, 38, 0.3)";
        } else if (pct >= 25) {
          circle.style.background = "#ef4444";
          circle.style.boxShadow = "0 4px 14px rgba(239, 68, 68, 0.3)";
        } else {
          circle.style.background = "#f97316";
          circle.style.boxShadow = "0 4px 14px rgba(249, 115, 22, 0.3)";
        }
      }
      discountPreview.style.display = "";
    } else {
      discountPreview.style.display = "none";
    }

    if (mockRegular && mockSalePrice) {
      mockRegular.textContent = "$" + regular.toFixed(2);
      if (sale > 0 && sale < regular) {
        mockSalePrice.textContent = "$" + sale.toFixed(2);
        mockSalePrice.style.display = "";
        mockRegular.classList.add("struck");
      } else {
        mockSalePrice.style.display = "none";
        mockRegular.classList.remove("struck");
      }
    }
  }

  function updateBadgePreview() {
    if (!saleBadgePreview || !mockBadge) return;
    const text = saleBadge ? saleBadge.value.trim().toUpperCase() : "";
    const sale = salePriceField ? parseFloat(salePriceField.value) || 0 : 0;
    if (text || sale > 0) {
      saleBadgePreview.style.display = "";
      mockBadge.textContent = text || "SALE";
      mockBadge.style.background = selectedSaleColor;
    } else {
      saleBadgePreview.style.display = "none";
    }
    updateDiscountPreview();
  }

  if (salePriceField) {
    salePriceField.addEventListener("input", () => {
      salePriceField.classList.remove("error");
      updateDiscountPreview();
    });
  }

  if (saleBadge && badgeCount) {
    saleBadge.addEventListener("input", () => {
      badgeCount.textContent = saleBadge.value.length;
      updateBadgePreview();
    });
  }

  if (saleColorOptions) {
    saleColorOptions.querySelectorAll(".sale-color-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        saleColorOptions
          .querySelectorAll(".sale-color-btn")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        selectedSaleColor = btn.dataset.color;
        updateBadgePreview();
      });
    });
  }

  if (saleEndDate) {
    saleEndDate.addEventListener("input", () =>
      saleEndDate.classList.remove("error")
    );
  }

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------
  function fail(element, message) {
    if (element) {
      element.classList.add("error");
      element.focus();
      const card = element.closest(".ap-card") || element.closest(".ap-field");
      if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    if (message) showToast(message);
    return false;
  }

  function validateForm() {
    document
      .querySelectorAll("input.error, select.error, textarea.error")
      .forEach((e) => e.classList.remove("error"));

    const required = [
      [prodName, "Product name is required."],
      [categorySelect, "Please choose a category."],
      [prodPrice, "Regular price is required."],
      [prodStock, "Stock quantity is required."],
      [prodDesc, "Description is required."],
    ];

    for (const [element, message] of required) {
      if (element && !String(element.value).trim()) {
        return fail(element, message);
      }
    }

    if (categorySelect && categorySelect.value === ADD_CATEGORY_VALUE) {
      return fail(categorySelect, "Please choose a category.");
    }

    const price = parseFloat(prodPrice.value);
    if (!isFinite(price) || price <= 0) {
      return fail(prodPrice, "Regular price must be greater than 0.");
    }

    const cost = parseFloat(prodCost && prodCost.value);
    if (prodCost && prodCost.value !== "" && (!isFinite(cost) || cost < 0)) {
      return fail(prodCost, "Cost must be a valid, non-negative number.");
    }

    const stock = parseInt(prodStock.value, 10);
    if (!Number.isInteger(stock) || stock < 0) {
      return fail(prodStock, "Stock must be a whole number of 0 or more.");
    }

    const lowStock = parseInt(prodLowStock && prodLowStock.value, 10);
    if (
      prodLowStock &&
      prodLowStock.value !== "" &&
      (!Number.isInteger(lowStock) || lowStock < 0)
    ) {
      return fail(prodLowStock, "Low-stock threshold must be 0 or more.");
    }

    return true;
  }

  function validateSale() {
    if (!saleToggle || !saleToggle.checked) return true;

    const regular = parseFloat(prodPrice ? prodPrice.value : 0) || 0;
    const sale = parseFloat(salePriceField ? salePriceField.value : 0) || 0;

    if (sale <= 0) {
      return fail(salePriceField, "Please enter a sale price.");
    }
    if (sale >= regular) {
      return fail(
        salePriceField,
        "Sale price must be lower than the regular price."
      );
    }
    if (saleStartDate && saleEndDate && saleStartDate.value && saleEndDate.value) {
      if (new Date(saleEndDate.value) <= new Date(saleStartDate.value)) {
        return fail(saleEndDate, "Sale end date must be after the start date.");
      }
    }
    return true;
  }

  // ---------------------------------------------------------------------------
  // Build the payload
  // ---------------------------------------------------------------------------
  function getMainImageFile() {
    // Preferred path: the uploader module in script.js.
    if (window.ProductImages && typeof window.ProductImages.getMainFile === "function") {
      return window.ProductImages.getMainFile();
    }
    // Fallback: script.js failed to load — read the raw file input directly
    // so the product image is still uploaded.
    const input = el("imageInput");
    return input && input.files && input.files[0] ? input.files[0] : null;
  }

  function buildFormData(statusOverride) {
    const fd = new FormData();

    // --- Basic information -------------------------------------------------
    fd.append("title", prodName.value.trim());
    fd.append("description", prodDesc.value.trim());
    fd.append("brand", (el("prodBrand") ? el("prodBrand").value : "").trim());

    const selectedOption = categorySelect.selectedOptions[0];
    const categoryId = categorySelect.value;
    fd.append(
      "category_id",
      categoryId && categoryId !== ADD_CATEGORY_VALUE ? categoryId : ""
    );
    fd.append(
      "category",
      selectedOption && selectedOption.dataset.name
        ? selectedOption.dataset.name
        : ""
    );

    // --- Pricing (never send "" — the backend does float() on these) --------
    fd.append("price", String(parseFloat(prodPrice.value) || 0));
    fd.append("cost", String(parseFloat(prodCost ? prodCost.value : 0) || 0));

    // --- Inventory ---------------------------------------------------------
    const stock = parseInt(prodStock.value, 10) || 0;
    const lowStock = parseInt(prodLowStock ? prodLowStock.value : "", 10);
    fd.append("stock", String(stock));
    fd.append("low_stock", String(Number.isInteger(lowStock) ? lowStock : 10));

    // The chips are derived from stock/low_stock unless the admin clicked one.
    const checked = document.querySelector('input[name="stockStatus"]:checked');
    const derived = getDerivedStockStatus(
      stock,
      Number.isInteger(lowStock) ? lowStock : 10
    );
    fd.append(
      "stock_status",
      stockStatusManual && checked ? checked.value : derived
    );

    // --- Tax ---------------------------------------------------------------
    fd.append("tax_class", prodTax ? prodTax.value : "standard");

    // --- Publish status ----------------------------------------------------
    const publishStatus = document.querySelector(
      'input[name="publishStatus"]:checked'
    );
    const status = statusOverride || (publishStatus ? publishStatus.value : "draft");
    fd.append("status", status);
    if (status === "scheduled" && scheduleDate && scheduleDate.value) {
      fd.append("scheduled_at", scheduleDate.value);
    }

    // --- Sale --------------------------------------------------------------
    const saleOn = !!(saleToggle && saleToggle.checked);
    fd.append("sale_enabled", saleOn ? "true" : "false");

    if (saleOn) {
      // Only send sale data when the sale is actually enabled. Sending a
      // leftover sale price with the toggle off puts the product on sale,
      // because the backend re-enables it when sale_price < price.
      fd.append("sale_price", String(parseFloat(salePriceField.value) || 0));
      if (saleBadge && saleBadge.value.trim()) {
        fd.append("sale_badge", saleBadge.value.trim());
      }
      if (saleStartDate && saleStartDate.value) {
        fd.append("sale_start", saleStartDate.value);
      }
      if (saleEndDate && saleEndDate.value) {
        fd.append("sale_end", saleEndDate.value);
      }
      fd.append("sale_badge_color", selectedSaleColor);
    } else {
      fd.append("sale_price", "");
    }

    // --- Tags --------------------------------------------------------------
    fd.append("tags", tags.join(","));

    // --- Image -------------------------------------------------------------
    const mainImage = getMainImageFile();
    if (mainImage) fd.append("image", mainImage);

    return fd;
  }

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------
  function setBusy(busy, label) {
    submitting = busy;
    if (publishBtn) publishBtn.disabled = busy;
    if (saveDraftBtn) saveDraftBtn.disabled = busy;
    if (publishBtn && label !== undefined) {
      if (busy) {
        publishBtn.dataset.originalHtml = publishBtn.innerHTML;
        publishBtn.textContent = label;
      } else if (publishBtn.dataset.originalHtml) {
        publishBtn.innerHTML = publishBtn.dataset.originalHtml;
      }
    }
  }

  async function submitProduct(statusOverride) {
    if (submitting) return;

    if (!getToken()) {
      showToast("Your session expired. Please sign in again.");
      setTimeout(() => (window.location.href = LOGIN_PAGE), 1200);
      return;
    }

    if (!validateForm()) return;
    if (!validateSale()) return;

    setBusy(true, "Saving...");

    try {
      const response = await fetch(API_BASE + "/admin/products", {
        method: "POST",
        headers: getAuthHeaders(false), // no Content-Type — FormData sets it
        body: buildFormData(statusOverride),
      });

      const data = await readJson(response);

      if (response.status === 401 || response.status === 422) {
        showToast("Session expired or invalid. Please sign in again.");
        setTimeout(() => (window.location.href = LOGIN_PAGE), 1200);
        return;
      }
      if (response.status === 403) {
        showToast("Admin permission is required to add products.");
        return;
      }
      if (!response.ok || !data.success) {
        showToast(data.message || "Could not save the product.");
        console.error("Add product failed:", response.status, data);
        return;
      }

      showToast("Product added successfully!");

      // Reset the page for the next entry
      form.reset();
      tags.length = 0;
      renderTags();
      if (window.ProductImages && typeof window.ProductImages.clear === "function") {
        window.ProductImages.clear();
      }
      stockStatusManual = false;
      updateStockStatusUi();
      calcProfit();
      updateDiscountPreview();
      if (saleFields) saleFields.style.display = "none";
      if (saleOverlay) saleOverlay.style.display = "";
      await loadCategories();

      setTimeout(() => (window.location.href = PRODUCTS_PAGE), 900);
    } catch (err) {
      console.error("Fetch error:", err);
      showToast(
        "Cannot reach the server at " + API_BASE + ". Make sure Flask is running."
      );
    } finally {
      setBusy(false, "");
    }
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    submitProduct(null);
  });

  if (saveDraftBtn) {
    saveDraftBtn.addEventListener("click", (e) => {
      e.preventDefault();
      submitProduct("draft");
    });
  }
})();
