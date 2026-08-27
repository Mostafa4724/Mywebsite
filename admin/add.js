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
  const newCategoryImage = el("newCategoryImage");
  const categoryImageDropzone = el("categoryImageDropzone");
  const newCategoryImagePreview = el("newCategoryImagePreview");
  const categoryImagePlaceholder = el("categoryImagePlaceholder");
  const removeCategoryImageBtn = el("removeCategoryImageBtn");
  const newCategoryImageError = el("newCategoryImageError");

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

  let selectedSaleColor = "#ef4444";
  let stockStatusManual = false; // true once the user clicks a stock chip
  let submitting = false;

  const CATEGORY_IMAGES_STORAGE_KEY = "shop_category_images";
  let pendingCategoryImageData = "";

  function getCategoryImages() {
    try {
      const raw = localStorage.getItem(CATEGORY_IMAGES_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (err) {
      console.warn("Could not read saved category images:", err);
      return {};
    }
  }

  function saveCategoryImage(categoryId, dataUrl) {
    if (!categoryId || !dataUrl) return;
    const images = getCategoryImages();
    images[String(categoryId)] = dataUrl;
    try {
      localStorage.setItem(CATEGORY_IMAGES_STORAGE_KEY, JSON.stringify(images));
    } catch (err) {
      console.error("Could not save category image:", err);
      showToast("Category created, but the image could not be saved locally.");
    }
  }

  function resetCategoryImagePicker() {
    pendingCategoryImageData = "";
    if (newCategoryImage) newCategoryImage.value = "";
    if (newCategoryImagePreview) {
      newCategoryImagePreview.hidden = true;
      newCategoryImagePreview.removeAttribute("src");
    }
    if (categoryImagePlaceholder) categoryImagePlaceholder.hidden = false;
    if (removeCategoryImageBtn) removeCategoryImageBtn.hidden = true;
    if (newCategoryImageError) newCategoryImageError.textContent = "";
  }

  function resizeCategoryImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Could not read image."));
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error("Invalid image file."));
        image.onload = () => {
          const maxWidth = 1000;
          const maxHeight = 700;
          const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height);
          const width = Math.max(1, Math.round(image.width * scale));
          const height = Math.max(1, Math.round(image.height * scale));
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Image processing is not supported."));
            return;
          }
          ctx.drawImage(image, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.82));
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function handleCategoryImageChange(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      resetCategoryImagePicker();
      if (newCategoryImageError) newCategoryImageError.textContent = "Please choose an image file.";
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      resetCategoryImagePicker();
      if (newCategoryImageError) newCategoryImageError.textContent = "Image must be 8MB or smaller.";
      return;
    }

    try {
      if (newCategoryImageError) newCategoryImageError.textContent = "";
      pendingCategoryImageData = await resizeCategoryImage(file);
      if (newCategoryImagePreview) {
        newCategoryImagePreview.src = pendingCategoryImageData;
        newCategoryImagePreview.hidden = false;
      }
      if (categoryImagePlaceholder) categoryImagePlaceholder.hidden = true;
      if (removeCategoryImageBtn) removeCategoryImageBtn.hidden = false;
    } catch (err) {
      console.error("Failed to process category image:", err);
      resetCategoryImagePicker();
      if (newCategoryImageError) newCategoryImageError.textContent = "Could not process this image. Please try another one.";
    }
  }

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

      // "Others" is a backend fallback category. Keep it out of the
      // Add Product UI so admins only choose real storefront categories.
      (data.categories || [])
        .filter(
          (cat) =>
            String(cat.name || "").trim().toLowerCase() !== "others"
        )
        .forEach((cat) => {
          const opt = document.createElement("option");
          opt.value = String(cat.id);
          opt.dataset.name = cat.name;
          opt.textContent = cat.name;
          categorySelect.appendChild(opt);
        });


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
    resetCategoryImagePicker();
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
    if (!pendingCategoryImageData) {
      if (newCategoryImageError) newCategoryImageError.textContent = "Please choose a category image.";
      return;
    }
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
      if (data.category && pendingCategoryImageData) {
        saveCategoryImage(data.category.id, pendingCategoryImageData);
      }

      if (
        categorySelect &&
        data.category &&
        String(data.category.name || "").trim().toLowerCase() !== "others"
      ) {
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
      resetCategoryImagePicker();
      showToast('Category "' + data.category.name + '" created!');
    } catch (err) {
      console.error("Failed to create category:", err);
      newCategoryError.textContent = "Failed to connect. Please try again.";
    } finally {
      saveCategoryBtn.disabled = false;
      saveCategoryBtn.textContent = "Add Category";
    }
  }

  if (categoryImageDropzone && newCategoryImage) {
    categoryImageDropzone.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      newCategoryImage.click();
    });

    newCategoryImage.addEventListener("change", () => {
      handleCategoryImageChange(newCategoryImage.files && newCategoryImage.files[0]);
    });
  }

  if (removeCategoryImageBtn) {
    removeCategoryImageBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      resetCategoryImagePicker();
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
      btn.className = "ap-tag-remove";
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
  // Variants: color groups with their own image, stock and 1–7 sizes.
  // ---------------------------------------------------------------------------
  function newVariantId() {
    return "new-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
  }

  function variantRowTemplate(variantId) {
    const row = document.createElement("div");
    row.className = "ap-variant-group";
    row.dataset.variantId = variantId;
    row.innerHTML = `
      <div class="ap-variant-group-head">
        <strong>Color Variant</strong>
        <button type="button" class="variant-remove" aria-label="Remove color">Remove</button>
      </div>
      <div class="ap-row-2">
        <div class="variant-field">
          <label>Color name</label>
          <input type="text" class="variant-color-input" placeholder="e.g. Blue" />
        </div>
        <div class="variant-field">
          <label>Stock quantity</label>
          <input type="number" class="variant-stock-input" min="0" value="0" />
        </div>
      </div>
      <div class="ap-row-2">
        <div class="variant-field">
          <label>Color price <span class="req">*</span></label>
          <div class="ap-input-prefix sm"><span>$</span><input type="number" class="variant-base-price-input" min="0" step="0.01" placeholder="0.00" /></div>
        </div>
        <div class="variant-field variant-sale-box">
          <label><input type="checkbox" class="variant-sale-enabled" /> Color sale</label>
          <div class="ap-input-prefix sm"><span>$</span><input type="number" class="variant-sale-price-input" min="0" step="0.01" placeholder="Sale price" disabled /></div>
        </div>
      </div>
      <div class="ap-row-2 variant-sale-dates" hidden>
        <div class="variant-field"><label>Sale start</label><input type="datetime-local" class="variant-sale-start" /></div>
        <div class="variant-field"><label>Sale end</label><input type="datetime-local" class="variant-sale-end" /></div>
      </div>
      <div class="variant-field">
        <label>Color image</label>
        <input type="file" class="variant-image-input" accept="image/png,image/jpeg,image/webp" />
        <div class="variant-image-preview"></div>
      </div>
      <div class="variant-sizes">
        <div class="ap-variant-group-head">
          <label>Sizes (1–7)</label>
          <select class="variant-size-count">
            <option value="1">1</option><option value="2">2</option><option value="3">3</option>
            <option value="4">4</option><option value="5">5</option><option value="6">6</option><option value="7">7</option>
          </select>
        </div>
        <div class="variant-size-list"></div>
      </div>
    `;
    const count = row.querySelector(".variant-size-count");
    const sizeList = row.querySelector(".variant-size-list");
    function renderSizes() {
      const n = Number(count.value) || 1;
      sizeList.innerHTML = "";
      for (let i = 0; i < n; i++) {
        const size = document.createElement("div");
        size.className = "ap-row-2 variant-size-row";
        size.innerHTML = `
          <div class="variant-field">
            <label>Size ${i + 1}</label>
            <input type="text" class="variant-size-input" placeholder="e.g. M" />
          </div>
          <div class="variant-field">
            <label>Price</label>
            <div class="ap-input-prefix sm"><span>$</span><input type="number" class="variant-price-input" min="0" step="0.01" placeholder="0.00" /></div>
          </div>`;
        sizeList.appendChild(size);
      }
    }
    count.addEventListener("change", renderSizes);
    row.querySelector(".variant-image-input").addEventListener("change", (e) => {
      const file = e.target.files[0];
      const preview = row.querySelector(".variant-image-preview");
      preview.innerHTML = "";
      if (file) {
        const img = document.createElement("img");
        img.src = URL.createObjectURL(file);
        img.alt = "Color preview";
        preview.appendChild(img);
      }
    });
    const saleEnabled = row.querySelector(".variant-sale-enabled");
    const salePrice = row.querySelector(".variant-sale-price-input");
    const saleDates = row.querySelector(".variant-sale-dates");
    saleEnabled.addEventListener("change", () => {
      salePrice.disabled = !saleEnabled.checked;
      saleDates.hidden = !saleEnabled.checked;
    });
    row.querySelector(".variant-remove").addEventListener("click", () => row.remove());
    renderSizes();
    return row;
  }

  function addVariantGroup() {
    if (!variantsList) return;
    variantsList.appendChild(variantRowTemplate(newVariantId()));
  }

  if (addVariantBtn && variantsList) {
    addVariantBtn.addEventListener("click", addVariantGroup);
  }

  function validateVariants() {
    const groups = Array.from(variantsList ? variantsList.querySelectorAll(".ap-variant-group") : []);
    const seenColors = new Set();

    for (let i = 0; i < groups.length; i++) {
      const row = groups[i];
      const color = row.querySelector(".variant-color-input")?.value.trim() || "";
      if (!color) {
        showToast(`Color variant ${i + 1} needs a color name.`);
        row.querySelector(".variant-color-input")?.focus();
        return false;
      }

      const key = color.toLowerCase();
      if (seenColors.has(key)) {
        showToast(`Duplicate color variant: ${color}.`);
        row.querySelector(".variant-color-input")?.focus();
        return false;
      }
      seenColors.add(key);

      const basePrice = Number(row.querySelector(".variant-base-price-input")?.value || 0);
      if (!Number.isFinite(basePrice) || basePrice < 0) {
        showToast(`${color}: enter a valid color price.`);
        row.querySelector(".variant-base-price-input")?.focus();
        return false;
      }
      const saleEnabled = !!row.querySelector(".variant-sale-enabled")?.checked;
      const salePrice = Number(row.querySelector(".variant-sale-price-input")?.value || 0);
      if (saleEnabled && (!Number.isFinite(salePrice) || salePrice <= 0 || salePrice >= basePrice)) {
        showToast(`${color}: sale price must be lower than the color price.`);
        row.querySelector(".variant-sale-price-input")?.focus();
        return false;
      }
      const saleStart = row.querySelector(".variant-sale-start")?.value || "";
      const saleEnd = row.querySelector(".variant-sale-end")?.value || "";
      if (saleEnabled && saleStart && saleEnd && new Date(saleEnd) <= new Date(saleStart)) {
        showToast(`${color}: sale end must be after sale start.`);
        return false;
      }

      const sizeRows = Array.from(row.querySelectorAll(".variant-size-row"));
      if (!sizeRows.length) {
        showToast(`${color} must have at least one size.`);
        return false;
      }

      const seenSizes = new Set();
      for (let j = 0; j < sizeRows.length; j++) {
        const size = sizeRows[j].querySelector(".variant-size-input")?.value.trim() || "";
        const price = Number(sizeRows[j].querySelector(".variant-price-input")?.value || 0);
        if (!size) {
          showToast(`${color}: Size ${j + 1} needs a name.`);
          sizeRows[j].querySelector(".variant-size-input")?.focus();
          return false;
        }
        const sizeKey = size.toLowerCase();
        if (seenSizes.has(sizeKey)) {
          showToast(`Duplicate size ${size} for ${color}.`);
          sizeRows[j].querySelector(".variant-size-input")?.focus();
          return false;
        }
        seenSizes.add(sizeKey);
        if (!Number.isFinite(price) || price < 0) {
          showToast(`${color} / ${size}: price must be a valid non-negative number.`);
          sizeRows[j].querySelector(".variant-price-input")?.focus();
          return false;
        }
      }
    }
    return true;
  }

  function collectVariants(fd) {
    const groups = Array.from(variantsList ? variantsList.querySelectorAll(".ap-variant-group") : []);
    const variants = groups.map((row) => {
      const id = row.dataset.variantId;
      const color = row.querySelector(".variant-color-input")?.value.trim() || "";
      const stock = Number(row.querySelector(".variant-stock-input")?.value || 0);
      const sizes = Array.from(row.querySelectorAll(".variant-size-row")).map((sizeRow) => ({
        size: sizeRow.querySelector(".variant-size-input")?.value.trim() || "",
        price: Number(sizeRow.querySelector(".variant-price-input")?.value || 0),
      }));
      const imageInput = row.querySelector(".variant-image-input");
      if (imageInput?.files?.[0]) {
        fd.append("variant_image_" + id, imageInput.files[0], imageInput.files[0].name);
      }
      return {
        id, color, stock,
        price: Number(row.querySelector(".variant-base-price-input")?.value || 0),
        sale_enabled: !!row.querySelector(".variant-sale-enabled")?.checked,
        sale_price: Number(row.querySelector(".variant-sale-price-input")?.value || 0) || null,
        sale_start: row.querySelector(".variant-sale-start")?.value || "",
        sale_end: row.querySelector(".variant-sale-end")?.value || "",
        sizes
      };
    });
    fd.append("variant_data", JSON.stringify(variants));
    return variants;
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

    const taxRate = parseFloat(prodTax?.value || 0);
    if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) {
      return fail(prodTax, "Tax must be between 0% and 100%.");
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
    fd.append("tax_class", "custom");
    fd.append("tax_rate", String(Number(prodTax?.value || 0)));

    // --- Publish status ----------------------------------------------------
    const publishStatus = document.querySelector(
      'input[name="publishStatus"]:checked'
    );
    const status = statusOverride || (publishStatus ? publishStatus.value : "draft");
    fd.append("status", status === "published" ? "published" : "draft");

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

    // --- Images ------------------------------------------------------------
    const imageFiles =
      window.ProductImages && typeof window.ProductImages.getFiles === "function"
        ? window.ProductImages.getFiles()
        : [];
    imageFiles.forEach((file) => fd.append("images", file, file.name));
    // Backward-compatible main image field for older backend builds.
    if (imageFiles[0]) fd.append("image", imageFiles[0], imageFiles[0].name);

    collectVariants(fd);
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
    if (!validateVariants()) return;

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
