const form = document.getElementById("addProductForm");

const API_BASE = "http://127.0.0.1:5000";

// =============================================
// Dynamic Category Dropdown
// =============================================
const categorySelect = document.getElementById("prodCategory");
const ADD_CATEGORY_VALUE = "__add_category__";

// Modal elements
const addCategoryModal = document.getElementById("addCategoryModal");
const addCategoryClose = document.getElementById("addCategoryClose");
const cancelCategoryBtn = document.getElementById("cancelCategoryBtn");
const saveCategoryBtn = document.getElementById("saveCategoryBtn");
const newCategoryName = document.getElementById("newCategoryName");
const newCategoryError = document.getElementById("newCategoryError");

function getAuthHeaders(json) {
    const headers = {
        Authorization: "Bearer " + sessionStorage.getItem("token")
    };
    if (json) {
        headers["Content-Type"] = "application/json";
    }
    return headers;
}

// Load categories from the backend and populate the dropdown
async function loadCategories(selectId) {
    try {
        const response = await fetch(API_BASE + "/categories");
        const data = await response.json();

        if (!data.success) return;

        const select = selectId instanceof HTMLElement
            ? selectId
            : categorySelect;

        if (!select) return;

        // Preserve the currently selected category id
        const currentValue = select.value;

        // Clear the existing options (keep the placeholder)
        select.innerHTML = "";

        select.innerHTML +=
            '<option value="" disabled selected>Select category</option>';

        data.categories.forEach((cat) => {
            const opt = document.createElement("option");
            opt.value = String(cat.id);
            opt.dataset.name = cat.name;
            opt.textContent = cat.name;
            select.appendChild(opt);
        });

        // Divider-like "+ Add Category" option
        const addOpt = document.createElement("option");
        addOpt.value = ADD_CATEGORY_VALUE;
        addOpt.textContent = "+ Add Category";
        select.appendChild(addOpt);

        // Re-select previously selected category if still present
        if (currentValue && currentValue !== ADD_CATEGORY_VALUE) {
            const exists = Array.from(select.options).some(
                (o) => o.value === currentValue
            );
            if (exists) {
                select.value = currentValue;
            }
        }
    } catch (err) {
        console.error("Failed to load categories:", err);
    }
}

// Handle the "+ Add Category" option selection
function openAddCategoryModal() {
    if (!addCategoryModal || !newCategoryName || !newCategoryError) return;

    newCategoryName.value = "";
    newCategoryError.textContent = "";

    if (addCategoryModal.hasAttribute("hidden")) {
        addCategoryModal.removeAttribute("hidden");
    } else {
        addCategoryModal.classList.add("show");
        addCategoryModal.style.display = "flex";
    }

    setTimeout(() => newCategoryName.focus(), 50);
}

function closeAddCategoryModal() {
    if (!addCategoryModal) return;
    if (addCategoryModal.hasAttribute("hidden")) {
        addCategoryModal.setAttribute("hidden", "");
    }
    addCategoryModal.classList.remove("show");
    addCategoryModal.style.display = "none";
}

// Create a category in the backend
async function createCategory() {
    if (!newCategoryName || !newCategoryError) return;

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
            body: JSON.stringify({ name: name })
        });

        const data = await response.json();

        if (!data.success) {
            newCategoryError.textContent =
                data.message || "Could not create category.";
            saveCategoryBtn.disabled = false;
            saveCategoryBtn.textContent = "Add Category";
            return;
        }

        // Reload the dropdown and select the newly created category
        await loadCategories();

        if (categorySelect) {
            categorySelect.value = String(data.category.id);
        }

        closeAddCategoryModal();

        showToast('Category "' + data.category.name + '" created!');

    } catch (err) {
        console.error("Failed to create category:", err);
        newCategoryError.textContent =
            "Failed to connect. Please try again.";
    } finally {
        saveCategoryBtn.disabled = false;
        saveCategoryBtn.textContent = "Add Category";
    }
}

// Wire up the category select and modal
if (categorySelect) {
    categorySelect.addEventListener("change", function () {
        if (this.value === ADD_CATEGORY_VALUE) {
            openAddCategoryModal();
            // Reset so the dropdown doesn't stay on the add-option value
            this.value = "";
        }
    });
}

if (addCategoryClose) {
    addCategoryClose.addEventListener("click", closeAddCategoryModal);
}
if (cancelCategoryBtn) {
    cancelCategoryBtn.addEventListener("click", closeAddCategoryModal);
}
if (saveCategoryBtn) {
    saveCategoryBtn.addEventListener("click", createCategory);
}

if (addCategoryModal) {
    addCategoryModal.addEventListener("click", function (e) {
        if (e.target === addCategoryModal) closeAddCategoryModal();
    });
}

// Allow Enter key in the category name field to submit
if (newCategoryName) {
    newCategoryName.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
            e.preventDefault();
            createCategory();
        }
    });
}

// Initial load
loadCategories();

