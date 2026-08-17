const params = new URLSearchParams(window.location.search);
const productId = params.get("id");
const API = "http://127.0.0.1:5000";

let loadedProduct = null;
let selectedVariant = null;
let selectedSize = null;
let galleryImages = [];
let galleryIndex = 0;

function imageUrl(name) {
  if (!name) return "https://picsum.photos/500/400?random=" + productId;
  if (/^https?:\/\//i.test(String(name))) return String(name);
  return `${API}/uploads/products/${encodeURIComponent(name)}`;
}

function renderGallery() {
  const image = document.getElementById("product-image");
  const dots = document.getElementById("product-image-dots");
  const prev = document.getElementById("product-image-prev");
  const next = document.getElementById("product-image-next");
  if (!image || !galleryImages.length) return;

  galleryIndex = (galleryIndex + galleryImages.length) % galleryImages.length;
  image.src = imageUrl(galleryImages[galleryIndex]);
  image.alt = loadedProduct?.title || "Product";

  if (dots) {
    dots.innerHTML = "";
    galleryImages.forEach((_, index) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "product-gallery-dot" + (index === galleryIndex ? " active" : "");
      dot.setAttribute("aria-label", "Show image " + (index + 1));
      dot.addEventListener("click", () => {
        galleryIndex = index;
        renderGallery();
      });
      dots.appendChild(dot);
    });
  }
  const multi = galleryImages.length > 1;
  if (prev) prev.hidden = !multi;
  if (next) next.hidden = !multi;
  if (dots) dots.hidden = !multi;
}

function selectedPrice() {
  if (selectedVariant && selectedSize) {
    const size = selectedVariant.sizes?.find(
      s => String(s.id) === String(selectedSize) ||
           String(s.size).toLowerCase() === String(selectedSize).toLowerCase()
    );
    if (size) return Number(size.price) || 0;
  }
  return loadedProduct?.sale_active
    ? Number(loadedProduct.sale_price || loadedProduct.price || 0)
    : Number(loadedProduct?.price || 0);
}

function renderPrice() {
  const price = selectedPrice();
  const priceEl = document.getElementById("product-price");
  const originalEl = document.getElementById("product-original-price");
  if (priceEl) priceEl.textContent = "$" + price.toFixed(2);

  const regular = selectedVariant && selectedSize
    ? Number(selectedPrice())
    : Number(loadedProduct?.price || 0);
  const saleActive = !selectedVariant && loadedProduct?.sale_active;
  if (originalEl) {
    if (saleActive && Number(loadedProduct.sale_price) < regular) {
      originalEl.textContent = "$" + regular.toFixed(2);
      originalEl.style.display = "block";
    } else {
      originalEl.textContent = "";
      originalEl.style.display = "none";
    }
  }

  const saleCard = document.getElementById("product-sale-card");
  if (saleCard) {
    if (saleActive) {
      saleCard.style.display = "inline-flex";
      document.getElementById("sale-badge").textContent = loadedProduct.sale_badge || "Sale";
      document.getElementById("sale-badge").style.background = loadedProduct.sale_badge_color || "#f97316";
      document.getElementById("sale-price-text").textContent = "Now $" + price.toFixed(2);
      document.getElementById("sale-discount-text").textContent =
        Math.round(((regular - price) / regular) * 100) + "% off";
    } else {
      saleCard.style.display = "none";
    }
  }
}

function renderVariants() {
  const container = document.getElementById("product-variants");
  const colors = document.getElementById("product-color-options");
  const sizes = document.getElementById("product-size-options");
  const variants = Array.isArray(loadedProduct?.variants) ? loadedProduct.variants : [];
  if (!container || !colors || !sizes) return;

  if (!variants.length) {
    container.hidden = true;
    return;
  }
  container.hidden = false;

  if (!selectedVariant || !variants.some(v => String(v.id) === String(selectedVariant.id))) {
    selectedVariant = variants[0];
  }

  colors.innerHTML = "";
  variants.forEach((variant) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "product-color-option" + (String(variant.id) === String(selectedVariant.id) ? " active" : "");
    button.title = variant.color;
    const img = document.createElement("img");
    img.src = imageUrl(variant.image || loadedProduct.image);
    img.alt = variant.color;
    button.appendChild(img);
    button.addEventListener("click", () => {
      selectedVariant = variant;
      selectedSize = null;
      galleryImages = variant.image
        ? [variant.image].concat((loadedProduct.images || []).filter(x => x !== variant.image))
        : galleryImages;
      galleryIndex = 0;
      renderGallery();
      renderVariants();
      renderPrice();
      updateAvailability();
    });
    colors.appendChild(button);
  });

  sizes.innerHTML = "";
  (selectedVariant.sizes || []).forEach((sizeObj) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "product-size-option" + (
      selectedSize && String(selectedSize) === String(sizeObj.id) ? " active" : ""
    );
    button.textContent = sizeObj.size;
    button.disabled = Number(selectedVariant.stock || 0) < 1;
    button.addEventListener("click", () => {
      selectedSize = sizeObj.id;
      renderVariants();
      renderPrice();
      updateAvailability();
    });
    sizes.appendChild(button);
  });
}

