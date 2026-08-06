const form = document.getElementById("addProductForm");

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
    formData.append("category", document.getElementById("prodCategory").value);

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
                headers: {
                    Authorization:
                        "Bearer " + localStorage.getItem("token")
                },
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