function getDerivedStockStatus(stockValue, lowStockValue) {

    const stock = Number(stockValue) || 0;
    const lowStock = Number(lowStockValue) || 0;

    if (stock <= 0) {

        return "out";

    }

    if (stock <= lowStock) {

        return "low";

    }

    return "in";

}

function updateStockStatusUi() {

    const stockInput = document.getElementById("prodStock");
    const lowStockInput = document.getElementById("prodLowStock");
    const selectedStatus = getDerivedStockStatus(
        stockInput?.value,
        lowStockInput?.value
    );

    document.querySelectorAll('input[name="stockStatus"]').forEach(input => {

        const chip = input.closest("label.ap-stock-chip");

        if (chip) {

            chip.classList.toggle("active", input.value === selectedStatus);

        }

    });

    const activeInput = document.querySelector(
        `input[name="stockStatus"][value="${selectedStatus}"]`
    );

    if (activeInput) {

        activeInput.checked = true;

    }

}

if (document.getElementById("prodStock") && document.getElementById("prodLowStock")) {

    document.getElementById("prodStock").addEventListener("input", updateStockStatusUi);
    document.getElementById("prodLowStock").addEventListener("input", updateStockStatusUi);

}

updateStockStatusUi();

console.log("Form:", form);

form.addEventListener("submit", async (e) => {

    console.log("Submit fired");

    e.preventDefault();

    const formData = new FormData();

    // ==========================
    // Basic Information
    // ==========================
    formData.append("title", document.getElementById("prodName").value);
    formData.append("description", document.getElementById("prodDesc").value);
    formData.append("brand", document.getElementById("prodBrand").value);

    // Category: submit the selected category id + name
    const selectedOption = categorySelect.selectedOptions[0];
    const selectedCategoryId = categorySelect.value;
    const selectedCategoryName = selectedOption ? selectedOption.dataset.name : null;

    formData.append(
        "category_id",
        selectedCategoryId && selectedCategoryId !== ADD_CATEGORY_VALUE
            ? selectedCategoryId
            : ""
    );
    formData.append("category", selectedCategoryName || "");

    // ==========================
    // Pricing
    // ==========================
    formData.append("price", document.getElementById("prodPrice").value);
    formData.append("cost", document.getElementById("prodCost").value);

    const salePrice = document.getElementById("salePriceField");
    if (salePrice) {
        formData.append("sale_price", salePrice.value);
    }

    // ==========================
    // Inventory
    // ==========================
    formData.append("stock", document.getElementById("prodStock").value);
    formData.append("low_stock", document.getElementById("prodLowStock").value);

    const stockStatus = document.querySelector(
        'input[name="stockStatus"]:checked'
    );

    const selectedStockStatus = stockStatus?.value || getDerivedStockStatus(
        document.getElementById("prodStock").value,
        document.getElementById("prodLowStock").value
    );

    formData.append("stock_status", selectedStockStatus);

    // ==========================
    // Tax
    // ==========================
    formData.append(
        "tax_class",
        document.getElementById("prodTax").value
    );

    // ==========================
    // Publish Status
    // ==========================
    const publishStatus = document.querySelector(
        'input[name="publishStatus"]:checked'
    );

    if (publishStatus) {
        formData.append("status", publishStatus.value);
    }

    // ==========================
    // Sale
    // ==========================
    formData.append(
        "sale_enabled",
        document.getElementById("saleToggle").checked
    );

    const badge = document.getElementById("saleBadge");

    if (badge) {
        formData.append("sale_badge", badge.value);
    }

    const saleStart = document.getElementById("saleStartDate")?.value;
    if (saleStart) {
        formData.append("sale_start", saleStart);
    }

    const saleEnd = document.getElementById("saleEndDate")?.value;
    if (saleEnd) {
        formData.append("sale_end", saleEnd);
    }

    const activeColor = document.querySelector(
        ".sale-color-btn.active"
    );

    if (activeColor) {
        formData.append(
            "sale_badge_color",
            activeColor.dataset.color
        );
    }

    // ==========================
    // Tags
    // ==========================
    const tags = [];

    document.querySelectorAll("#tagsList .tag").forEach(tag => {
        tags.push(tag.textContent.replace("×", "").trim());
    });

    formData.append("tags", tags.join(","));

    if (window.uploadedImages.length > 0) {

        formData.append(
            "image",
            window.uploadedImages[0].file
        );

    }

    console.log("Sending request...");

    try {

        const response = await fetch(
            "http://127.0.0.1:5000/admin/products",
            {
                method: "POST",
                headers: getAuthHeaders(false),
                body: formData
            }
        );

        console.log("Response:", response.status);

        const data = await response.json();

        console.log(data);

    } catch (err) {

        console.error("Fetch error:", err);

    }

});

// =============================================
// Toast helper (reuse the admin toast)
// =============================================
function showToast(msg) {
    const toast = document.getElementById("apToast");
    const toastMsg = document.getElementById("apToastMsg");
    if (!toast || !toastMsg) return;
    toastMsg.textContent = msg;
    toast.classList.add("visible");
    setTimeout(() => toast.classList.remove("visible"), 3000);
}

