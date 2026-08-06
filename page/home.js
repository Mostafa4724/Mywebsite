const productsContainer = document.getElementById("product-container");

async function loadProducts() {

    try {

        const response = await fetch(
            "http://127.0.0.1:5000/products"
        );

        const data = await response.json();

        if (!data.success) {

            return;

        }

        productsContainer.innerHTML = "";

        data.products.forEach(product => {

            const image =
            product.image && product.image !== ""
                ? "http://127.0.0.1:5000/uploads/products/" + product.image
                : "https://picsum.photos/300/250?random=" + product.id;

            const originalPrice = Number(product.price || 0);
            const salePrice = Number(product.sale_price || 0);
            const saleActive = isSaleActive(product);
            const displayPrice = saleActive && salePrice > 0
                ? salePrice
                : originalPrice;
            const discountPercent = saleActive && originalPrice > 0
                ? Math.round(((originalPrice - displayPrice) / originalPrice) * 100)
                : 0;

            const card = document.createElement("div");

            card.className = "product-card";

            card.dataset.name = product.title;
            card.dataset.price = displayPrice;
            card.dataset.image = image;

            card.innerHTML = `
                <a href="product.html?id=${product.id}" class="product-card-link">

                    <img src="${image}" alt="${product.title}">

                    <h3>${product.title}</h3>

                    <div class="price-row">
                        <p class="price">$${Number(displayPrice).toFixed(2)}</p>
                        ${saleActive && product.sale_price ? `<p class="original-price">$${originalPrice.toFixed(2)}</p>` : ""}
                    </div>

                    ${saleActive && product.sale_price ? `
                        <div class="sale-info">
                            <span class="sale-chip" style="background:${product.sale_badge_color || "#f97316"};">${product.sale_badge || "Sale"}</span>
                            <span class="sale-discount">Save ${discountPercent}%</span>
                        </div>
                    ` : ""}

                </a>

                <button
                    class="add-to-cart-btn"
                    data-id="${product.id}"
                    data-name="${product.title}"
                    data-price="${displayPrice}"
                    data-image="${image}"
                >
                    Add To Cart
                </button>
            `;

            productsContainer.appendChild(card);

            const button = card.querySelector(".add-to-cart-btn");

            button.addEventListener("click", () => {

                addToCart(
                    product.title,
                    displayPrice,
                    image
                );

            });

        });
    }

    catch(err){

        console.log(err);

    }

}

function isSaleActive(product) {

    const salePrice = Number(product.sale_price ?? 0);
    const regularPrice = Number(product.price ?? 0);
    const hasValidSalePrice = salePrice > 0 && regularPrice > salePrice;

    if (!hasValidSalePrice) {

        return false;

    }

    const now = new Date();

    if (product.sale_start) {

        const start = new Date(product.sale_start);

        if (!Number.isNaN(start.getTime()) && now < start) {

            return false;

        }

    }

    if (product.sale_end) {

        const end = new Date(product.sale_end);

        if (!Number.isNaN(end.getTime()) && now > end) {

            return false;

        }

    }

    return true;

}

loadProducts();