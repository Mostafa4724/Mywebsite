// Global variable to store the selected file
window.selectedFile = null;

(function () {
  "use strict";

  const API_BASE = "http://127.0.0.1:5000";
  const token = () => sessionStorage.getItem("token") || "";

  // ---------------------------------------------------------------------------
  // DOM
  // ---------------------------------------------------------------------------

  const form = document.getElementById("editProductForm");

  const categorySelect = document.getElementById("prodCategory");

  const imageInput = document.getElementById("imageInput");
  const imagePreview = document.getElementById("imagePreview");
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

  const scheduledDate = document.getElementById("scheduledDate");
  const scheduleDate = document.getElementById("scheduleDate");

  // ---------------------------------------------------------------------------
  // Category image DOM
  // ---------------------------------------------------------------------------

  const newCategoryImage =
    document.getElementById("newCategoryImage");

  const newCategoryImagePreview =
    document.getElementById("newCategoryImagePreview");

  const categoryImagePlaceholder =
    document.getElementById("categoryImagePlaceholder");

  const removeCategoryImageBtn =
    document.getElementById("removeCategoryImageBtn");

  const newCategoryImageError =
    document.getElementById("newCategoryImageError");

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  let productId = null;
  let product = null;
  let currentImage = "";
  let currentTags = [];
  let selectedSaleColor = "#ef4444";
  let dirty = false;
  let toastTimer = null;

  // Temporary image selected in Add Category modal.
  let pendingCategoryImageData = "";

  // Category images are stored frontend-only because the backend is unchanged.
  const CATEGORY_IMAGES_STORAGE_KEY = "shop_category_images";

  // ---------------------------------------------------------------------------
  // Category image helpers
  // ---------------------------------------------------------------------------

  function getCategoryImages() {
    try {
      const raw = localStorage.getItem(
        CATEGORY_IMAGES_STORAGE_KEY
      );

      if (!raw) {
        return {};
      }

      const parsed = JSON.parse(raw);

      if (!parsed || typeof parsed !== "object") {
        return {};
      }

      return parsed;
    } catch (err) {
      console.warn(
        "Could not read saved category images:",
        err
      );

      return {};
    }
  }

  function saveCategoryImage(categoryId, dataUrl) {
    if (
      categoryId === null ||
      categoryId === undefined ||
      !dataUrl
    ) {
      return false;
    }

    try {
      const images = getCategoryImages();

      images[String(categoryId)] = dataUrl;

      localStorage.setItem(
        CATEGORY_IMAGES_STORAGE_KEY,
        JSON.stringify(images)
      );

      return true;
    } catch (err) {
      console.error(
        "Could not save category image:",
        err
      );

      showToast(
        "Category created, but the image could not be saved locally.",
        "warn"
      );

      return false;
    }
  }

  function getCategoryImage(categoryId) {
    if (
      categoryId === null ||
      categoryId === undefined
    ) {
      return "";
    }

    const images = getCategoryImages();

    return images[String(categoryId)] || "";
  }

  function resetCategoryImagePicker() {
    pendingCategoryImageData = "";

    if (newCategoryImage) {
      newCategoryImage.value = "";
    }

    if (newCategoryImagePreview) {
      newCategoryImagePreview.hidden = true;
      newCategoryImagePreview.removeAttribute("src");
      newCategoryImagePreview.style.display = "none";
    }

    if (categoryImagePlaceholder) {
      categoryImagePlaceholder.hidden = false;
      categoryImagePlaceholder.style.display = "";
    }

    if (removeCategoryImageBtn) {
      removeCategoryImageBtn.hidden = true;
      removeCategoryImageBtn.style.display = "";
    }

    if (newCategoryImageError) {
      newCategoryImageError.textContent = "";
    }
  }

  function resizeCategoryImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onerror = () => {
        reject(new Error("Could not read image."));
      };

      reader.onload = () => {
        const image = new Image();

        image.onerror = () => {
          reject(new Error("Invalid image file."));
        };

        image.onload = () => {
          const maxWidth = 1000;
          const maxHeight = 700;

          const scale = Math.min(
            1,
            maxWidth / image.width,
            maxHeight / image.height
          );

          const width = Math.max(
            1,
            Math.round(image.width * scale)
          );

          const height = Math.max(
            1,
            Math.round(image.height * scale)
          );

          const canvas = document.createElement("canvas");

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");

          if (!ctx) {
            reject(
              new Error(
                "Image processing is not supported."
              )
            );

            return;
          }

          ctx.drawImage(
            image,
            0,
            0,
            width,
            height
          );

          resolve(
            canvas.toDataURL(
              "image/jpeg",
              0.82
            )
          );
        };

        image.src = reader.result;
      };

      reader.readAsDataURL(file);
    });
  }

  async function handleCategoryImageChange(file) {
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      resetCategoryImagePicker();

      if (newCategoryImageError) {
        newCategoryImageError.textContent =
          "Please choose an image file.";
      }

      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      resetCategoryImagePicker();

      if (newCategoryImageError) {
        newCategoryImageError.textContent =
          "Image must be 8MB or smaller.";
      }

      return;
    }

    try {
      if (newCategoryImageError) {
        newCategoryImageError.textContent = "";
      }

      pendingCategoryImageData =
        await resizeCategoryImage(file);

      if (newCategoryImagePreview) {
        newCategoryImagePreview.src =
          pendingCategoryImageData;

        newCategoryImagePreview.hidden = false;
        newCategoryImagePreview.style.display = "block";
      }

      if (categoryImagePlaceholder) {
        categoryImagePlaceholder.hidden = true;
        categoryImagePlaceholder.style.display = "none";
      }

      if (removeCategoryImageBtn) {
        removeCategoryImageBtn.hidden = false;
      }
    } catch (err) {
      console.error(
        "Failed to process category image:",
        err
      );

      resetCategoryImagePicker();

      if (newCategoryImageError) {
        newCategoryImageError.textContent =
          "Could not process this image. Please try another one.";
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function authHeaders() {
    const t = token();

    return t
      ? {
          Authorization: "Bearer " + t,
        }
      : {};
  }

  function showToast(message, type) {
    if (!toast || !toastMsg) {
      return;
    }

    clearTimeout(toastTimer);

    toastMsg.textContent = message;

    const icon = toast.querySelector("svg");

    if (icon) {
      icon.style.color =
        type === "warn"
          ? "#f59e0b"
          : "#22c55e";
    }

    toast.classList.add("show");

    toastTimer = setTimeout(() => {
      toast.classList.remove("show");
    }, 3500);
  }

  function setPageError(message) {
    showToast(message, "warn");

    const heading =
      document.querySelector(".topbar-title h2");

    if (heading) {
      heading.textContent = message;
    }
  }

  function markDirty() {
    dirty = true;
  }

  function toDateTimeLocal(value) {
    if (!value) {
      return "";
    }

    const d = new Date(value);

    if (Number.isNaN(d.getTime())) {
      return String(value).slice(0, 16);
    }

    const pad = (n) =>
      String(n).padStart(2, "0");

    return (
      `${d.getFullYear()}-` +
      `${pad(d.getMonth() + 1)}-` +
      `${pad(d.getDate())}T` +
      `${pad(d.getHours())}:` +
      `${pad(d.getMinutes())}`
    );
  }

  function imageUrl(value) {
    if (!value) {
      return "";
    }

    if (
      /^https?:\/\//i.test(value) ||
      value.startsWith("data:")
    ) {
      return value;
    }

    let url;

    if (value.startsWith("/uploads/products/")) {
      url = API_BASE + value;
    } else {
      url =
        API_BASE +
        "/uploads/products/" +
        encodeURIComponent(value);
    }

    return url + "?v=" + Date.now();
  }

  async function responseJson(response) {
    const text = await response.text();

    let data;

    try {
      data = text
        ? JSON.parse(text)
        : {};
    } catch (_) {
      data = {};
    }

    if (
      !response.ok ||
      data.success === false
    ) {
      throw new Error(
        data.message ||
          `Server returned ${response.status}`
      );
    }

    return data;
  }

  // ---------------------------------------------------------------------------
  // Categories
  // ---------------------------------------------------------------------------

  async function loadCategories(selectedId) {
    const response = await fetch(
      API_BASE + "/categories"
    );

    const data = await responseJson(response);

    categorySelect.innerHTML =
      '<option value="" disabled>Select category</option>';

    (data.categories || []).forEach((cat) => {
      const option =
        document.createElement("option");

      option.value = String(cat.id);
      option.textContent = cat.name;

      categorySelect.appendChild(option);
    });

    const add =
      document.createElement("option");

    add.value = "__add_category__";
    add.textContent = "+ Add Category";

    categorySelect.appendChild(add);

    if (
      selectedId !== null &&
      selectedId !== undefined
    ) {
      categorySelect.value =
        String(selectedId);
    }
  }

  // ---------------------------------------------------------------------------
  // Tags
  // ---------------------------------------------------------------------------

  function parseTags(value) {
    if (Array.isArray(value)) {
      return value
        .map(String)
        .map((s) => s.trim())
        .filter(Boolean);
    }

    if (!value) {
      return [];
    }

    try {
      const parsed = JSON.parse(value);

      if (Array.isArray(parsed)) {
        return parsed
          .map(String)
          .map((s) => s.trim())
          .filter(Boolean);
      }
    } catch (_) {}

    return String(value)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function renderTags() {
    tagsList.innerHTML = "";

    currentTags.forEach((tag, index) => {
      const el =
        document.createElement("span");

      el.className = "tag";
      el.textContent = tag;

      const button =
        document.createElement("button");

      button.type = "button";
      button.textContent = "×";

      button.addEventListener(
        "click",
        () => {
          currentTags.splice(index, 1);
          renderTags();
          markDirty();
        }
      );

      el.appendChild(button);
      tagsList.appendChild(el);
    });
  }

  function addTag(value) {
    const tag = String(value || "")
      .trim()
      .replace(/,$/, "");

    if (!tag) {
      return;
    }

    if (currentTags.includes(tag)) {
      return;
    }

    if (currentTags.length >= 10) {
      showToast(
        "Maximum 10 tags allowed",
        "warn"
      );
      return;
    }

    currentTags.push(tag);

    renderTags();
    markDirty();
  }

  // ---------------------------------------------------------------------------
  // Sale
  // ---------------------------------------------------------------------------

  function updateSalePreview() {
    const regular =
      Number(priceInput.value) || 0;

    const sale =
      Number(salePriceField.value) || 0;

    const valid =
      sale > 0 &&
      sale < regular;

    if (discountPreview) {
      discountPreview.style.display =
        valid && saleToggle.checked
          ? "flex"
          : "none";

      if (valid) {
        const pct =
          Math.round(
            ((regular - sale) /
              regular) *
              100
          );

        const discountPct =
          document.getElementById(
            "discountPct"
          );

        const discRegular =
          document.getElementById(
            "discRegular"
          );

        const discSale =
          document.getElementById(
            "discSale"
          );

        const discSave =
          document.getElementById(
            "discSave"
          );

        if (discountPct) {
          discountPct.textContent =
            pct + "%";
        }

        if (discRegular) {
          discRegular.textContent =
            "$" +
            regular.toFixed(2);
        }

        if (discSale) {
          discSale.textContent =
            "$" +
            sale.toFixed(2);
        }

        if (discSave) {
          discSave.textContent =
            "$" +
            (regular - sale).toFixed(2);
        }
      }
    }

    if (saleBadgePreview) {
      saleBadgePreview.style.display =
        valid && saleToggle.checked
          ? "block"
          : "none";
    }

    const mockBadge =
      document.getElementById(
        "mockBadge"
      );

    const mockRegular =
      document.getElementById(
        "mockRegular"
      );

    const mockSalePrice =
      document.getElementById(
        "mockSalePrice"
      );

    if (mockBadge) {
      mockBadge.textContent = (
        saleBadge.value.trim() ||
        "SALE"
      ).toUpperCase();

      mockBadge.style.background =
        selectedSaleColor;
    }

    if (mockRegular) {
      mockRegular.textContent =
        "$" +
        regular.toFixed(2);
    }

    if (mockSalePrice) {
      mockSalePrice.textContent =
        "$" +
        sale.toFixed(2);
    }
  }

  function setSaleState(enabled) {
    saleToggle.checked =
      !!enabled;

    saleOverlay.style.display =
      enabled
        ? "none"
        : "block";

    saleFields.style.display =
      enabled
        ? "block"
        : "none";

    updateSalePreview();
  }

  // ---------------------------------------------------------------------------
  // Profit
  // ---------------------------------------------------------------------------

  function updateProfit() {
    const price =
      Number(priceInput.value) || 0;

    const cost =
      Number(costInput.value) || 0;

    const box =
      document.getElementById(
        "profitCalc"
      );

    if (!box) {
      return;
    }

    if (cost > 0) {
      box.style.display = "flex";

      const profit =
        price - cost;

      const margin =
        price
          ? (profit / price) * 100
          : 0;

      const profitValue =
        document.getElementById(
          "profitValue"
        );

      const marginValue =
        document.getElementById(
          "marginValue"
        );

      if (profitValue) {
        profitValue.textContent =
          "$" +
          profit.toFixed(2);
      }

      if (marginValue) {
        marginValue.textContent =
          margin.toFixed(1) +
          "%";
      }
    } else {
      box.style.display = "none";
    }
  }

  // ---------------------------------------------------------------------------
  // Fill form
  // ---------------------------------------------------------------------------

  function fillForm(p) {
    product = p;

    document.getElementById(
      "prodName"
    ).value =
      p.title || "";

    document.getElementById(
      "prodBrand"
    ).value =
      p.brand || "";

    document.getElementById(
      "prodDesc"
    ).value =
      p.description || "";

    document.getElementById(
      "prodPrice"
    ).value =
      p.price ?? "";

    document.getElementById(
      "prodCost"
    ).value =
      p.cost ?? 0;

    document.getElementById(
      "prodTax"
    ).value =
      p.tax_class ||
      "standard";

    document.getElementById(
      "prodStock"
    ).value =
      p.stock ?? 0;

    document.getElementById(
      "prodLowStock"
    ).value =
      p.low_stock ?? 10;

    const status =
      document.querySelector(
        `input[name="publishStatus"][value="${CSS.escape(
          p.status || "draft"
        )}"]`
      );

    if (status) {
      status.checked = true;
    }

    if (
      p.status === "scheduled" &&
      scheduledDate
    ) {
      scheduledDate.style.display =
        "block";
    }

    if (scheduleDate) {
      scheduleDate.value =
        toDateTimeLocal(
          p.scheduled_date
        );
    }

    const stockStatus =
      p.stock_status ||
      (
        Number(p.stock) <= 0
          ? "out"
          : Number(p.stock) <=
              Number(
                p.low_stock || 0
              )
            ? "low"
            : "in"
      );

    const stockRadio =
      document.querySelector(
        `input[name="stockStatus"][value="${CSS.escape(
          stockStatus
        )}"]`
      );

    if (stockRadio) {
      stockRadio.checked = true;
    }

    document
      .querySelectorAll(
        ".ap-stock-chip"
      )
      .forEach((chip) =>
        chip.classList.toggle(
          "active",
          chip.dataset.stock ===
            stockStatus
        )
      );

    currentTags =
      parseTags(p.tags);

    renderTags();

    currentImage =
      p.image || "";

    if (currentImage) {
      imagePreview.src =
        imageUrl(currentImage);

      imagePreview.style.display =
        "block";

      uploadPlaceholder.style.display =
        "none";
    } else {
      imagePreview.style.display =
        "none";

      uploadPlaceholder.style.display =
        "flex";
    }

    window.selectedFile = null;

    if (imageInput) {
      imageInput.value = "";
    }

    salePriceField.value =
      p.sale_price ?? "";

    saleStartDate.value =
      toDateTimeLocal(
        p.sale_start
      );

    saleEndDate.value =
      toDateTimeLocal(
        p.sale_end
      );

    saleBadge.value =
      p.sale_badge || "";

    selectedSaleColor =
      p.sale_badge_color ||
      "#ef4444";

    document
      .querySelectorAll(
        ".sale-color-btn"
      )
      .forEach((btn) =>
        btn.classList.toggle(
          "active",
          btn.dataset.color ===
            selectedSaleColor
        )
      );

    setSaleState(
      Boolean(p.sale_enabled)
    );

    const idStrong =
      document.querySelector(
        ".ep-id-chip strong"
      );

    if (idStrong) {
      idStrong.textContent =
        "#" + p.id;
    }

    const created =
      document.querySelector(
        ".ep-created-date"
      );

    if (created) {
      created.textContent =
        "Created: " +
        (
          p.created_at
            ? new Date(
                p.created_at
              ).toLocaleDateString()
            : "—"
        );
    }

    const modified =
      document.getElementById(
        "lastModified"
      );

    if (modified) {
      modified.textContent =
        p.updated_at
          ? new Date(
              p.updated_at
            ).toLocaleString()
          : "—";
    }

    if (deleteProductName) {
      deleteProductName.textContent =
        p.title ||
        "this product";
    }

    updateProfit();
    updateSalePreview();

    dirty = false;
  }

  // ---------------------------------------------------------------------------
  // Load product
  // ---------------------------------------------------------------------------

  async function loadProduct() {
    const params =
      new URLSearchParams(
        window.location.search
      );

    const rawId =
      params.get("id");

    productId =
      Number(rawId);

    if (
      !rawId ||
      !Number.isInteger(productId) ||
      productId <= 0
    ) {
      setPageError(
        "Product not found."
      );
      return;
    }

    try {
      const response =
        await fetch(
          `${API_BASE}/products/${productId}`
        );

      const data =
        await responseJson(
          response
        );

      await loadCategories(
        data.product.category_id
      );

      fillForm(
        data.product
      );
    } catch (error) {
      console.error(error);

      setPageError(
        error.message ===
          "Product not found"
          ? "Product not found."
          : "Unable to load product. Please try again."
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Save product
  // ---------------------------------------------------------------------------

  async function saveProduct() {
    const name =
      document.getElementById(
        "prodName"
      ).value.trim();

    const description =
      document.getElementById(
        "prodDesc"
      ).value.trim();

    const categoryId =
      categorySelect.value;

    const price =
      Number(
        priceInput.value
      );

    const stock =
      Number(
        document.getElementById(
          "prodStock"
        ).value
      );

    const lowStock =
      Number(
        document.getElementById(
          "prodLowStock"
        ).value || 0
      );

    const salePrice =
      salePriceField.value === ""
        ? null
        : Number(
            salePriceField.value
          );

    const selectedStatus =
      document.querySelector(
        'input[name="publishStatus"]:checked'
      );

    const selectedStockStatus =
      document.querySelector(
        'input[name="stockStatus"]:checked'
      );

    if (!name) {
      throw new Error(
        "Please enter a product name."
      );
    }

    if (!description) {
      throw new Error(
        "Description is required."
      );
    }

    if (
      !categoryId ||
      categoryId ===
        "__add_category__"
    ) {
      throw new Error(
        "Please select a category."
      );
    }

    if (
      !Number.isFinite(price) ||
      price < 0
    ) {
      throw new Error(
        "Price is invalid."
      );
    }

    if (
      !Number.isInteger(stock) ||
      stock < 0
    ) {
      throw new Error(
        "Quantity is invalid."
      );
    }

    if (
      !Number.isInteger(
        lowStock
      ) ||
      lowStock < 0
    ) {
      throw new Error(
        "Low stock threshold is invalid."
      );
    }

    if (
      saleToggle.checked &&
      salePrice !== null &&
      (
        !Number.isFinite(
          salePrice
        ) ||
        salePrice <= 0 ||
        salePrice >= price
      )
    ) {
      throw new Error(
        "Sale price must be greater than 0 and lower than regular price."
      );
    }

    const categoryOption =
      categorySelect.options[
        categorySelect.selectedIndex
      ];

    const body =
      new FormData();

    body.append(
      "title",
      name
    );

    body.append(
      "description",
      description
    );

    body.append(
      "brand",
      document.getElementById(
        "prodBrand"
      ).value.trim()
    );

    body.append(
      "category_id",
      categoryId
    );

    body.append(
      "category",
      categoryOption
        ? categoryOption.textContent.trim()
        : ""
    );

    body.append(
      "price",
      String(price)
    );

    body.append(
      "cost",
      String(
        Number(
          costInput.value
        ) || 0
      )
    );

    body.append(
      "tax_class",
      document.getElementById(
        "prodTax"
      ).value ||
        "standard"
    );

    body.append(
      "stock",
      String(stock)
    );

    body.append(
      "low_stock",
      String(lowStock)
    );

    body.append(
      "stock_status",
      selectedStockStatus
        ? selectedStockStatus.value
        : ""
    );

    body.append(
      "status",
      selectedStatus
        ? selectedStatus.value
        : "draft"
    );

    body.append(
      "scheduled_date",
      selectedStatus &&
        selectedStatus.value ===
          "scheduled"
        ? scheduleDate.value ||
            ""
        : ""
    );

    body.append(
      "sale_enabled",
      saleToggle.checked
        ? "true"
        : "false"
    );

    body.append(
      "sale_price",
      saleToggle.checked &&
        salePrice !== null
        ? String(salePrice)
        : ""
    );

    body.append(
      "sale_start",
      saleToggle.checked
        ? saleStartDate.value
        : ""
    );

    body.append(
      "sale_end",
      saleToggle.checked
        ? saleEndDate.value
        : ""
    );

    body.append(
      "sale_badge",
      saleBadge.value.trim()
    );

    body.append(
      "sale_badge_color",
      selectedSaleColor
    );

    body.append(
      "tags",
      currentTags.join(",")
    );

    let file =
      window.selectedFile;

    if (
      !file &&
      imageInput &&
      imageInput.files &&
      imageInput.files[0]
    ) {
      file =
        imageInput.files[0];
    }

    if (file) {
      body.append(
        "image",
        file,
        file.name
      );
    }

    body.append(
      "_method",
      "PUT"
    );

    const response =
      await fetch(
        `${API_BASE}/admin/products/${productId}`,
        {
          method: "POST",
          headers: authHeaders(),
          body: body,
        }
      );

    const data =
      await responseJson(
        response
      );

    fillForm(
      data.product
    );

    showToast(
      "Product updated successfully!",
      "success"
    );

    setTimeout(() => {
      window.location.href =
        "admin_product.html";
    }, 700);
  }

  // ---------------------------------------------------------------------------
  // Delete product
  // ---------------------------------------------------------------------------

  async function deleteProduct() {
    const response =
      await fetch(
        `${API_BASE}/admin/products/${productId}`,
        {
          method: "DELETE",
          headers: authHeaders(),
        }
      );

    await responseJson(
      response
    );

    showToast(
      "Product deleted successfully",
      "success"
    );

    dirty = false;

    setTimeout(() => {
      window.location.href =
        "admin_product.html";
    }, 700);
  }

  // ---------------------------------------------------------------------------
  // Variants
  // ---------------------------------------------------------------------------

  function bindVariantRemove() {
    if (!variantsList) {
      return;
    }

    variantsList
      .querySelectorAll(
        ".variant-remove"
      )
      .forEach((btn) => {
        if (
          btn.dataset.bound ===
          "1"
        ) {
          return;
        }

        btn.dataset.bound = "1";

        btn.addEventListener(
          "click",
          () => {
            if (
              variantsList
                .children
                .length > 0
            ) {
              const row =
                btn.closest(
                  ".ap-variant-row"
                );

              if (!row) {
                return;
              }

              row.style.transition =
                "all 0.2s";

              row.style.opacity =
                "0";

              row.style.transform =
                "translateY(-8px)";

              setTimeout(() => {
                row.remove();
              }, 200);

              markDirty();
            }
          }
        );
      });
  }

  function setupVariants() {
    if (
      !variantsList ||
      !addVariantBtn
    ) {
      return;
    }

    addVariantBtn.addEventListener(
      "click",
      () => {
        const row =
          document.createElement(
            "div"
          );

        row.className =
          "ap-variant-row";

        row.innerHTML =
          '<div class="variant-field"><label>Size</label><select class="variant-select"><option value="xs">XS</option><option value="s">S</option><option value="m" selected>M</option><option value="l">L</option><option value="xl">XL</option><option value="xxl">XXL</option></select></div>' +
          '<div class="variant-field"><label>Color</label><input type="text" class="variant-input" placeholder="e.g. White" /></div>' +
          '<div class="variant-field"><label>Stock</label><input type="number" class="variant-input" placeholder="0" min="0" value="0" /></div>' +
          '<div class="variant-field"><label>Price</label><div class="ap-input-prefix sm"><span>$</span><input type="number" class="variant-input" placeholder="0.00" step="0.01" min="0" /></div></div>' +
          '<button type="button" class="variant-remove" aria-label="Remove variant"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>';

        variantsList.appendChild(
          row
        );

        bindVariantRemove();
        markDirty();
      }
    );

    bindVariantRemove();
  }

  // ---------------------------------------------------------------------------
  // Category modal
  // ---------------------------------------------------------------------------

  function openCategoryModal() {
    const modal =
      document.getElementById(
        "addCategoryModal"
      );

    if (!modal) {
      return;
    }

    resetCategoryImagePicker();

    modal.removeAttribute(
      "hidden"
    );

    modal.style.display =
      "flex";

    const input =
      document.getElementById(
        "newCategoryName"
      );

    if (input) {
      setTimeout(() => {
        input.focus();
      }, 50);
    }
  }

  function closeCategoryModal() {
    const modal =
      document.getElementById(
        "addCategoryModal"
      );

    if (!modal) {
      return;
    }

    modal.setAttribute(
      "hidden",
      ""
    );

    modal.style.display =
      "none";

    resetCategoryImagePicker();
  }

  async function createCategory() {
    const input =
      document.getElementById(
        "newCategoryName"
      );

    const errorEl =
      document.getElementById(
        "newCategoryError"
      );

    const saveBtn =
      document.getElementById(
        "saveCategoryBtn"
      );

    if (
      !input ||
      !errorEl ||
      !saveBtn
    ) {
      return;
    }

    const name =
      input.value.trim();

    if (!name) {
      errorEl.textContent =
        "Category name is required.";

      return;
    }

    errorEl.textContent = "";

    saveBtn.disabled = true;
    saveBtn.textContent =
      "Saving...";

    try {
      const response =
        await fetch(
          API_BASE + "/categories",
          {
            method: "POST",
            headers: {
              ...authHeaders(),
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              name,
            }),
          }
        );

      const data =
        await responseJson(
          response
        );

      const newCategoryId =
        data.category &&
        data.category.id;

      // Save the image only after the backend
      // has successfully created the category.
      if (
        newCategoryId !==
          null &&
        newCategoryId !==
          undefined &&
        pendingCategoryImageData
      ) {
        saveCategoryImage(
          newCategoryId,
          pendingCategoryImageData
        );
      }

      // Reload only the dropdown contents.
      // This does NOT reload the browser page
      // and therefore does not erase the product form.
      await loadCategories(
        newCategoryId
      );

      closeCategoryModal();

      markDirty();

      showToast(
        `Category "${data.category.name}" created!`,
        "success"
      );
    } catch (error) {
      console.error(
        "Failed to create category:",
        error
      );

      errorEl.textContent =
        error.message ||
        "Unable to create category.";
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent =
        "Add Category";
    }
  }

  // ---------------------------------------------------------------------------
  // Event setup
  // ---------------------------------------------------------------------------

  function setupEvents() {
    const categoryImageDropzone =
      document.getElementById("categoryImageDropzone");

    categoryImageDropzone?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      newCategoryImage?.click();
    });
    document
      .querySelectorAll(
        "input, select, textarea"
      )
      .forEach((el) => {
        el.addEventListener(
          "input",
          markDirty
        );

        el.addEventListener(
          "change",
          markDirty
        );
      });

    // Product pricing
    if (priceInput) {
      priceInput.addEventListener(
        "input",
        () => {
          updateProfit();
          updateSalePreview();
        }
      );
    }

    if (costInput) {
      costInput.addEventListener(
        "input",
        updateProfit
      );
    }

    if (salePriceField) {
      salePriceField.addEventListener(
        "input",
        updateSalePreview
      );
    }

    if (saleBadge) {
      saleBadge.addEventListener(
        "input",
        updateSalePreview
      );
    }

    // Sale toggle
    if (saleToggle) {
      saleToggle.addEventListener(
        "change",
        () => {
          setSaleState(
            saleToggle.checked
          );

          markDirty();
        }
      );
    }

    // Sale colors
    document
      .querySelectorAll(
        ".sale-color-btn"
      )
      .forEach((btn) => {
        btn.addEventListener(
          "click",
          () => {
            selectedSaleColor =
              btn.dataset.color ||
              selectedSaleColor;

            document
              .querySelectorAll(
                ".sale-color-btn"
              )
              .forEach((b) =>
                b.classList.remove(
                  "active"
                )
              );

            btn.classList.add(
              "active"
            );

            updateSalePreview();

            markDirty();
          }
        );
      });

    // Publish status
    document
      .querySelectorAll(
        'input[name="publishStatus"]'
      )
      .forEach((radio) => {
        radio.addEventListener(
          "change",
          () => {
            if (!scheduledDate) {
              return;
            }

            scheduledDate.style.display =
              radio.value ===
                "scheduled" &&
              radio.checked
                ? "block"
                : "none";
          }
        );
      });

    // Stock status
    document
      .querySelectorAll(
        'input[name="stockStatus"]'
      )
      .forEach((radio) => {
        radio.addEventListener(
          "change",
          () => {
            document
              .querySelectorAll(
                ".ap-stock-chip"
              )
              .forEach((chip) =>
                chip.classList.toggle(
                  "active",
                  chip.dataset.stock ===
                    radio.value &&
                    radio.checked
                )
              );
          }
        );
      });

    // Tags
    if (tagInput) {
      tagInput.addEventListener(
        "keydown",
        (e) => {
          if (
            e.key === "Enter" ||
            e.key === ","
          ) {
            e.preventDefault();

            addTag(
              tagInput.value
            );

            tagInput.value =
              "";
          }
        }
      );
    }

    document
      .querySelectorAll(
        ".suggested-tag"
      )
      .forEach((btn) => {
        btn.addEventListener(
          "click",
          () =>
            addTag(
              btn.dataset.tag
            )
        );
      });

    // Product image
    if (imageInput) {
      imageInput.addEventListener(
        "change",
        function (e) {
          const file =
            e.target.files[0];

          window.selectedFile =
            file || null;

          if (!file) {
            imagePreview.style.display =
              "none";

            uploadPlaceholder.style.display =
              "flex";

            return;
          }

          const allowedTypes = [
            "image/png",
            "image/jpeg",
            "image/webp",
          ];

          if (
            !allowedTypes.includes(
              file.type
            )
          ) {
            showToast(
              "Please select PNG, JPG, or WEBP image.",
              "warn"
            );

            imageInput.value =
              "";

            window.selectedFile =
              null;

            imagePreview.style.display =
              "none";

            uploadPlaceholder.style.display =
              "flex";

            return;
          }

          const reader =
            new FileReader();

          reader.onload =
            function (ev) {
              imagePreview.src =
                ev.target.result;

              imagePreview.style.display =
                "block";

              uploadPlaceholder.style.display =
                "none";
            };

          reader.readAsDataURL(
            file
          );

          markDirty();

          showToast(
            "New image selected successfully!",
            "success"
          );
        }
      );
    }

    // -------------------------------------------------------------------------
    // Category image picker
    // -------------------------------------------------------------------------

    if (newCategoryImage) {
      newCategoryImage.addEventListener(
        "change",
        async (e) => {
          const file =
            e.target.files &&
            e.target.files[0];

          await handleCategoryImageChange(
            file
          );
        }
      );
    }

    if (removeCategoryImageBtn) {
      removeCategoryImageBtn.addEventListener(
        "click",
        (e) => {
          e.preventDefault();
          e.stopPropagation();

          resetCategoryImagePicker();
        }
      );
    }

    // -------------------------------------------------------------------------
    // Product form submit
    // -------------------------------------------------------------------------

    if (form) {
      form.addEventListener(
        "submit",
        async (e) => {
          e.preventDefault();

          try {
            await saveProduct();
          } catch (error) {
            console.error(error);

            showToast(
              error.message ||
                "Unable to update product. Please try again.",
              "warn"
            );
          }
        }
      );
    }

    // Save Draft
    document
      .getElementById(
        "saveDraftBtn"
      )
      ?.addEventListener(
        "click",
        (e) => {
          e.preventDefault();

          const draft =
            document.querySelector(
              'input[name="publishStatus"][value="draft"]'
            );

          if (draft) {
            draft.checked =
              true;
          }

          if (scheduledDate) {
            scheduledDate.style.display =
              "none";
          }

          if (form) {
            form.requestSubmit();
          }
        }
      );

    // Delete modal
    if (deleteProductBtn) {
      deleteProductBtn.addEventListener(
        "click",
        () =>
          deleteModal?.classList.add(
            "show"
          )
      );
    }

    if (cancelDelete) {
      cancelDelete.addEventListener(
        "click",
        () =>
          deleteModal?.classList.remove(
            "show"
          )
      );
    }

    if (confirmDelete) {
      confirmDelete.addEventListener(
        "click",
        async () => {
          try {
            await deleteProduct();
          } catch (error) {
            console.error(error);

            deleteModal?.classList.remove(
              "show"
            );

            showToast(
              error.message ||
                "Unable to delete product.",
              "warn"
            );
          }
        }
      );
    }

    // Back link
    const backLink =
      form?.querySelector(
        ".ap-cancel-btn"
      );

    backLink?.addEventListener(
      "click",
      (e) => {
        if (!dirty) {
          return;
        }

        e.preventDefault();

        unsavedModal?.classList.add(
          "show"
        );
      }
    );

    stayOnPage?.addEventListener(
      "click",
      () =>
        unsavedModal?.classList.remove(
          "show"
        )
    );

    leaveAnyway?.addEventListener(
      "click",
      () => {
        dirty = false;

        window.location.href =
          "admin_product.html";
      }
    );

    window.addEventListener(
      "beforeunload",
      (e) => {
        if (dirty) {
          e.preventDefault();
          e.returnValue = "";
        }
      }
    );

    // -------------------------------------------------------------------------
    // Category dropdown
    // -------------------------------------------------------------------------

    if (categorySelect) {
      categorySelect.addEventListener(
        "change",
        async () => {
          if (
            categorySelect.value !==
            "__add_category__"
          ) {
            return;
          }

          // Restore the current product category
          // while the modal is open.
          categorySelect.value =
            product
              ? String(
                  product.category_id ||
                    ""
                )
              : "";

          openCategoryModal();
        }
      );
    }

    // -------------------------------------------------------------------------
    // Category modal controls
    // -------------------------------------------------------------------------

    document
      .getElementById(
        "addCategoryClose"
      )
      ?.addEventListener(
        "click",
        (e) => {
          e.preventDefault();
          e.stopPropagation();

          closeCategoryModal();
        }
      );

    document
      .getElementById(
        "cancelCategoryBtn"
      )
      ?.addEventListener(
        "click",
        (e) => {
          e.preventDefault();
          e.stopPropagation();

          closeCategoryModal();
        }
      );

    document
      .getElementById(
        "saveCategoryBtn"
      )
      ?.addEventListener(
        "click",
        async (e) => {
          e.preventDefault();
          e.stopPropagation();

          await createCategory();
        }
      );

    // Press Enter inside category name:
    // create the category without submitting
    // anything else on the product page.
    const newCategoryName =
      document.getElementById(
        "newCategoryName"
      );

    newCategoryName?.addEventListener(
      "keydown",
      async (e) => {
        if (
          e.key !== "Enter"
        ) {
          return;
        }

        e.preventDefault();
        e.stopPropagation();

        await createCategory();
      }
    );

    // Clicking the overlay itself closes
    // the category modal.
    const categoryModal =
      document.getElementById(
        "addCategoryModal"
      );

    categoryModal?.addEventListener(
      "click",
      (e) => {
        if (
          e.target ===
          categoryModal
        ) {
          closeCategoryModal();
        }
      }
    );

    // -------------------------------------------------------------------------
    // Variants
    // -------------------------------------------------------------------------

    setupVariants();
  }

  // ---------------------------------------------------------------------------
  // INIT
  // ---------------------------------------------------------------------------

  setupEvents();
  loadProduct();
})();