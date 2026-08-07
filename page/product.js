const params = new URLSearchParams(window.location.search);

const id = params.get("id");

const productId =
    new URLSearchParams(window.location.search).get("id");

// Buy Now quantity state (defaults to 1)
let buyNowQuantity = 1;

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

async function loadProduct() {

    const response = await fetch(

        "http://127.0.0.1:5000/products/" + productId

    );

    const data = await response.json();

    if (!data.success) {

        alert("Product not found");

        return;

    }

    const product = data.product;

    const image =
        product.image && product.image !== ""
            ? "http://127.0.0.1:5000/uploads/products/" + product.image
            : "https://picsum.photos/500/400?random=" + product.id;

    document.getElementById("product-name").textContent =
        product.title;

    const originalPrice = Number(product.price ?? 0);
    const saleActive = isSaleActive(product);
    const price = saleActive && product.sale_price
        ? Number(product.sale_price)
        : originalPrice;

    document.getElementById("product-price").textContent =
        "$" + price.toFixed(2);

    const originalPriceEl = document.getElementById("product-original-price");
    if (product.sale_enabled && product.sale_price && originalPrice > price) {
        originalPriceEl.textContent = "$" + originalPrice.toFixed(2);
        originalPriceEl.style.display = "block";
    } else {
        originalPriceEl.textContent = "";
        originalPriceEl.style.display = "none";
    }

    document.getElementById("product-brand").textContent =
        product.brand || "Unbranded";

    document.getElementById("product-category").textContent =
        product.category || "Uncategorized";

    document.getElementById("product-description").textContent =
        product.description;

    document.getElementById("product-image").src =
        image;
    
    document
    .getElementById("addToCartBtn")
    .addEventListener("click", () => {

        addToCart(

            product.title,

            price,

            image,

            product.id

        );

    });

    const badge = document.getElementById("availability-badge");

    const text = document.getElementById("availability-text");

    const stockStatus = product.stock_status || "in";

    const saleCard = document.getElementById("product-sale-card");
    const saleBadge = document.getElementById("sale-badge");
    const salePriceText = document.getElementById("sale-price-text");
    const saleDiscountText = document.getElementById("sale-discount-text");

    if (saleActive && product.sale_price) {

        saleCard.style.display = "inline-flex";

        saleBadge.textContent = product.sale_badge || "Sale";
        saleBadge.style.background = product.sale_badge_color || "#f97316";

        const discount = originalPrice > 0
            ? Math.round(((originalPrice - price) / originalPrice) * 100)
            : 0;

        salePriceText.textContent = `Now $${price.toFixed(2)}`;
        saleDiscountText.textContent = `${discount}% off`;

    } else {

        saleCard.style.display = "none";

    }

    if (stockStatus === "low") {

        badge.className = "availability-badge low-stock";

        text.textContent = "Low Stock";

    } else if (stockStatus === "out") {

        badge.className = "availability-badge out-of-stock";

        text.textContent = "Out of Stock";

    } else {

        badge.className = "availability-badge in-stock";

        text.textContent = "In Stock";

    }

}



// ==========================
// Buy Now Quantity Selector
// ==========================
(function setupBuyNowQty() {
  const valueEl = document.getElementById("buyNowQtyValue");
  const minusBtn = document.getElementById("buyNowQtyMinus");
  const plusBtn = document.getElementById("buyNowQtyPlus");
  if (!valueEl || !minusBtn || !plusBtn) return;

  function render() {
    valueEl.textContent = buyNowQuantity;
  }

  minusBtn.addEventListener("click", () => {
    buyNowQuantity = Math.max(1, buyNowQuantity - 1);
    render();
  });

  plusBtn.addEventListener("click", () => {
    buyNowQuantity = buyNowQuantity + 1;
    render();
  });

  render();
})();

let selectedRating = 0;

// ==========================
// Rating Stars
// ==========================

document.querySelectorAll(".star-btn").forEach(star => {

    star.addEventListener("click", () => {

        selectedRating = Number(star.dataset.value);

        document.querySelectorAll(".star-btn").forEach(btn => {

            if (Number(btn.dataset.value) <= selectedRating) {

                btn.classList.add("active");

            } else {

                btn.classList.remove("active");

            }

        });

    });

});

document
.getElementById("submitReviewBtn")
.addEventListener("click", submitReview);

async function submitReview() {

    if (selectedRating === 0) {

        alert("Please select a rating.");

        return;

    }

    const comment = document
        .getElementById("reviewComment")
        .value
        .trim();

    if (comment === "") {

        alert("Write a review.");

        return;

    }

    const response = await fetch(

        `http://127.0.0.1:5000/products/${productId}/reviews`,

        {

            method: "POST",

            headers: {

                "Content-Type": "application/json"

            },

            body: JSON.stringify({

                username: "Anonymous",

                rating: selectedRating,

                comment: comment

            })

        }

    );

    const data = await response.json();

    if (data.success) {

        document.getElementById("reviewComment").value = "";

        selectedRating = 0;

        document.querySelectorAll(".star-btn").forEach(btn => {

            btn.classList.remove("active");

        });

        loadReviews();

    }

}

async function loadReviews() {

    const response = await fetch(

        `http://127.0.0.1:5000/products/${productId}/reviews`

    );

    const data = await response.json();

    const list = document.querySelector(".reviews-list");

    list.innerHTML = "";

    let total = 0;

    data.reviews.forEach(review => {

        total += review.rating;

        const starsMarkup = Array.from({ length: 5 }, (_, index) => {
            const filled = index < review.rating;
            return `<span class="star ${filled ? "filled" : "empty"}">${filled ? "★" : "☆"}</span>`;
        }).join("");

        list.innerHTML += `

        <div class="review-card">

            <div class="review-header">
                <h4 class="reviewer-name">${review.username}</h4>
                <span class="review-date">${review.created_at}</span>
            </div>

            <div class="review-stars">${starsMarkup}</div>
            <p class="review-text">${review.comment}</p>

        </div>

        `;

    });

    const average = data.reviews.length
        ? total / data.reviews.length
        : 0;

    document.querySelector(".average-text").textContent =
        average.toFixed(1);

    document.querySelector(".review-count").textContent =
        `(${data.reviews.length} reviews)`;

    drawAverageStars(average);

}

function drawAverageStars(avg) {

    const container =
        document.querySelector(".stars-display");

    if (!container) return;

    container.innerHTML = "";

    for (let i = 1; i <= 5; i++) {

        const star = document.createElement("span");
        star.className = `star ${i <= Math.round(avg) ? "filled" : "empty"}`;
        star.textContent = i <= Math.round(avg) ? "★" : "☆";
        container.appendChild(star);

    }

}

loadProduct();
loadReviews();
