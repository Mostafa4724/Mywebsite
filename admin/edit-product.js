(function () {
  "use strict";

  /* ============================
     Sample Product Data (simulating loaded data)
     ============================ */
  var productData = {
    name: "Premium Running Shoes",
    brand: "Nike",
    category: "footwear",
    description:
      "Engineered for peak performance, these premium running shoes feature a responsive ZoomX foam midsole that delivers explosive energy return with every stride. The lightweight Flyknit upper wraps your foot in a breathable, sock-like fit that adapts to your movement. A full-length carbon fiber plate provides propulsive stability, while the durable rubber outsole offers superior traction on both wet and dry surfaces. Ideal for marathon training, tempo runs, and race day.",
    price: 129.99,
    cost: 58.0,
    tax: "standard",
    status: "published",
    stock: 75,
    lowStock: 10,
    stockStatus: "in",
    tags: ["bestseller", "running", "new arrival"],
    sale: {
      enabled: true,
      price: 99.99,
      startDate: "2025-01-20T09:00",
      endDate: "2025-02-15T23:59",
      badge: "Winter Sale",
      badgeColor: "#ef4444",
    },
    images: [
      "https://picsum.photos/seed/shoe1/400/400.jpg",
      "https://picsum.photos/seed/shoe2/400/400.jpg",
      "https://picsum.photos/seed/shoe3/400/400.jpg",
    ],
    variants: [
      { size: "m", color: "Black", stock: 25, price: 129.99 },
      { size: "l", color: "White", stock: 30, price: 129.99 },
      { size: "xl", color: "Navy", stock: 20, price: 139.99 },
    ],
  };

  /* ============================
     DOM References
     ============================ */
  var sidebar = document.getElementById("adminSidebar");
  var menuToggle = document.getElementById("menuToggle");
  var form = document.getElementById("editProductForm");
  var uploadArea = document.getElementById("uploadArea");
  var uploadPlaceholder = document.getElementById("uploadPlaceholder");
  var imageInput = document.getElementById("imageInput");
  var previewGrid = document.getElementById("previewGrid");
  var variantsList = document.getElementById("variantsList");
  var addVariantBtn = document.getElementById("addVariantBtn");
  var saleToggle = document.getElementById("saleToggle");
  var saleOverlay = document.getElementById("saleOverlay");
  var saleFields = document.getElementById("saleFields");
  var salePriceField = document.getElementById("salePriceField");
  var saleStartDate = document.getElementById("saleStartDate");
  var saleEndDate = document.getElementById("saleEndDate");
  var saleBadge = document.getElementById("saleBadge");
  var discountPreview = document.getElementById("discountPreview");
  var saleBadgePreview = document.getElementById("saleBadgePreview");
  var mockBadge = document.getElementById("mockBadge");
  var mockRegular = document.getElementById("mockRegular");
  var mockSalePrice = document.getElementById("mockSalePrice");
  var profitCalc = document.getElementById("profitCalc");
  var scheduledDateEl = document.getElementById("scheduledDate");
  var tagInput = document.getElementById("tagInput");
  var tagsList = document.getElementById("tagsList");
  var tagsWrap = document.getElementById("tagsWrap");
  var toast = document.getElementById("apToast");
  var toastMsg = document.getElementById("apToastMsg");
  var deleteModal = document.getElementById("deleteModal");
  var unsavedModal = document.getElementById("unsavedModal");
  var deleteProductBtn = document.getElementById("deleteProductBtn");
  var cancelDelete = document.getElementById("cancelDelete");
  var confirmDelete = document.getElementById("confirmDelete");
  var deleteProductName = document.getElementById("deleteProductName");
  var stayOnPage = document.getElementById("stayOnPage");
  var leaveAnyway = document.getElementById("leaveAnyway");

  /* ============================
     State
     ============================ */
  var currentImages = [];
  var currentTags = [];
  var selectedSaleColor = "#ef4444";
  var hasUnsavedChanges = false;

  var sizeOptions = ["xs", "s", "m", "l", "xl", "xxl"];

  /* ============================
     Sidebar Toggle
     ============================ */
  menuToggle.addEventListener("click", function () {
    sidebar.classList.toggle("open");
  });

  document.addEventListener("click", function (e) {
    if (
      window.innerWidth <= 768 &&
      sidebar.classList.contains("open") &&
      !sidebar.contains(e.target) &&
      !menuToggle.contains(e.target)
    ) {
      sidebar.classList.remove("open");
    }
  });

  /* ============================
     Populate Form with Data
     ============================ */
  function populateForm() {
    document.getElementById("prodName").value = productData.name;
    document.getElementById("prodBrand").value = productData.brand;
    document.getElementById("prodCategory").value = productData.category;
    document.getElementById("prodDesc").value = productData.description;

    document.getElementById("prodPrice").value = productData.price;
    document.getElementById("prodCost").value = productData.cost;
    document.getElementById("prodTax").value = productData.tax;

    var statusRadio = document.querySelector(
      'input[name="publishStatus"][value="' + productData.status + '"]',
    );
    if (statusRadio) statusRadio.checked = true;

    document.getElementById("prodStock").value = productData.stock;
    document.getElementById("prodLowStock").value = productData.lowStock;
    var stockRadio = document.querySelector(
      'input[name="stockStatus"][value="' + productData.stockStatus + '"]',
    );
    if (stockRadio) {
      stockRadio.checked = true;
      document.querySelectorAll(".ap-stock-chip").forEach(function (c) {
        c.classList.remove("active");
      });
      stockRadio.closest(".ap-stock-chip").classList.add("active");
    }

    currentTags = productData.tags.slice();
    renderTags();

    currentImages = productData.images.slice();
    renderImagePreviews();

    renderVariants(productData.variants);

    if (productData.sale.enabled) {
      saleToggle.checked = true;
      saleOverlay.style.display = "none";
      saleFields.style.display = "block";
      salePriceField.value = productData.sale.price;
      saleStartDate.value = productData.sale.startDate;
      saleEndDate.value = productData.sale.endDate;
      saleBadge.value = productData.sale.badge;
      selectedSaleColor = productData.sale.badgeColor;

      document.querySelectorAll(".sale-color-btn").forEach(function (btn) {
        btn.classList.toggle(
          "active",
          btn.getAttribute("data-color") === selectedSaleColor,
        );
      });

      updateDiscountPreview();
      updateBadgePreview();
    }

    updateCharCount("prodDesc", "descCount", 2000);
    updateCharCount("saleBadge", "badgeCount", 20);
    updateProfitCalc();

    deleteProductName.textContent = productData.name;
  }

  /* ============================
     Image Handling
     ============================ */
  function renderImagePreviews() {
    previewGrid.innerHTML = "";
    if (currentImages.length > 0) {
      uploadPlaceholder.style.display = "none";
      previewGrid.style.display = "grid";
      currentImages.forEach(function (src, index) {
        var item = document.createElement("div");
        item.className = "ap-preview-item";
        item.innerHTML =
          '<img src="' +
          src +
          '" alt="Product image ' +
          (index + 1) +
          '" />' +
          '<button type="button" class="ap-preview-remove" data-index="' +
          index +
          '" aria-label="Remove image">' +
          '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
          "</button>";
        previewGrid.appendChild(item);
      });

      previewGrid
        .querySelectorAll(".ap-preview-remove")
        .forEach(function (btn) {
          btn.addEventListener("click", function (e) {
            e.stopPropagation();
            var idx = parseInt(this.getAttribute("data-index"));
            currentImages.splice(idx, 1);
            renderImagePreviews();
            markDirty();
          });
        });
    } else {
      uploadPlaceholder.style.display = "flex";
      previewGrid.style.display = "none";
    }
  }

  uploadArea.addEventListener("click", function (e) {
    if (e.target.closest(".ap-preview-remove")) return;
    imageInput.click();
  });

  uploadArea.addEventListener("dragover", function (e) {
    e.preventDefault();
    uploadArea.classList.add("dragover");
  });

  uploadArea.addEventListener("dragleave", function () {
    uploadArea.classList.remove("dragover");
  });

  uploadArea.addEventListener("drop", function (e) {
    e.preventDefault();
    uploadArea.classList.remove("dragover");
    handleFiles(e.dataTransfer.files);
  });

  imageInput.addEventListener("change", function () {
    handleFiles(this.files);
    this.value = "";
  });

  function handleFiles(files) {
    var remaining = 5 - currentImages.length;
    if (remaining <= 0) {
      showToast("Maximum 5 images allowed", "warn");
      return;
    }
    var toProcess = Array.from(files).slice(0, remaining);
    toProcess.forEach(function (file) {
      if (file.size > 5 * 1024 * 1024) {
        showToast(file.name + " exceeds 5MB limit", "warn");
        return;
      }
      if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
        showToast(file.name + " is not a supported format", "warn");
        return;
      }
      var reader = new FileReader();
      reader.onload = function (e) {
        currentImages.push(e.target.result);
        renderImagePreviews();
        markDirty();
      };
      reader.readAsDataURL(file);
    });
  }

  /* ============================
     Variants
     ============================ */
  function renderVariants(variants) {
    variantsList.innerHTML = "";
    variants.forEach(function (v) {
      addVariantRow(v.size, v.color, v.stock, v.price);
    });
  }

  function addVariantRow(size, color, stock, price) {
    size = size || "m";
    color = color || "";
    stock = stock !== undefined ? stock : "";
    price = price !== undefined ? price : "";

    var row = document.createElement("div");
    row.className = "ap-variant-row";

    var sizeOpts = sizeOptions
      .map(function (s) {
        return (
          '<option value="' +
          s +
          '"' +
          (s === size ? " selected" : "") +
          ">" +
          s.toUpperCase() +
          "</option>"
        );
      })
      .join("");

    row.innerHTML =
      '<div class="variant-field">' +
      "<label>Size</label>" +
      '<select class="variant-select">' +
      sizeOpts +
      "</select>" +
      "</div>" +
      '<div class="variant-field">' +
      "<label>Color</label>" +
      '<input type="text" class="variant-input" placeholder="e.g. Black" value="' +
      escapeHtml(color) +
      '" />' +
      "</div>" +
      '<div class="variant-field">' +
      "<label>Stock</label>" +
      '<input type="number" class="variant-input" placeholder="0" value="' +
      stock +
      '" min="0" />' +
      "</div>" +
      '<div class="variant-field">' +
      "<label>Price</label>" +
      '<div class="ap-input-prefix sm">' +
      "<span>$</span>" +
      '<input type="number" class="variant-input" placeholder="0.00" value="' +
      price +
      '" step="0.01" min="0" />' +
      "</div>" +
      "</div>" +
      '<button type="button" class="variant-remove" aria-label="Remove variant">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
      "</button>";

    row.querySelector(".variant-remove").addEventListener("click", function () {
      row.style.opacity = "0";
      row.style.transform = "translateY(-8px)";
      row.style.transition = "all 0.25s ease";
      setTimeout(function () {
        row.remove();
        markDirty();
      }, 250);
    });

    row.querySelectorAll("input, select").forEach(function (el) {
      el.addEventListener("change", markDirty);
      el.addEventListener("input", markDirty);
    });

    variantsList.appendChild(row);
  }

  addVariantBtn.addEventListener("click", function () {
    if (variantsList.children.length >= 10) {
      showToast("Maximum 10 variants allowed", "warn");
      return;
    }
    addVariantRow();
    markDirty();
  });

  /* ============================
     Profit Calculation
     ============================ */
  var priceInput = document.getElementById("prodPrice");
  var costInput = document.getElementById("prodCost");

  function updateProfitCalc() {
    var price = parseFloat(priceInput.value) || 0;
    var cost = parseFloat(costInput.value) || 0;
    if (cost > 0) {
      profitCalc.style.display = "flex";
      var profit = price - cost;
      var margin = price > 0 ? (profit / price) * 100 : 0;
      document.getElementById("profitValue").textContent =
        "$" + profit.toFixed(2);
      document.getElementById("marginValue").textContent =
        margin.toFixed(1) + "%";

      var profitEl = document.getElementById("profitValue");
      var marginEl = document.getElementById("marginValue");
      if (profit < 0) {
        profitEl.style.color = "#ef4444";
        marginEl.style.color = "#ef4444";
      } else {
        profitEl.style.color = "#16a34a";
        marginEl.style.color = "#16a34a";
      }
    } else {
      profitCalc.style.display = "none";
    }
  }

  priceInput.addEventListener("input", function () {
    updateProfitCalc();
    updateDiscountPreview();
    markDirty();
  });
  costInput.addEventListener("input", function () {
    updateProfitCalc();
    markDirty();
  });

  /* ============================
     Sale & Discount
     ============================ */
  saleToggle.addEventListener("change", function () {
    if (this.checked) {
      saleOverlay.style.display = "none";
      saleFields.style.display = "block";
    } else {
      saleOverlay.style.display = "block";
      saleFields.style.display = "none";
      discountPreview.style.display = "none";
      saleBadgePreview.style.display = "none";
    }
    markDirty();
  });

  salePriceField.addEventListener("input", function () {
    updateDiscountPreview();
    markDirty();
  });

  saleBadge.addEventListener("input", function () {
    updateCharCount("saleBadge", "badgeCount", 20);
    updateBadgePreview();
    markDirty();
  });

  function updateDiscountPreview() {
    var regular = parseFloat(priceInput.value) || 0;
    var sale = parseFloat(salePriceField.value) || 0;

    if (sale > 0 && sale < regular) {
      discountPreview.style.display = "flex";
      var pct = ((regular - sale) / regular) * 100;
      document.getElementById("discountPct").textContent =
        Math.round(pct) + "%";
      document.getElementById("discRegular").textContent =
        "$" + regular.toFixed(2);
      document.getElementById("discSale").textContent = "$" + sale.toFixed(2);
      document.getElementById("discSave").textContent =
        "$" + (regular - sale).toFixed(2);
      updateBadgePreview();
    } else {
      discountPreview.style.display = "none";
      saleBadgePreview.style.display = "none";
    }
  }

  function updateBadgePreview() {
    var regular = parseFloat(priceInput.value) || 0;
    var sale = parseFloat(salePriceField.value) || 0;
    var badgeText = saleBadge.value.trim() || "SALE";

    if (sale > 0 && sale < regular) {
      saleBadgePreview.style.display = "block";
      mockBadge.textContent = badgeText.toUpperCase();
      mockBadge.style.background = selectedSaleColor;
      mockRegular.textContent = "$" + regular.toFixed(2);
      mockSalePrice.textContent = "$" + sale.toFixed(2);
      mockSalePrice.style.display = "inline";
    }
  }

  document.querySelectorAll(".sale-color-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll(".sale-color-btn").forEach(function (b) {
        b.classList.remove("active");
      });
      this.classList.add("active");
      selectedSaleColor = this.getAttribute("data-color");
      updateBadgePreview();
      markDirty();
    });
  });

  /* ============================
     Publish Status
     ============================ */
  document
    .querySelectorAll('input[name="publishStatus"]')
    .forEach(function (r) {
      r.addEventListener("change", function () {
        if (this.value === "scheduled") {
          scheduledDateEl.style.display = "block";
        } else {
          scheduledDateEl.style.display = "none";
        }
        markDirty();
      });
    });

  /* ============================
     Stock Status Chips
     ============================ */
  document.querySelectorAll(".ap-stock-chip").forEach(function (chip) {
    chip.addEventListener("click", function () {
      document.querySelectorAll(".ap-stock-chip").forEach(function (c) {
        c.classList.remove("active");
      });
      this.classList.add("active");
      this.querySelector("input").checked = true;
      markDirty();
    });
  });

  /* ============================
     Tags
     ============================ */
  function renderTags() {
    tagsList.innerHTML = "";
    currentTags.forEach(function (tag) {
      var el = document.createElement("span");
      el.className = "ap-tag";
      el.innerHTML =
        escapeHtml(tag) +
        '<button type="button" class="ap-tag-remove" aria-label="Remove tag">&times;</button>';
      el.querySelector(".ap-tag-remove").addEventListener("click", function () {
        currentTags = currentTags.filter(function (t) {
          return t !== tag;
        });
        renderTags();
        markDirty();
      });
      tagsList.appendChild(el);
    });
  }

  tagInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag();
    }
    if (e.key === "Backspace" && !this.value && currentTags.length) {
      currentTags.pop();
      renderTags();
      markDirty();
    }
  });

  tagInput.addEventListener("blur", function () {
    if (this.value.trim()) addTag();
  });

  function addTag() {
    var val = tagInput.value.replace(/,/g, "").trim().toLowerCase();
    if (!val) return;
    if (currentTags.indexOf(val) !== -1) {
      showToast("Tag already exists", "warn");
      tagInput.value = "";
      return;
    }
    if (currentTags.length >= 10) {
      showToast("Maximum 10 tags allowed", "warn");
      return;
    }
    currentTags.push(val);
    tagInput.value = "";
    renderTags();
    markDirty();
  }

  document.querySelectorAll(".suggested-tag").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var tag = this.getAttribute("data-tag");
      if (currentTags.indexOf(tag) !== -1) {
        showToast("Tag already added", "warn");
        return;
      }
      if (currentTags.length >= 10) {
        showToast("Maximum 10 tags allowed", "warn");
        return;
      }
      currentTags.push(tag);
      renderTags();
      markDirty();
    });
  });

  /* ============================
     Character Counts
     ============================ */
  function updateCharCount(inputId, countId, max) {
    var len = document.getElementById(inputId).value.length;
    document.getElementById(countId).textContent = len;
  }

  document.getElementById("prodDesc").addEventListener("input", function () {
    updateCharCount("prodDesc", "descCount", 2000);
    markDirty();
  });

  /* ============================
     Track Unsaved Changes
     ============================ */
  function markDirty() {
    hasUnsavedChanges = true;
  }

  form.querySelectorAll("input, select, textarea").forEach(function (el) {
    el.addEventListener("change", markDirty);
  });

  var backLink = form.querySelector(".ap-cancel-btn");
  if (backLink) {
    backLink.addEventListener("click", function (e) {
      if (hasUnsavedChanges) {
        e.preventDefault();
        unsavedModal.classList.add("show");
      }
    });
  }

  leaveAnyway.addEventListener("click", function () {
    unsavedModal.classList.remove("show");
    window.location.href = "admin_product.html";
  });

  stayOnPage.addEventListener("click", function () {
    unsavedModal.classList.remove("show");
  });

  window.addEventListener("beforeunload", function (e) {
    if (hasUnsavedChanges) {
      e.preventDefault();
      e.returnValue = "";
    }
  });

  /* ============================
     Delete Product
     ============================ */
  deleteProductBtn.addEventListener("click", function () {
    deleteModal.classList.add("show");
  });

  cancelDelete.addEventListener("click", function () {
    deleteModal.classList.remove("show");
  });

  confirmDelete.addEventListener("click", function () {
    deleteModal.classList.remove("show");
    showToast("Product deleted successfully", "success");
    setTimeout(function () {
      window.location.href = "admin_product.html";
    }, 1500);
  });

  [deleteModal, unsavedModal].forEach(function (modal) {
    modal.addEventListener("click", function (e) {
      if (e.target === modal) {
        modal.classList.remove("show");
      }
    });
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      deleteModal.classList.remove("show");
      unsavedModal.classList.remove("show");
    }
  });

  /* ============================
     Form Submission
     ============================ */
  form.addEventListener("submit", function (e) {
    e.preventDefault();

    form.querySelectorAll(".error").forEach(function (el) {
      el.classList.remove("error");
    });

    var valid = true;

    var requiredFields = [
      { id: "prodName", msg: "Product name is required" },
      { id: "prodCategory", msg: "Please select a category" },
      { id: "prodDesc", msg: "Description is required" },
      { id: "prodPrice", msg: "Regular price is required" },
      { id: "prodStock", msg: "Stock quantity is required" },
    ];

    requiredFields.forEach(function (f) {
      var el = document.getElementById(f.id);
      if (!el.value.trim()) {
        el.closest(".ap-field").classList.add("error");
        if (!el.closest(".ap-field").querySelector(".error-msg")) {
          var msg = document.createElement("span");
          msg.className = "error-msg";
          msg.textContent = f.msg;
          el.closest(".ap-field").appendChild(msg);
        }
        valid = false;
      }
    });

    if (saleToggle.checked && salePriceField.value) {
      var regPrice = parseFloat(priceInput.value) || 0;
      var salePrice = parseFloat(salePriceField.value) || 0;
      if (salePrice >= regPrice) {
        salePriceField.closest(".ap-field").classList.add("error");
        if (!salePriceField.closest(".ap-field").querySelector(".error-msg")) {
          var msg = document.createElement("span");
          msg.className = "error-msg";
          msg.textContent = "Sale price must be lower than regular price";
          salePriceField.closest(".ap-field").appendChild(msg);
        }
        valid = false;
      }
    }

    if (!valid) {
      var firstError = form.querySelector(".error");
      if (firstError) {
        firstError.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      showToast("Please fix the errors above", "warn");
      return;
    }

    var formData = {
      name: document.getElementById("prodName").value,
      brand: document.getElementById("prodBrand").value,
      category: document.getElementById("prodCategory").value,
      description: document.getElementById("prodDesc").value,
      price: parseFloat(document.getElementById("prodPrice").value),
      cost: parseFloat(document.getElementById("prodCost").value) || 0,
      tax: document.getElementById("prodTax").value,
      status: document.querySelector('input[name="publishStatus"]:checked')
        .value,
      stock: parseInt(document.getElementById("prodStock").value),
      lowStock: parseInt(document.getElementById("prodLowStock").value) || 0,
      stockStatus: document.querySelector('input[name="stockStatus"]:checked')
        .value,
      tags: currentTags,
      sale: {
        enabled: saleToggle.checked,
        price: parseFloat(salePriceField.value) || 0,
        startDate: saleStartDate.value,
        endDate: saleEndDate.value,
        badge: saleBadge.value,
        badgeColor: selectedSaleColor,
      },
      images: currentImages,
    };

    formData.variants = [];
    variantsList.querySelectorAll(".ap-variant-row").forEach(function (row) {
      var selects = row.querySelectorAll(".variant-select");
      var inputs = row.querySelectorAll(".variant-input");
      formData.variants.push({
        size: selects[0] ? selects[0].value : "",
        color: inputs[0] ? inputs[0].value : "",
        stock: inputs[1] ? parseInt(inputs[1].value) || 0 : 0,
        price: inputs[2] ? parseFloat(inputs[2].value) || 0 : 0,
      });
    });

    console.log("Updated product data:", formData);

    var now = new Date();
    var options = {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    };
    document.getElementById("lastModified").textContent =
      now.toLocaleDateString("en-US", options);

    hasUnsavedChanges = false;
    showToast("Product updated successfully!", "success");
  });

  document
    .getElementById("saveDraftBtn")
    .addEventListener("click", function () {
      var draftRadio = document.querySelector(
        'input[name="publishStatus"][value="draft"]',
      );
      if (draftRadio) draftRadio.checked = true;
      scheduledDateEl.style.display = "none";

      hasUnsavedChanges = false;
      showToast("Draft saved successfully!", "success");
    });

  /* ============================
     Toast Notification
     ============================ */
  var toastTimer = null;

  function showToast(message, type) {
    clearTimeout(toastTimer);
    toastMsg.textContent = message;

    var icon = toast.querySelector("svg");
    if (type === "warn") {
      icon.style.color = "#f59e0b";
      icon.innerHTML =
        '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>';
    } else {
      icon.style.color = "#22c55e";
      icon.innerHTML = '<path d="M20 6L9 17l-5-5"/>';
    }

    toast.classList.add("show");
    toastTimer = setTimeout(function () {
      toast.classList.remove("show");
    }, 3000);
  }

  /* ============================
     Utility
     ============================ */
  function escapeHtml(str) {
    var div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  /* ============================
     Initialize
     ============================ */
  populateForm();
})();