function updateAvailability() {
  const badge = document.getElementById("availability-badge");
  const text = document.getElementById("availability-text");
  const add = document.getElementById("addToCartBtn");
  const variantMode = Array.isArray(loadedProduct?.variants) && loadedProduct.variants.length;
  let out = String(loadedProduct?.stock_status || "in").toLowerCase() === "out";
  if (variantMode) {
    out = !selectedVariant || Number(selectedVariant.stock || 0) < 1 || !selectedSize;
    if (selectedVariant && Number(selectedVariant.stock || 0) > 0 && !selectedSize) {
      text.textContent = "Select a size";
    }
  }
  if (out) {
    badge.className = "availability-badge out-of-stock";
    if (text && (!variantMode || selectedSize)) text.textContent = "Out of Stock";
  } else {
    badge.className = "availability-badge in-stock";
    text.textContent = "In Stock";
  }
  if (add) add.disabled = out;
}

function addSelectedToCart(quantity = 1) {
  if (!loadedProduct) return;
  const variantMode = loadedProduct.variants?.length;
  if (variantMode && (!selectedVariant || !selectedSize)) {
    alert("Please select a color and size.");
    return;
  }
  const price = selectedPrice();
  const image = selectedVariant?.image
    ? imageUrl(selectedVariant.image)
    : imageUrl((loadedProduct.images || [loadedProduct.image])[0]);
  const variant = selectedVariant ? {
    variant_id: selectedVariant.id,
    color: selectedVariant.color,
    size: selectedVariant.sizes.find(s => String(s.id) === String(selectedSize))?.size || selectedSize,
    image
  } : null;

  for (let i = 0; i < quantity; i++) {
    addToCart(loadedProduct.title, price, image, loadedProduct.id, variant);
  }
}

async function loadProduct() {
  try {
    const response = await fetch(`${API}/products/${productId}`);
    const data = await response.json();
    if (!data.success || !data.product) {
      alert("Product not found");
      return;
    }
    loadedProduct = data.product;
    if (String(loadedProduct.status || "draft").toLowerCase() === "draft") {
      alert("Product not found");
      return;
    }

    galleryImages = Array.isArray(loadedProduct.images) && loadedProduct.images.length
      ? loadedProduct.images.slice(0, 5)
      : (loadedProduct.image ? [loadedProduct.image] : []);

    document.getElementById("product-name").textContent = loadedProduct.title;
    document.getElementById("product-brand").textContent = loadedProduct.brand || "Unbranded";
    document.getElementById("product-category").textContent = loadedProduct.category || "Uncategorized";
    document.getElementById("product-description").textContent = loadedProduct.description || "";
    renderGallery();
    renderVariants();
    renderPrice();
    updateAvailability();

    document.getElementById("addToCartBtn")?.addEventListener("click", () => addSelectedToCart(1));
    document.getElementById("buyNowBtn")?.addEventListener("click", (event) => {
      event.preventDefault();
      if (loadedProduct.variants?.length && (!selectedVariant || !selectedSize)) {
        alert("Please select a color and size.");
        return;
      }
      const variant = selectedVariant ? {
        variant_id: selectedVariant.id,
        color: selectedVariant.color,
        size: selectedVariant.sizes.find(s => String(s.id) === String(selectedSize))?.size || selectedSize,
        image: imageUrl(selectedVariant.image || loadedProduct.image)
      } : null;
      const buyNowKey = typeof getBuyNowStorageKey === "function" ? getBuyNowStorageKey() : null;
      if (buyNowKey) {
        sessionStorage.setItem(buyNowKey, JSON.stringify({
          id: `${loadedProduct.id}:v:${variant?.variant_id || "0"}:s:${variant?.size || ""}`,
          productId: Number(loadedProduct.id),
          name: loadedProduct.title,
          price: selectedPrice(),
          image: variant?.image || imageUrl(loadedProduct.image),
          quantity: 1,
          variant_id: variant?.variant_id || null,
          color: variant?.color || null,
          size: variant?.size || null,
          variant_image: variant?.image || null,
          source: "buy-now"
        }));
      }
      window.location.href = "checkout.html";
    });
  } catch (error) {
    console.error(error);
    alert("Unable to load product.");
  }
}

document.getElementById("product-image-prev")?.addEventListener("click", () => {
  galleryIndex--;
  renderGallery();
});
document.getElementById("product-image-next")?.addEventListener("click", () => {
  galleryIndex++;
  renderGallery();
});

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
