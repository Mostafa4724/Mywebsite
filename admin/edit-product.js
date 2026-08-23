// Global variable to store the selected file
window.selectedFile = null;

(function () {
  "use strict";

  const API_BASE = "http://127.0.0.1:5000";
  const token = () => sessionStorage.getItem("token") || "";

  const form = document.getElementById("editProductForm");
  const categorySelect = document.getElementById("prodCategory");
  const imageInput = document.getElementById("imageInput");
  const uploadPlaceholder = document.getElementById("uploadPlaceholder");
  const saleToggle = document.getElementById("saleToggle");
  const saleOverlay = document.getElementById("saleOverlay");
  const saleFields = document.getElementById("saleFields");
  const salePriceField = document.getElementById("salePriceField");
  const saleStartDate = document.getElementById("saleStartDate");
  const saleEndDate = document.getElementById("saleEndDate");
  const saleBadge = document.getElementById("saleBadge");
  const saleBadgePreview = document.getElementById("saleBadgePreview");
  const discountPreview = document.getElementById("discountPreview");
  const priceInput = document.getElementById("prodPrice");
  const costInput = document.getElementById("prodCost");
  const variantsList = document.getElementById("variantsList");
  const addVariantBtn = document.getElementById("addVariantBtn");
  const tagInput = document.getElementById("tagInput");
  const tagsList = document.getElementById("tagsList");
  const toast = document.getElementById("apToast");
  const toastMsg = document.getElementById("apToastMsg");
  const deleteModal = document.getElementById("deleteModal");
  const deleteProductBtn = document.getElementById("deleteProductBtn");
  const cancelDelete = document.getElementById("cancelDelete");
  const confirmDelete = document.getElementById("confirmDelete");
  const deleteProductName = document.getElementById("deleteProductName");
  const unsavedModal = document.getElementById("unsavedModal");
  const stayOnPage = document.getElementById("stayOnPage");
  const leaveAnyway = document.getElementById("leaveAnyway");
  const categoryList = document.getElementById("categoryList");
  const deleteCategoryModal = document.getElementById("deleteCategoryModal");
  const deleteCategoryClose = document.getElementById("deleteCategoryClose");
  const cancelDeleteCategoryBtn = document.getElementById("cancelDeleteCategoryBtn");
  const confirmDeleteCategoryBtn = document.getElementById("confirmDeleteCategoryBtn");
  const deleteCategoryName = document.getElementById("deleteCategoryName");

  let productId = null;
  let product = null;
  let currentImages = [];
  let selectedImageFiles = [];
  let currentTags = [];
  let selectedSaleColor = "#ef4444";
  let dirty = false;
  let toastTimer = null;

  // ─── helpers ──────────────────────────────────────────

  function authHeaders() {
    const t = token();
    return t ? { Authorization: "Bearer " + t } : {};
  }

  function showToast(message, type) {
    if (!toast || !toastMsg) return;
    clearTimeout(toastTimer);
    toastMsg.textContent = message;
    const icon = toast.querySelector("svg");
    if (icon) icon.style.color = type === "warn" ? "#f59e0b" : "#22c55e";
    toast.classList.add("show");
    toastTimer = setTimeout(() => toast.classList.remove("show"), 3500);
  }

  function setPageError(message) {
    showToast(message, "warn");
    const heading = document.querySelector(".topbar-title h2");
    if (heading) heading.textContent = message;
  }

  function markDirty() {
    dirty = true;
  }

  function toDateTimeLocal(value) {
    if (!value) return "";

    return String(value).trim().slice(0, 16);
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
    }[ch]));
  }

  function imageUrl(value) {
    if (!value) return "";
    if (/^https?:\/\//i.test(value) || value.startsWith("data:")) return value;
    let url;
    if (value.startsWith("/uploads/products/")) {
      url = API_BASE + value;
    } else {
      url = API_BASE + "/uploads/products/" + encodeURIComponent(value);
    }
    return url + "?v=" + Date.now();
  }

  function renderEditImages() {
    const grid = document.getElementById("editImageGrid");
    if (!grid) return;
    grid.innerHTML = "";
    const entries = currentImages.map((name) => ({ type: "existing", value: name }))
      .concat(selectedImageFiles.map((file) => ({ type: "new", value: file })));

    const placeholder = document.getElementById("uploadPlaceholder");
    if (placeholder) placeholder.style.display = entries.length ? "none" : "";
    entries.forEach((entry, index) => {
      const item = document.createElement("div");
      item.className = "preview-item";
      const img = document.createElement("img");
      img.src = entry.type === "existing" ? imageUrl(entry.value) : URL.createObjectURL(entry.value);
      img.alt = "Product image " + (index + 1);
      item.appendChild(img);
      if (index === 0) {
        const badge = document.createElement("span");
        badge.className = "preview-badge";
        badge.textContent = "Main";
        item.appendChild(badge);
      }
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "preview-remove";
      remove.innerHTML = "&times;";
      remove.setAttribute("aria-label", "Remove image");
      remove.addEventListener("click", () => {
        if (entry.type === "existing") currentImages = currentImages.filter((x) => x !== entry.value);
        else selectedImageFiles = selectedImageFiles.filter((x) => x !== entry.value);
        renderEditImages();
        markDirty();
      });
      item.appendChild(remove);
      grid.appendChild(item);
    });
  }

  function collectEditVariants() {
    return Array.from(variantsList ? variantsList.querySelectorAll(".ap-variant-group") : []).map((row) => {
      const id = row.dataset.variantId;
      const imageInput = row.querySelector(".variant-image-input");
      if (imageInput?.files?.[0]) {
        // File is appended by saveProduct where FormData is available.
      }
      return {
        id,
        color: row.querySelector(".variant-color-input")?.value.trim() || "",
        stock: Number(row.querySelector(".variant-stock-input")?.value || 0),
        price: Number(row.querySelector(".variant-base-price-input")?.value || 0),
        sale_enabled: !!row.querySelector(".variant-sale-enabled")?.checked,
        sale_price: Number(row.querySelector(".variant-sale-price-input")?.value || 0) || null,
        sale_start: row.querySelector(".variant-sale-start")?.value || "",
        sale_end: row.querySelector(".variant-sale-end")?.value || "",
        image: row.dataset.existingImage || "",
        sizes: Array.from(row.querySelectorAll(".variant-size-row")).map((sizeRow) => ({
          id: sizeRow.dataset.sizeId || undefined,
          size: sizeRow.querySelector(".variant-size-input")?.value.trim() || "",
          price: Number(sizeRow.querySelector(".variant-price-input")?.value || 0),
        })),
      };
    });
  }

  function renderVariantGroups(variants) {
    if (!variantsList) return;
    variantsList.innerHTML = "";
    (variants || []).forEach((variant) => {
      const row = document.createElement("div");
      row.className = "ap-variant-group";
      row.dataset.variantId = String(variant.id);
      row.dataset.existingImage = variant.image || "";
      row.innerHTML = `
        <div class="ap-variant-group-head"><strong>Color Variant</strong><button type="button" class="variant-remove">Remove</button></div>
        <div class="ap-row-2">
          <div class="variant-field"><label>Color name</label><input type="text" class="variant-color-input" value="${escapeHtml(variant.color || "")}" /></div>
          <div class="variant-field"><label>Stock quantity</label><input type="number" class="variant-stock-input" min="0" value="${Number(variant.stock || 0)}" /></div>
        </div>
        <div class="ap-row-2">
          <div class="variant-field"><label>Color price <span class="req">*</span></label><div class="ap-input-prefix sm"><span>$</span><input type="number" class="variant-base-price-input" min="0" step="0.01" value="${Number(variant.price || (variant.sizes?.[0]?.price || 0))}" /></div></div>
          <div class="variant-field"><label><input type="checkbox" class="variant-sale-enabled" ${variant.sale_enabled ? "checked" : ""} /> Color sale</label><div class="ap-input-prefix sm"><span>$</span><input type="number" class="variant-sale-price-input" min="0" step="0.01" value="${variant.sale_price ?? ""}" ${variant.sale_enabled ? "" : "disabled"} /></div></div>
        </div>
        <div class="ap-row-2 variant-sale-dates" ${variant.sale_enabled ? "" : "hidden"}>
          <div class="variant-field"><label>Sale start</label><input type="datetime-local" class="variant-sale-start" value="${escapeHtml(String(variant.sale_start || "").slice(0,16))}" /></div>
          <div class="variant-field"><label>Sale end</label><input type="datetime-local" class="variant-sale-end" value="${escapeHtml(String(variant.sale_end || "").slice(0,16))}" /></div>
        </div>
        <div class="variant-field">
          <label>Color image</label>
          <input type="file" class="variant-image-input" accept="image/png,image/jpeg,image/webp" />
          <div class="variant-image-preview">${variant.image ? `<img src="${imageUrl(variant.image)}" alt="${escapeHtml(variant.color || "Color")} image" />` : ""}</div>
        </div>
        <div class="variant-sizes">
          <div class="ap-variant-group-head"><label>Sizes (1–7)</label><select class="variant-size-count">${[1,2,3,4,5,6,7].map(n => `<option value="${n}" ${n === (variant.sizes?.length || 1) ? "selected" : ""}>${n}</option>`).join("")}</select></div>
          <div class="variant-size-list"></div>
        </div>`;
      const list = row.querySelector(".variant-size-list");
      const count = row.querySelector(".variant-size-count");
      function renderSizes() {
        const old = Array.from(list.querySelectorAll(".variant-size-row")).map((x) => ({
          id: x.dataset.sizeId,
          size: x.querySelector(".variant-size-input")?.value || "",
          price: x.querySelector(".variant-price-input")?.value || "",
        }));
        const source = variant.sizes || [];
        const n = Number(count.value) || 1;
        list.innerHTML = "";
        for (let i = 0; i < n; i++) {
          const data = source[i] || old[i] || {};
          const size = document.createElement("div");
          size.className = "ap-row-2 variant-size-row";
          if (data.id) size.dataset.sizeId = data.id;
          size.innerHTML = `<div class="variant-field"><label>Size ${i+1}</label><input type="text" class="variant-size-input" value="${escapeHtml(data.size || "")}" /></div><div class="variant-field"><label>Price</label><div class="ap-input-prefix sm"><span>$</span><input type="number" class="variant-price-input" min="0" step="0.01" value="${Number(data.price || 0)}" /></div></div>`;
          list.appendChild(size);
        }
      }
      count.addEventListener("change", renderSizes);
      const variantSaleEnabled = row.querySelector(".variant-sale-enabled");
      const variantSalePrice = row.querySelector(".variant-sale-price-input");
      const variantSaleDates = row.querySelector(".variant-sale-dates");
      variantSaleEnabled?.addEventListener("change", () => {
        variantSalePrice.disabled = !variantSaleEnabled.checked;
        variantSaleDates.hidden = !variantSaleEnabled.checked;
        markDirty();
      });
      row.querySelector(".variant-remove").addEventListener("click", () => { row.remove(); markDirty(); });
      row.querySelector(".variant-image-input").addEventListener("change", () => markDirty());
      renderSizes();
      variantsList.appendChild(row);
    });
  }

  async function responseJson(response) {
    const text = await response.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; } catch (_) { data = {}; }
    if (!response.ok || data.success === false) {
      throw new Error(data.message || `Server returned ${response.status}`);
    }
    return data;
  }

  function renderCategoryList(categories) {
    if (!categoryList) return;

    categoryList.innerHTML = "";

    if (!categories.length) {
      const empty = document.createElement("div");
      empty.className = "category-list-empty";
      empty.textContent = "No categories have been added yet.";
      categoryList.appendChild(empty);
      return;
    }

    categories.forEach((category) => {
      const row = document.createElement("div");
      row.className = "category-list-item";
      row.dataset.categoryId = String(category.id);

      const name = document.createElement("span");
      name.className = "category-list-name";
      name.textContent = category.name;

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "category-delete-btn";
      deleteBtn.dataset.categoryId = String(category.id);
      deleteBtn.dataset.categoryName = category.name;
      deleteBtn.setAttribute("aria-label", `Delete category ${category.name}`);
      deleteBtn.title = "Delete category";
      deleteBtn.textContent = "×";

      row.append(name, deleteBtn);
      categoryList.appendChild(row);
    });
  }

  async function loadCategories(selectedId) {
    const response = await fetch(API_BASE + "/categories");
    const data = await responseJson(response);
    const categories = data.categories || [];
    renderCategoryList(categories);

    categorySelect.innerHTML = '<option value="" disabled>Select category</option>';
    categories.forEach((cat) => {
      const option = document.createElement("option");
      option.value = String(cat.id);
      option.textContent = cat.name;
      categorySelect.appendChild(option);
    });
    const add = document.createElement("option");
    add.value = "__add_category__";
    add.textContent = "+ Add Category";
    categorySelect.appendChild(add);
    if (selectedId !== null && selectedId !== undefined) {
      categorySelect.value = String(selectedId);
    }
  }

  function closeDeleteCategoryModal() {
    if (!deleteCategoryModal) return;
    deleteCategoryModal.classList.remove("show");
    deleteCategoryModal.style.display = "none";
    deleteCategoryModal.setAttribute("hidden", "");
  }

  function openDeleteCategoryModal(id, name) {
    if (!deleteCategoryModal || !deleteCategoryName || !confirmDeleteCategoryBtn) return;
    deleteCategoryModal.dataset.categoryId = String(id);
    deleteCategoryName.textContent = name;
    confirmDeleteCategoryBtn.disabled = false;
    confirmDeleteCategoryBtn.textContent = "Delete";
    deleteCategoryModal.removeAttribute("hidden");
    deleteCategoryModal.classList.add("show");
    deleteCategoryModal.style.display = "flex";
  }

  function removeCategoryFromUI(categoryId) {
    const id = String(categoryId);
    categoryList?.querySelector(`[data-category-id="${CSS.escape(id)}"]`)?.remove();

    if (categoryList && !categoryList.querySelector(".category-list-item")) {
      const empty = document.createElement("div");
      empty.className = "category-list-empty";
      empty.textContent = "No categories have been added yet.";
      categoryList.appendChild(empty);
    }

    categorySelect?.querySelector(`option[value="${CSS.escape(id)}"]`)?.remove();
  }

  async function deleteCategory() {
    if (!deleteCategoryModal || !confirmDeleteCategoryBtn) return;

    const categoryId = deleteCategoryModal.dataset.categoryId;
    if (!categoryId) return;

    confirmDeleteCategoryBtn.disabled = true;
    confirmDeleteCategoryBtn.textContent = "Deleting...";

    try {
      const response = await fetch(API_BASE + `/categories/${encodeURIComponent(categoryId)}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await responseJson(response);

      const selected = categorySelect && categorySelect.value === String(categoryId);
      removeCategoryFromUI(categoryId);
      if (selected && categorySelect) categorySelect.value = "";
      closeDeleteCategoryModal();
      // Refresh from the backend after the immediate UI update.
      await loadCategories(selected ? null : categorySelect?.value || null);
      markDirty();
      showToast(data.message || "Category deleted successfully.", "success");
    } catch (error) {
      console.error("Failed to delete category:", error);
      showToast(error.message || "Could not delete category.", "warn");
      confirmDeleteCategoryBtn.disabled = false;
      confirmDeleteCategoryBtn.textContent = "Delete";
    }
  }

  function parseTags(value) {
    if (Array.isArray(value)) return value.map(String).map(s => s.trim()).filter(Boolean);
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(String).map(s => s.trim()).filter(Boolean);
    } catch (_) {}
    return String(value).split(",").map(s => s.trim()).filter(Boolean);
  }

  function renderTags() {
    tagsList.innerHTML = "";
    currentTags.forEach((tag, index) => {
      const el = document.createElement("span");
      el.className = "ap-tag";
      el.textContent = tag;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "ap-tag-remove";
      button.textContent = "×";
      button.addEventListener("click", () => {
        currentTags.splice(index, 1);
        renderTags();
        markDirty();
      });
      el.appendChild(button);
      tagsList.appendChild(el);
    });
  }

  function addTag(value) {
    const tag = String(value || "").trim().replace(/,$/, "");
    if (!tag) return;
    if (currentTags.includes(tag)) return;
    if (currentTags.length >= 10) {
      showToast("Maximum 10 tags allowed", "warn");
      return;
    }
    currentTags.push(tag);
    renderTags();
    markDirty();
  }

  function updateSalePreview() {
    const regular = Number(priceInput.value) || 0;
    const sale = Number(salePriceField.value) || 0;
    const valid = sale > 0 && sale < regular;
    if (discountPreview) {
      discountPreview.style.display = valid && saleToggle.checked ? "flex" : "none";
      if (valid) {
        const pct = Math.round(((regular - sale) / regular) * 100);
        document.getElementById("discountPct").textContent = pct + "%";
        document.getElementById("discRegular").textContent = "$" + regular.toFixed(2);
        document.getElementById("discSale").textContent = "$" + sale.toFixed(2);
        document.getElementById("discSave").textContent = "$" + (regular - sale).toFixed(2);
      }
    }
    if (saleBadgePreview) {
      saleBadgePreview.style.display = valid && saleToggle.checked ? "block" : "none";
    }
    const mockBadge = document.getElementById("mockBadge");
    const mockRegular = document.getElementById("mockRegular");
    const mockSalePrice = document.getElementById("mockSalePrice");
    if (mockBadge) {
      mockBadge.textContent = (saleBadge.value.trim() || "SALE").toUpperCase();
      mockBadge.style.background = selectedSaleColor;
    }
    if (mockRegular) mockRegular.textContent = "$" + regular.toFixed(2);
    if (mockSalePrice) mockSalePrice.textContent = "$" + sale.toFixed(2);
  }

  function setSaleState(enabled) {
    saleToggle.checked = !!enabled;
    saleOverlay.style.display = enabled ? "none" : "block";
    saleFields.style.display = enabled ? "block" : "none";
    updateSalePreview();
  }

  function updateProfit() {
    const price = Number(priceInput.value) || 0;
    const cost = Number(costInput.value) || 0;
    const box = document.getElementById("profitCalc");
    if (!box) return;
    if (cost > 0) {
      box.style.display = "flex";
      const profit = price - cost;
      const margin = price ? (profit / price) * 100 : 0;
      document.getElementById("profitValue").textContent = "$" + profit.toFixed(2);
      document.getElementById("marginValue").textContent = margin.toFixed(1) + "%";
    } else {
      box.style.display = "none";
    }
  }

  function fillForm(p) {
    product = p;
    document.getElementById("prodName").value = p.title || "";
    document.getElementById("prodBrand").value = p.brand || "";
    document.getElementById("prodDesc").value = p.description || "";
    document.getElementById("prodPrice").value = p.price ?? "";
    document.getElementById("prodCost").value = p.cost ?? 0;
    document.getElementById("prodTax").value = p.tax_rate ?? 8;
    document.getElementById("prodStock").value = p.stock ?? 0;
    document.getElementById("prodLowStock").value = p.low_stock ?? 10;

    const status = document.querySelector(`input[name="publishStatus"][value="${CSS.escape(p.status || "draft")}"]`);
    if (status) status.checked = true;

    const stockStatus = p.stock_status ||
      (Number(p.stock) <= 0 ? "out" : Number(p.stock) <= Number(p.low_stock || 0) ? "low" : "in");
    const stockRadio = document.querySelector(`input[name="stockStatus"][value="${CSS.escape(stockStatus)}"]`);
    if (stockRadio) stockRadio.checked = true;
    document.querySelectorAll(".ap-stock-chip").forEach(chip =>
      chip.classList.toggle("active", chip.dataset.stock === stockStatus)
    );
    
    currentTags = parseTags(p.tags);
    renderTags();

    currentImages = Array.isArray(p.images) && p.images.length
      ? p.images.slice(0, 5)
      : (p.image ? [p.image] : []);
    selectedImageFiles = [];
    if (imageInput) imageInput.value = "";
    renderEditImages();
    renderVariantGroups(p.variants || []);

    salePriceField.value = p.sale_price ?? "";
    saleStartDate.value = toDateTimeLocal(p.sale_start);
    saleEndDate.value = toDateTimeLocal(p.sale_end);
    saleBadge.value = p.sale_badge || "";
    selectedSaleColor = p.sale_badge_color || "#ef4444";
    document.querySelectorAll(".sale-color-btn").forEach(btn =>
      btn.classList.toggle("active", btn.dataset.color === selectedSaleColor)
    );
    setSaleState(Boolean(p.sale_enabled));

    const idStrong = document.querySelector(".ep-id-chip strong");
    if (idStrong) idStrong.textContent = "#" + p.id;
    const created = document.querySelector(".ep-created-date");
    if (created) created.textContent = "Created: " + (p.created_at ? new Date(p.created_at).toLocaleDateString() : "—");
    const modified = document.getElementById("lastModified");
    if (modified) modified.textContent = p.updated_at ? new Date(p.updated_at).toLocaleString() : "—";
    deleteProductName.textContent = p.title || "this product";

    updateProfit();
    updateSalePreview();
    dirty = false;
  }

  async function loadProduct() {
    const params = new URLSearchParams(window.location.search);
    const rawId = params.get("id");
    productId = Number(rawId);
    if (!rawId || !Number.isInteger(productId) || productId <= 0) {
      setPageError("Product not found.");
      return;
    }
    try {
      const response = await fetch(`${API_BASE}/products/${productId}`);
      const data = await responseJson(response);
      await loadCategories(data.product.category_id);
      fillForm(data.product);
    } catch (error) {
      console.error(error);
      setPageError(error.message === "Product not found" ? "Product not found." : "Unable to load product. Please try again.");
    }
  }

  // ─── SAVE PRODUCT ──────────────────────────────────────

    function syncStockStatusFromQuantity() {
    const stockInput = document.getElementById("prodStock");
    const thresholdInput = document.getElementById("prodLowStock");

    if (!stockInput || !thresholdInput) return;

    const stock = Number(stockInput.value);
    const threshold = Number(thresholdInput.value);

    let status = "in";

    if (!Number.isFinite(stock) || stock <= 0) {
      status = "out";
    } else if (stock <= threshold) {
      status = "low";
    }

    const radio = document.querySelector(
      `input[name="stockStatus"][value="${status}"]`
    );

    if (radio) {
      radio.checked = true;
    }

    document.querySelectorAll(".ap-stock-chip").forEach(chip => {
      chip.classList.toggle(
        "active",
        chip.dataset.stock === status
      );
    });
  }
  async function saveProduct() {
    const name = document.getElementById("prodName").value.trim();
    const description = document.getElementById("prodDesc").value.trim();
    const categoryId = categorySelect.value;
    const price = Number(priceInput.value);
    const stock = Number(document.getElementById("prodStock").value);
    const lowStock = Number(document.getElementById("prodLowStock").value || 0);
    const salePrice = salePriceField.value === "" ? null : Number(salePriceField.value);
    const selectedStatus = document.querySelector('input[name="publishStatus"]:checked');

    if (!name) throw new Error("Please enter a product name.");
    if (!description) throw new Error("Description is required.");
    if (!categoryId || categoryId === "__add_category__") throw new Error("Please select a category.");
    if (!Number.isFinite(price) || price < 0) throw new Error("Price is invalid.");
    if (!Number.isInteger(stock) || stock < 0) throw new Error("Quantity is invalid.");
    if (!Number.isInteger(lowStock) || lowStock < 0) throw new Error("Low stock threshold is invalid.");
    const taxRate = Number(document.getElementById("prodTax").value);
    if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) throw new Error("Tax must be between 0% and 100%.");
    if (saleToggle.checked && salePrice !== null && (!Number.isFinite(salePrice) || salePrice <= 0 || salePrice >= price)) {
      throw new Error("Sale price must be greater than 0 and lower than regular price.");
    }

    const categoryOption = categorySelect.options[categorySelect.selectedIndex];
    const body = new FormData();

    body.append("title", name);
    body.append("description", description);
    body.append("brand", document.getElementById("prodBrand").value.trim());
    body.append("category_id", categoryId);
    body.append("category", categoryOption ? categoryOption.textContent.trim() : "");
    body.append("price", String(price));
    body.append("cost", String(Number(costInput.value) || 0));
    body.append("tax_class", "custom");
    body.append("tax_rate", String(taxRate));
    body.append("stock", String(stock));
    body.append("low_stock", String(lowStock));
    body.append("status", selectedStatus ? selectedStatus.value : "draft");
    body.append("sale_enabled", saleToggle.checked ? "true" : "false");
    body.append("sale_price", saleToggle.checked && salePrice !== null ? String(salePrice) : "");
    body.append("sale_start", saleToggle.checked ? saleStartDate.value : "");
    body.append("sale_end", saleToggle.checked ? saleEndDate.value : "");
    body.append("sale_badge", saleBadge.value.trim());
    body.append("sale_badge_color", selectedSaleColor);
    body.append("tags", currentTags.join(","));

    body.append("existing_images", JSON.stringify(currentImages));
    selectedImageFiles.forEach((file) => body.append("images", file, file.name));
    if (selectedImageFiles[0]) body.append("image", selectedImageFiles[0], selectedImageFiles[0].name);

    const variants = collectEditVariants();
    body.append("variant_data", JSON.stringify(variants));
    Array.from(variantsList ? variantsList.querySelectorAll(".ap-variant-group") : []).forEach((row) => {
      const file = row.querySelector(".variant-image-input")?.files?.[0];
      if (file) body.append("variant_image_" + row.dataset.variantId, file, file.name);
    });

    body.append("_method", "PUT");
    const response = await fetch(`${API_BASE}/admin/products/${productId}`, {
      method: "POST",
      headers: authHeaders(),
      body: body,
    });

    const data = await responseJson(response);
    fillForm(data.product);
    showToast("Product updated successfully!", "success");

    setTimeout(() => {
      window.location.href = "admin_product.html";
    }, 700);
  }

  async function deleteProduct() {
    const response = await fetch(`${API_BASE}/admin/products/${productId}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    await responseJson(response);
    showToast("Product deleted successfully", "success");
    dirty = false;
    setTimeout(() => {
      window.location.href = "admin_product.html";
    }, 700);
  }

  function appendBlankVariantGroup() {
    if (!variantsList) return;
    const id = "new-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
    const row = document.createElement("div");
    row.className = "ap-variant-group";
    row.dataset.variantId = id;
    row.innerHTML = `
      <div class="ap-variant-group-head"><strong>Color Variant</strong><button type="button" class="variant-remove">Remove</button></div>
      <div class="ap-row-2">
        <div class="variant-field"><label>Color name</label><input type="text" class="variant-color-input" placeholder="e.g. Blue" /></div>
        <div class="variant-field"><label>Stock quantity</label><input type="number" class="variant-stock-input" min="0" value="0" /></div>
      </div>
      <div class="variant-field"><label>Color image</label><input type="file" class="variant-image-input" accept="image/png,image/jpeg,image/webp" /></div>
      <div class="variant-sizes">
        <div class="ap-variant-group-head"><label>Sizes (1–7)</label><select class="variant-size-count">${[1,2,3,4,5,6,7].map(n => `<option value="${n}" ${n === 1 ? "selected" : ""}>${n}</option>`).join("")}</select></div>
        <div class="variant-size-list"></div>
      </div>`;
    const list = row.querySelector(".variant-size-list");
    const count = row.querySelector(".variant-size-count");
    function sizes() {
      const n = Number(count.value) || 1;
      list.innerHTML = "";
      for (let i = 0; i < n; i++) {
        const line = document.createElement("div");
        line.className = "ap-row-2 variant-size-row";
        line.innerHTML = `<div class="variant-field"><label>Size ${i+1}</label><input type="text" class="variant-size-input" placeholder="e.g. M" /></div><div class="variant-field"><label>Price</label><div class="ap-input-prefix sm"><span>$</span><input type="number" class="variant-price-input" min="0" step="0.01" value="0" /></div></div>`;
        list.appendChild(line);
      }
    }
    count.addEventListener("change", sizes);
    row.querySelector(".variant-remove").addEventListener("click", () => { row.remove(); markDirty(); });
    row.querySelectorAll("input").forEach(input => input.addEventListener("input", markDirty));
    sizes();
    variantsList.appendChild(row);
  }

  if (addVariantBtn) {
    addVariantBtn.addEventListener("click", () => {
      appendBlankVariantGroup();
      markDirty();
    });
  }

  // ─── EVENT SETUP ──────────────────────────────────────

  function setupEvents() {
    document.querySelectorAll("input, select, textarea").forEach(el => {
      el.addEventListener("input", markDirty);
      el.addEventListener("change", markDirty);
    });
    const stockInput = document.getElementById("prodStock");
    const thresholdInput = document.getElementById("prodLowStock");

    if (stockInput) {
      stockInput.addEventListener("input", syncStockStatusFromQuantity);
      stockInput.addEventListener("change", syncStockStatusFromQuantity);
    }

    if (thresholdInput) {
      thresholdInput.addEventListener("input", syncStockStatusFromQuantity);
      thresholdInput.addEventListener("change", syncStockStatusFromQuantity);
    }

    priceInput.addEventListener("input", () => { updateProfit(); updateSalePreview(); });
    costInput.addEventListener("input", updateProfit);
    salePriceField.addEventListener("input", updateSalePreview);
    saleBadge.addEventListener("input", updateSalePreview);

    saleToggle.addEventListener("change", () => {
      setSaleState(saleToggle.checked);
      markDirty();
    });

    document.querySelectorAll(".sale-color-btn").forEach(btn =>
      btn.addEventListener("click", () => {
        selectedSaleColor = btn.dataset.color || selectedSaleColor;
        document.querySelectorAll(".sale-color-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        updateSalePreview();
        markDirty();
      })
    );

    document.querySelectorAll('input[name="stockStatus"]').forEach(r =>
      r.addEventListener("change", () => {
        document.querySelectorAll(".ap-stock-chip").forEach(c =>
          c.classList.toggle("active", c.dataset.stock === r.value && r.checked)
        );
      })
    );

    tagInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        addTag(tagInput.value);
        tagInput.value = "";
      }
    });

    document.querySelectorAll(".suggested-tag").forEach(btn =>
      btn.addEventListener("click", () => addTag(btn.dataset.tag))
    );

    if (imageInput) {
      imageInput.addEventListener("change", function (e) {
        const incoming = Array.from(e.target.files || []);
        const seen = new Set(selectedImageFiles.map((file) => `${file.name}|${file.size}|${file.lastModified}`));
        const valid = incoming.filter((file) => {
          const key = `${file.name}|${file.size}|${file.lastModified}`;
          if (seen.has(key)) {
            showToast(`"${file.name}" is already added.`, "warn");
            return false;
          }
          seen.add(key);
          if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
            showToast("Only PNG, JPG or WebP images are allowed.", "warn");
            return false;
          }
          if (file.size > 5 * 1024 * 1024) {
            showToast("Each image must be 5MB or smaller.", "warn");
            return false;
          }
          return true;
        });
        if (currentImages.length + selectedImageFiles.length + valid.length > 5) {
          showToast("A product can have a maximum of 5 images.", "warn");
          return;
        }
        selectedImageFiles.push(...valid);
        imageInput.value = "";
        renderEditImages();
        markDirty();
      });
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        await saveProduct();
      } catch (error) {
        console.error(error);
        showToast(error.message || "Unable to update product. Please try again.", "warn");
      }
    });

    document.getElementById("saveDraftBtn")?.addEventListener("click", () => {
      const draft = document.querySelector('input[name="publishStatus"][value="draft"]');
      if (draft) draft.checked = true;

      form.requestSubmit();
    });

    deleteProductBtn.addEventListener("click", () => deleteModal.classList.add("show"));
    cancelDelete.addEventListener("click", () => deleteModal.classList.remove("show"));
    confirmDelete.addEventListener("click", async () => {
      try {
        await deleteProduct();
      } catch (error) {
        console.error(error);
        deleteModal.classList.remove("show");
        showToast(error.message || "Unable to delete product.", "warn");
      }
    });

    const backLink = form.querySelector(".ap-cancel-btn");
    backLink?.addEventListener("click", (e) => {
      if (!dirty) return;
      e.preventDefault();
      unsavedModal.classList.add("show");
    });
    stayOnPage?.addEventListener("click", () => unsavedModal.classList.remove("show"));
    leaveAnyway?.addEventListener("click", () => {
      dirty = false;
      window.location.href = "admin_product.html";
    });
    window.addEventListener("beforeunload", (e) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    });

    categorySelect.addEventListener("change", async () => {
      if (categorySelect.value !== "__add_category__") return;
      categorySelect.value = product ? String(product.category_id || "") : "";
      const modal = document.getElementById("addCategoryModal");
      if (modal) {
        modal.removeAttribute("hidden");
        modal.style.display = "flex";
      }
    });

    const closeCategory = () => {
      const modal = document.getElementById("addCategoryModal");
      if (modal) {
        modal.setAttribute("hidden", "");
        modal.style.display = "none";
      }
    };
    document.getElementById("addCategoryClose")?.addEventListener("click", closeCategory);
    document.getElementById("cancelCategoryBtn")?.addEventListener("click", closeCategory);
    document.getElementById("saveCategoryBtn")?.addEventListener("click", async () => {
      const button = document.getElementById("saveCategoryBtn");
      const input = document.getElementById("newCategoryName");
      const errorEl = document.getElementById("newCategoryError");
      const name = input.value.trim();
      if (!name) {
        errorEl.textContent = "Category name is required.";
        return;
      }

      button.disabled = true;
      button.textContent = "Saving...";
      errorEl.textContent = "";

      try {
        const response = await fetch(API_BASE + "/categories", {
          method: "POST",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });
        const data = await responseJson(response);
        await loadCategories(data.category.id);
        closeCategory();
        input.value = "";
        markDirty();
        showToast(`Category "${data.category.name}" created!`, "success");
      } catch (error) {
        errorEl.textContent = error.message;
      } finally {
        button.disabled = false;
        button.textContent = "Add Category";
      }
    });

    categoryList?.addEventListener("click", (event) => {
      const button = event.target.closest(".category-delete-btn");
      if (!button || button.disabled) return;
      openDeleteCategoryModal(button.dataset.categoryId, button.dataset.categoryName || "");
    });

    deleteCategoryClose?.addEventListener("click", closeDeleteCategoryModal);
    cancelDeleteCategoryBtn?.addEventListener("click", closeDeleteCategoryModal);
    confirmDeleteCategoryBtn?.addEventListener("click", deleteCategory);
    deleteCategoryModal?.addEventListener("click", (event) => {
      if (event.target === deleteCategoryModal) closeDeleteCategoryModal();
    });

    // Variants are managed by the dynamic variant group controls above.
  }

  // ─── INIT ─────────────────────────────────────────────

  setupEvents();
  loadProduct();
})();