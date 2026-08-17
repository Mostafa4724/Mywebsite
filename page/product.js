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

    const productStatus = String(product.status || "draft").toLowerCase();
    if (productStatus === "draft") {
        alert("Product not found");
        return;
    }


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
  //alert("products")
  // ===== Character Counts =====
  /*
  const prodDesc = document.getElementById('prodDesc');
  const descCount = document.getElementById('descCount');
  const seoTitle = document.getElementById('seoTitle');
  const seoTitleCount = document.getElementById('seoTitleCount');
  const seoDesc = document.getElementById('seoDesc');
  const seoDescCount = document.getElementById('seoDescCount');

  function updateCount(input, counter, max) {
    if (!input || !counter) return;
    const len = input.value.length;
    counter.textContent = len;
    counter.parentElement.className = 'ap-field-bottom';
    if (len > max * 0.9) counter.parentElement.classList.add('warning');
    if (len > max) counter.parentElement.classList.add('over');
  }

  if (prodDesc) prodDesc.addEventListener('input', () => updateCount(prodDesc, descCount, 2000));
  if (seoTitle) seoTitle.addEventListener('input', () => updateCount(seoTitle, seoTitleCount, 60));
  if (seoDesc) seoDesc.addEventListener('input', () => updateCount(seoDesc, seoDescCount, 160));

  // ===== Auto-generate slug from name =====
  const prodName = document.getElementById('prodName');
  const seoSlug = document.getElementById('seoSlug');

  if (prodName && seoSlug) {
    prodName.addEventListener('input', () => {
      if (seoSlug.dataset.manual === 'true') return;
      seoSlug.value = prodName.value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
    });
    seoSlug.addEventListener('input', () => {
      seoSlug.dataset.manual = 'true';
    });
  }

  // ===== Profit Calculator =====
  const prodPrice = document.getElementById('prodPrice');
  const prodCost = document.getElementById('prodCost');
  const profitCalc = document.getElementById('profitCalc');
  const profitValue = document.getElementById('profitValue');
  const marginValue = document.getElementById('marginValue');

  function calcProfit() {
    if (!profitCalc) return;
    const price = parseFloat(prodPrice.value) || 0;
    const cost = parseFloat(prodCost.value) || 0;

    if (price > 0 && cost > 0) {
      profitCalc.style.display = '';
      const profit = price - cost;
      profitValue.textContent = '$' + profit.toFixed(2);
      const margin = ((profit / price) * 100).toFixed(1);
      marginValue.textContent = margin + '%';
      profitValue.style.color = profit >= 0 ? '#16a34a' : '#ef4444';
      marginValue.style.color = profit >= 0 ? '#16a34a' : '#ef4444';
    } else {
      profitCalc.style.display = 'none';
    }
  }

  if (prodPrice) prodPrice.addEventListener('input', () => { calcProfit(); updateDiscountPreview(); });
  if (prodCost) prodCost.addEventListener('input', calcProfit);

  // ===== Stock Status Chips =====
  document.querySelectorAll('.ap-stock-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.ap-stock-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      chip.querySelector('input').checked = true;
    });
  });

  // ===== Tags =====
  const tagInput = document.getElementById('tagInput');
  const tagsList = document.getElementById('tagsList');
  const tagsWrap = document.getElementById('tagsWrap');
  let tags = [];

  if (tagInput && tagsList) {
    tagsWrap.addEventListener('click', () => tagInput.focus());

    tagInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        addTag(tagInput.value.replace(',', '').trim());
        tagInput.value = '';
      }
      if (e.key === 'Backspace' && tagInput.value === '' && tags.length > 0) {
        removeTag(tags.length - 1);
      }
    });
  }

  function addTag(text) {
    if (!text || tags.includes(text.toLowerCase())) return;
    tags.push(text.toLowerCase());
    renderTags();
  }

  function removeTag(index) {
    tags.splice(index, 1);
    renderTags();
  }

  function renderTags() {
    if (!tagsList) return;
    tagsList.innerHTML = '';
    tags.forEach((tag, i) => {
      const el = document.createElement('span');
      el.className = 'ap-tag';
      el.innerHTML = tag + ' <button type="button" data-idx="' + i + '">&times;</button>';
      el.querySelector('button').addEventListener('click', () => removeTag(i));
      tagsList.appendChild(el);
    });
  }

  document.querySelectorAll('.suggested-tag').forEach(btn => {
    btn.addEventListener('click', () => {
      addTag(btn.dataset.tag);
      btn.style.display = 'none';
    });
  });

  // ===== Variants =====
  const addVariantBtn = document.getElementById('addVariantBtn');
  const variantsList = document.getElementById('variantsList');

  function bindVariantRemove() {
    variantsList.querySelectorAll('.variant-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        if (variantsList.children.length > 1) {
          const row = btn.closest('.ap-variant-row');
          row.style.opacity = '0';
          row.style.transform = 'translateY(-8px)';
          row.style.transition = 'all 0.2s';
          setTimeout(() => row.remove(), 200);
        }
      });
    });
  }

  if (addVariantBtn && variantsList) {
    addVariantBtn.addEventListener('click', () => {
      const row = document.createElement('div');
      row.className = 'ap-variant-row';
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

  // ===== Sale & Discount =====
  const saleToggle = document.getElementById('saleToggle');
  const saleFields = document.getElementById('saleFields');
  const saleOverlay = document.getElementById('saleOverlay');
  const salePriceField = document.getElementById('salePriceField');
  const discountPreview = document.getElementById('discountPreview');
  const discountPct = document.getElementById('discountPct');
  const discRegular = document.getElementById('discRegular');
  const discSale = document.getElementById('discSale');
  const discSave = document.getElementById('discSave');
  const saleBadge = document.getElementById('saleBadge');
  const badgeCount = document.getElementById('badgeCount');
  const saleBadgePreview = document.getElementById('saleBadgePreview');
  const mockBadge = document.getElementById('mockBadge');
  const mockRegular = document.getElementById('mockRegular');
  const mockSalePrice = document.getElementById('mockSalePrice');
  const saleColorOptions = document.getElementById('saleColorOptions');
  let selectedSaleColor = '#ef4444';

  if (saleToggle) {
    saleToggle.addEventListener('change', () => {
      const on = saleToggle.checked;
      saleFields.style.display = on ? '' : 'none';
      saleOverlay.style.display = on ? 'none' : '';
      if (on) {
        updateDiscountPreview();
        updateBadgePreview();
        const startDate = document.getElementById('saleStartDate');
        if (startDate && !startDate.value) {
          const now = new Date();
          now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
          startDate.value = now.toISOString().slice(0, 16);
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
      const save = regular - sale;

      discountPct.textContent = pct + '%';
      discRegular.textContent = '$' + regular.toFixed(2);
      discSale.textContent = '$' + sale.toFixed(2);
      discSave.textContent = '$' + save.toFixed(2);

      const circle = discountPreview.querySelector('.discount-circle');
      if (pct >= 50) {
        circle.style.background = '#dc2626';
        circle.style.boxShadow = '0 4px 14px rgba(220, 38, 38, 0.3)';
      } else if (pct >= 25) {
        circle.style.background = '#ef4444';
        circle.style.boxShadow = '0 4px 14px rgba(239, 68, 68, 0.3)';
      } else {
        circle.style.background = '#f97316';
        circle.style.boxShadow = '0 4px 14px rgba(249, 115, 22, 0.3)';
      }

      discountPreview.style.display = '';
    } else {
      discountPreview.style.display = 'none';
    }

    if (mockRegular && mockSalePrice) {
      mockRegular.textContent = '$' + regular.toFixed(2);
      if (sale > 0 && sale < regular) {
        mockSalePrice.textContent = '$' + sale.toFixed(2);
        mockSalePrice.style.display = '';
        mockRegular.classList.add('struck');
      } else {
        mockSalePrice.style.display = 'none';
        mockRegular.classList.remove('struck');
      }
    }
  }

  if (salePriceField) {
    salePriceField.addEventListener('input', () => {
      salePriceField.classList.remove('error');
      updateDiscountPreview();
    });
  }

  if (saleBadge && badgeCount) {
    saleBadge.addEventListener('input', () => {
      badgeCount.textContent = saleBadge.value.length;
      updateBadgePreview();
    });
  }

  if (saleColorOptions) {
    saleColorOptions.querySelectorAll('.sale-color-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        saleColorOptions.querySelectorAll('.sale-color-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedSaleColor = btn.dataset.color;
        updateBadgePreview();
      });
    });
  }

  function updateBadgePreview() {
    if (!saleBadgePreview || !mockBadge) return;
    const text = saleBadge ? saleBadge.value.trim().toUpperCase() : '';
    const sale = salePriceField ? parseFloat(salePriceField.value) || 0 : 0;
    if (text || sale > 0) {
      saleBadgePreview.style.display = '';
      mockBadge.textContent = text || 'SALE';
      mockBadge.style.background = selectedSaleColor;
    } else {
      saleBadgePreview.style.display = 'none';
    }
    updateDiscountPreview();
  }

  const saleEndDate = document.getElementById('saleEndDate');
  if (saleEndDate) {
    saleEndDate.addEventListener('input', () => {
      saleEndDate.classList.remove('error');
    });
  }

  // ===== Form Submission =====
  const addProductForm = document.getElementById('addProductForm');
  const saveDraftBtn = document.getElementById('saveDraftBtn');

  function validateForm() {
    let valid = true;
    const required = [
      { id: 'prodName', label: 'Product name' },
      { id: 'prodCategory', label: 'Category' },
      { id: 'prodPrice', label: 'Regular price' },
      { id: 'prodStock', label: 'Stock quantity' },
      { id: 'prodDesc', label: 'Description' }
    ];

    document.querySelectorAll('.ap-field input.error, .ap-field select.error, .ap-field textarea.error').forEach(el => {
      el.classList.remove('error');
    });

    for (let i = 0; i < required.length; i++) {
      const el = document.getElementById(required[i].id);
      if (el && !el.value.trim()) {
        el.classList.add('error');
        el.focus();
        valid = false;
        break;
      }
    }

    const price = document.getElementById('prodPrice');
    if (price && parseFloat(price.value) <= 0) {
      price.classList.add('error');
      price.focus();
      valid = false;
    }

    if (!valid) {
      const firstError = document.querySelector('.ap-field input.error, .ap-field select.error, .ap-field textarea.error');
      if (firstError) {
        firstError.closest('.ap-card').scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    return valid;
  }

  function validateSale() {
    if (saleToggle && saleToggle.checked) {
      const regular = parseFloat(prodPrice ? prodPrice.value : 0) || 0;
      const sale = parseFloat(salePriceField ? salePriceField.value : 0) || 0;

      if (sale <= 0) {
        salePriceField.classList.add('error');
        salePriceField.focus();
        salePriceField.closest('.ap-field').scrollIntoView({ behavior: 'smooth', block: 'center' });
        return false;
      }

      if (sale >= regular) {
        salePriceField.classList.add('error');
        salePriceField.focus();
        salePriceField.closest('.ap-field').scrollIntoView({ behavior: 'smooth', block: 'center' });
        showToast('Sale price must be lower than the regular price.');
        return false;
      }

      const startEl = document.getElementById('saleStartDate');
      const endEl = document.getElementById('saleEndDate');
      if (startEl && endEl && startEl.value && endEl.value) {
        if (new Date(endEl.value) <= new Date(startEl.value)) {
          endEl.classList.add('error');
          endEl.focus();
          endEl.closest('.ap-field').scrollIntoView({ behavior: 'smooth', block: 'center' });
          showToast('Sale end date must be after the start date.');
          return false;
        }
      }
    }
    return true;
  }
*/    
loadProduct();
loadReviews();
