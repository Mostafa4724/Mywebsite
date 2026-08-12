(function () {
  "use strict";

  const API_BASE = "http://127.0.0.1:5000";
  const token = () => sessionStorage.getItem("token") || "";

  const form = document.getElementById("editProductForm");
  const categorySelect = document.getElementById("prodCategory");
  const imageInput = document.getElementById("imageInput");
  const previewGrid = document.getElementById("previewGrid");
  const uploadPlaceholder = document.getElementById("uploadPlaceholder");
  const uploadArea = document.getElementById("uploadArea");
  const chooseImageBtn = document.getElementById("chooseImageBtn");
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
  const scheduledDate = document.getElementById("scheduledDate");
  const scheduleDate = document.getElementById("scheduleDate");

  let productId = null;
  let product = null;
  let currentImage = "";
  let selectedNewImage = null;
  let currentTags = [];
  let selectedSaleColor = "#ef4444";
  let dirty = false;
  let toastTimer = null;

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
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value).slice(0, 16);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function imageUrl(value) {
    if (!value) return "";

    // Already a complete URL
    if (/^https?:\/\//i.test(value) || value.startsWith("data:")) {
      return value;
    }

    // Backend stores either:
    // filename
    // /uploads/products/filename
    if (value.startsWith("/uploads/products/")) {
      return API_BASE + value;
    }

    return API_BASE + "/uploads/products/" + encodeURIComponent(value);
  }

  async function responseJson(response) {
    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch (_) {
      data = {};
    }
    if (!response.ok || data.success === false) {
      throw new Error(data.message || `Server returned ${response.status}`);
    }
    return data;
  }

  async function loadCategories(selectedId) {
    const response = await fetch(API_BASE + "/categories");
    const data = await responseJson(response);
    categorySelect.innerHTML =
      '<option value="" disabled>Select category</option>';
    data.categories.forEach((cat) => {
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

  function parseTags(value) {
    if (Array.isArray(value))
      return value
        .map(String)
        .map((s) => s.trim())
        .filter(Boolean);
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed))
        return parsed
          .map(String)
          .map((s) => s.trim())
          .filter(Boolean);
    } catch (_) {}
    return String(value)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function renderTags() {
    tagsList.innerHTML = "";
    currentTags.forEach((tag, index) => {
      const el = document.createElement("span");
      el.className = "tag";
      el.textContent = tag;
      const button = document.createElement("button");
      button.type = "button";
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
    const tag = String(value || "")
      .trim()
      .replace(/,$/, "");
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

  function renderImage() {
    previewGrid.innerHTML = "";
    const src = selectedNewImage
      ? selectedNewImage.preview
      : imageUrl(currentImage);
    if (!src) {
      previewGrid.style.display = "none";
      uploadPlaceholder.style.display = "flex";
      return;
    }
    uploadPlaceholder.style.display = "none";
    previewGrid.style.display = "grid";
    const item = document.createElement("div");
    item.className = "ap-preview-item";
    const img = document.createElement("img");
    img.src = src;
    img.alt = "Product image";
    item.appendChild(img);
    const label = document.createElement("span");
    label.style.cssText =
      "position:absolute;left:6px;bottom:6px;background:rgba(0,0,0,.65);color:#fff;padding:2px 6px;border-radius:4px;font-size:11px";
    label.textContent = selectedNewImage ? "New image" : "Current image";
    item.appendChild(label);
    previewGrid.appendChild(item);
  }

  function updateSalePreview() {
    const regular = Number(priceInput.value) || 0;
    const sale = Number(salePriceField.value) || 0;
    const valid = sale > 0 && sale < regular;
    if (discountPreview) {
      discountPreview.style.display =
        valid && saleToggle.checked ? "flex" : "none";
      if (valid) {
        const pct = Math.round(((regular - sale) / regular) * 100);
        const p = document.getElementById("discountPct");
        const r = document.getElementById("discRegular");
        const s = document.getElementById("discSale");
        const save = document.getElementById("discSave");
        if (p) p.textContent = pct + "%";
        if (r) r.textContent = "$" + regular.toFixed(2);
        if (s) s.textContent = "$" + sale.toFixed(2);
        if (save) save.textContent = "$" + (regular - sale).toFixed(2);
      }
    }
    if (saleBadgePreview)
      saleBadgePreview.style.display =
        valid && saleToggle.checked ? "block" : "none";
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
      document.getElementById("profitValue").textContent =
        "$" + profit.toFixed(2);
      document.getElementById("marginValue").textContent =
        margin.toFixed(1) + "%";
    } else box.style.display = "none";
  }

  function fillForm(p) {
    product = p;
    document.getElementById("prodName").value = p.title || "";
    document.getElementById("prodBrand").value = p.brand || "";
    document.getElementById("prodDesc").value = p.description || "";
    document.getElementById("prodPrice").value = p.price ?? "";
    document.getElementById("prodCost").value = p.cost ?? 0;
    document.getElementById("prodTax").value = p.tax_class || "standard";
    document.getElementById("prodStock").value = p.stock ?? 0;
    document.getElementById("prodLowStock").value = p.low_stock ?? 10;

    const status = document.querySelector(
      `input[name="publishStatus"][value="${CSS.escape(p.status || "draft")}"]`,
    );
    if (status) status.checked = true;
    if (p.status === "scheduled") scheduledDate.style.display = "block";
    if (scheduleDate) scheduleDate.value = toDateTimeLocal(p.scheduled_date);

    const stockStatus =
      p.stock_status ||
      (Number(p.stock) <= 0
        ? "out"
        : Number(p.stock) <= Number(p.low_stock || 0)
          ? "low"
          : "in");
    const stockRadio = document.querySelector(
      `input[name="stockStatus"][value="${CSS.escape(stockStatus)}"]`,
    );
    if (stockRadio) stockRadio.checked = true;
    document
      .querySelectorAll(".ap-stock-chip")
      .forEach((chip) =>
        chip.classList.toggle("active", chip.dataset.stock === stockStatus),
      );

    currentTags = parseTags(p.tags);
    renderTags();
    currentImage = p.image || "";
    selectedNewImage = null;
    renderImage();

    salePriceField.value = p.sale_price ?? "";
    saleStartDate.value = toDateTimeLocal(p.sale_start);
    saleEndDate.value = toDateTimeLocal(p.sale_end);
    saleBadge.value = p.sale_badge || "";
    selectedSaleColor = p.sale_badge_color || "#ef4444";
    document
      .querySelectorAll(".sale-color-btn")
      .forEach((btn) =>
        btn.classList.toggle("active", btn.dataset.color === selectedSaleColor),
      );
    setSaleState(Boolean(p.sale_enabled));

    const idStrong = document.querySelector(".ep-id-chip strong");
    if (idStrong) idStrong.textContent = "#" + p.id;
    const created = document.querySelector(".ep-created-date");
    if (created)
      created.textContent =
        "Created: " +
        (p.created_at ? new Date(p.created_at).toLocaleDateString() : "—");
    const modified = document.getElementById("lastModified");
    if (modified)
      modified.textContent = p.updated_at
        ? new Date(p.updated_at).toLocaleString()
        : "—";
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
      setPageError(
        error.message === "Product not found"
          ? "Product not found."
          : "Unable to load product. Please try again.",
      );
    }
  }

  async function saveProduct() {
    const name = document.getElementById("prodName").value.trim();
    const description = document.getElementById("prodDesc").value.trim();
    const categoryId = categorySelect.value;

    const price = Number(priceInput.value);
    const stock = Number(document.getElementById("prodStock").value);
    const lowStock = Number(document.getElementById("prodLowStock").value || 0);

    const salePrice =
      salePriceField.value === "" ? null : Number(salePriceField.value);

    const selectedStatus = document.querySelector(
      'input[name="publishStatus"]:checked',
    );

    const selectedStockStatus = document.querySelector(
      'input[name="stockStatus"]:checked',
    );

    // ========================================
    // VALIDATION
    // ========================================

    if (!name) {
      throw new Error("Please enter a product name.");
    }

    if (!description) {
      throw new Error("Description is required.");
    }

    if (!categoryId || categoryId === "__add_category__") {
      throw new Error("Please select a category.");
    }

    if (!Number.isFinite(price) || price < 0) {
      throw new Error("Price is invalid.");
    }

    if (!Number.isInteger(stock) || stock < 0) {
      throw new Error("Quantity is invalid.");
    }

    if (!Number.isInteger(lowStock) || lowStock < 0) {
      throw new Error("Low stock threshold is invalid.");
    }

    if (
      saleToggle.checked &&
      salePrice !== null &&
      (!Number.isFinite(salePrice) || salePrice <= 0 || salePrice >= price)
    ) {
      throw new Error(
        "Sale price must be greater than 0 and lower than regular price.",
      );
    }

    // ========================================
    // CATEGORY
    // ========================================

    const categoryOption = categorySelect.options[categorySelect.selectedIndex];

    // ========================================
    // CREATE FORMDATA
    // ========================================

    const body = new FormData();

    body.append("title", name);
    body.append("description", description);

    body.append("brand", document.getElementById("prodBrand").value.trim());

    body.append("category_id", categoryId);

    body.append(
      "category",
      categoryOption ? categoryOption.textContent.trim() : "",
    );

    body.append("price", String(price));

    body.append("cost", String(Number(costInput.value) || 0));

    body.append(
      "tax_class",
      document.getElementById("prodTax").value || "standard",
    );

    body.append("stock", String(stock));
    body.append("low_stock", String(lowStock));

    body.append(
      "stock_status",
      selectedStockStatus ? selectedStockStatus.value : "",
    );

    body.append("status", selectedStatus ? selectedStatus.value : "draft");

    body.append(
      "scheduled_date",
      selectedStatus && selectedStatus.value === "scheduled"
        ? scheduleDate.value || ""
        : "",
    );

    // ========================================
    // SALE
    // ========================================

    body.append("sale_enabled", saleToggle.checked ? "true" : "false");

    body.append(
      "sale_price",
      saleToggle.checked && salePrice !== null ? String(salePrice) : "",
    );

    body.append("sale_start", saleToggle.checked ? saleStartDate.value : "");

    body.append("sale_end", saleToggle.checked ? saleEndDate.value : "");

    body.append("sale_badge", saleBadge.value.trim());

    body.append("sale_badge_color", selectedSaleColor);

    // ========================================
    // TAGS
    // ========================================

    body.append("tags", currentTags.join(","));

    // ========================================
    // IMAGE
    // ========================================

  console.log("========== IMAGE BEFORE UPLOAD ==========");
  console.log("selectedNewImage:", selectedNewImage);
  console.log("imageInput:", imageInput);
  console.log("imageInput.files:", imageInput ? imageInput.files : null);
  console.log(
    "imageInput.files[0]:",
    imageInput && imageInput.files ? imageInput.files[0] : null
  );

  if (selectedNewImage && selectedNewImage.file instanceof File) {
    console.log("✅ Uploading:", selectedNewImage.file.name);

    body.append(
        "image",
        selectedNewImage.file,
        selectedNewImage.file.name
    );
  } else {
    console.log("❌ selectedNewImage is empty");
  }

    // ========================================
    // DEBUG FORMDATA
    // ========================================

    console.log("========== PRODUCT UPDATE ==========");

    for (const [key, value] of body.entries()) {
      if (value instanceof File) {
        console.log(key, "FILE:", value.name, value.type, value.size);
      } else {
        console.log(key, value);
      }
    }

    console.log("====================================");

    // ========================================
    // SEND UPDATE
    // ========================================

    const response = await fetch(`${API_BASE}/admin/products/${productId}`, {
      method: "PUT",
      headers: authHeaders(),
      body: body,
    });

    // ========================================
    // HANDLE RESPONSE
    // ========================================

    const data = await responseJson(response);

    console.log("Server updated product:", data.product);

    // ========================================
    // UPDATE LOCAL FORM WITH SERVER DATA
    // ========================================

    fillForm(data.product);

    showToast("Product updated successfully!", "success");

    // ========================================
    // GO BACK TO ADMIN PRODUCTS
    // ========================================

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

  function setupEvents() {
    document
      .querySelectorAll("input, select, textarea")
      .forEach((el) => el.addEventListener("input", markDirty));
    document
      .querySelectorAll("input, select, textarea")
      .forEach((el) => el.addEventListener("change", markDirty));

    priceInput.addEventListener("input", () => {
      updateProfit();
      updateSalePreview();
    });
    costInput.addEventListener("input", updateProfit);
    salePriceField.addEventListener("input", updateSalePreview);
    saleBadge.addEventListener("input", updateSalePreview);

    saleToggle.addEventListener("change", () => {
      setSaleState(saleToggle.checked);
      markDirty();
    });

    document.querySelectorAll(".sale-color-btn").forEach((btn) =>
      btn.addEventListener("click", () => {
        selectedSaleColor = btn.dataset.color || selectedSaleColor;
        document
          .querySelectorAll(".sale-color-btn")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        updateSalePreview();
        markDirty();
      }),
    );

    document.querySelectorAll('input[name="publishStatus"]').forEach((r) =>
      r.addEventListener("change", () => {
        scheduledDate.style.display =
          r.value === "scheduled" && r.checked ? "block" : "none";
      }),
    );

    document.querySelectorAll('input[name="stockStatus"]').forEach((r) =>
      r.addEventListener("change", () => {
        document
          .querySelectorAll(".ap-stock-chip")
          .forEach((c) =>
            c.classList.toggle(
              "active",
              c.dataset.stock === r.value && r.checked,
            ),
          );
      }),
    );

    tagInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        addTag(tagInput.value);
        tagInput.value = "";
      }
    });

    document
      .querySelectorAll(".suggested-tag")
      .forEach((btn) =>
        btn.addEventListener("click", () => addTag(btn.dataset.tag)),
      );

    // Open the native file picker only from an explicit user click.
    // Keeping this on a real button avoids Chrome's "user activation" warning.
    // ========================================
    // PRODUCT IMAGE UPLOAD
    // ========================================

    // ========================================
    // IMAGE PICKER
    // ========================================

    if (imageInput) {

    // Choose Image button
    if (chooseImageBtn) {
        chooseImageBtn.addEventListener("click", function (e) {
            e.preventDefault();
            e.stopPropagation();

            console.log("Opening file picker...");
            imageInput.click();
        });
    }

    // Upload area
    if (uploadArea) {
        uploadArea.addEventListener("click", function (e) {

            // Don't open picker twice when clicking the button
            if (e.target.closest("#chooseImageBtn")) {
                return;
            }

            console.log("Upload area clicked...");
            imageInput.click();
        });
    }

    // File selected
    imageInput.addEventListener("change", function (e) {

        console.log("========== FILE CHANGE ==========");

        const file = e.target.files?.[0];

        console.log("Selected file:", file);

        if (!file) {
            console.log("❌ No file selected");
            return;
        }

        console.log("✅ FILE SELECTED");
        console.log("Name:", file.name);
        console.log("Type:", file.type);
        console.log("Size:", file.size);

        // Check file type
        const allowedTypes = [
            "image/png",
            "image/jpeg",
            "image/webp"
        ];

        if (!allowedTypes.includes(file.type)) {
            showToast("Please select PNG, JPG, or WEBP image.", "warn");

            imageInput.value = "";
            return;
        }

        // Remove old preview URL if necessary
        if (selectedNewImage?.preview) {
            URL.revokeObjectURL(selectedNewImage.preview);
        }

        selectedNewImage = {
            file: file,
            preview: URL.createObjectURL(file)
        };

        console.log("selectedNewImage:", selectedNewImage);

        renderImage();
        markDirty();

        showToast("New image selected successfully!", "success");
    });
  }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        await saveProduct();
      } catch (error) {
        console.error(error);
        showToast(
          error.message || "Unable to update product. Please try again.",
          "warn",
        );
      }
    });

    document.getElementById("saveDraftBtn")?.addEventListener("click", () => {
      const draft = document.querySelector(
        'input[name="publishStatus"][value="draft"]',
      );
      if (draft) draft.checked = true;
      scheduledDate.style.display = "none";
      form.requestSubmit();
    });

    deleteProductBtn.addEventListener("click", () =>
      deleteModal.classList.add("show"),
    );
    cancelDelete.addEventListener("click", () =>
      deleteModal.classList.remove("show"),
    );
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
    stayOnPage?.addEventListener("click", () =>
      unsavedModal.classList.remove("show"),
    );
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

    // Category creation uses the same API as Add Product.
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
    document
      .getElementById("addCategoryClose")
      ?.addEventListener("click", closeCategory);
    document
      .getElementById("cancelCategoryBtn")
      ?.addEventListener("click", closeCategory);
    document
      .getElementById("saveCategoryBtn")
      ?.addEventListener("click", async () => {
        const input = document.getElementById("newCategoryName");
        const errorEl = document.getElementById("newCategoryError");
        const name = input.value.trim();
        if (!name) {
          errorEl.textContent = "Category name is required.";
          return;
        }
        try {
          const response = await fetch(API_BASE + "/categories", {
            method: "POST",
            headers: { ...authHeaders(), "Content-Type": "application/json" },
            body: JSON.stringify({ name }),
          });
          const data = await responseJson(response);
          await loadCategories(data.category.id);
          closeCategory();
          markDirty();
          showToast(`Category "${data.category.name}" created!`, "success");
        } catch (error) {
          errorEl.textContent = error.message;
        }
      });

    // Variants are not persisted by this database schema. Keep the existing UI
    // visible, but never pretend that edits to it were saved to SQLite.
    if (variantsList && addVariantBtn) {
      const note = document.createElement("div");
      note.style.cssText = "margin-top:10px;font-size:12px;opacity:.7";
      note.textContent =
        "Variants are not stored in the current product database, so they are not included in updates.";
      variantsList.parentElement?.appendChild(note);
      addVariantBtn.disabled = true;
      addVariantBtn.title =
        "Variants are not supported by the current database schema";
    }
  }
  console.log("IMAGE ELEMENT:", imageInput);
  console.log("CHOOSE BUTTON:", chooseImageBtn);

  if (imageInput) {
    console.log("IMAGE INPUT TYPE:", imageInput.type);
    console.log("IMAGE INPUT MULTIPLE:", imageInput.multiple);
    console.log("IMAGE INPUT ACCEPT:", imageInput.accept);
  }

  setupEvents();
  loadProduct();
})();
