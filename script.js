// ===== Cart Counter =====
function getTotalItems() {
  const qtyElements = document.querySelectorAll('#cart-items .qty-value');
  let total = 0;
  qtyElements.forEach(el => {
    total += parseInt(el.textContent) || 0;
  });
  return total;
}

function updateCartBubble() {
  const bubble = document.querySelector('.cart-bubble');
  if (!bubble) return;
  const count = getTotalItems();
  bubble.textContent = count;
  bubble.style.display = count > 0 ? 'flex' : 'none';
}

// ===== Order Summary =====
function updateOrderSummary() {
  const items = document.querySelectorAll('#cart-items .cart-item');
  let subtotal = 0;
  let totalItems = 0;

  items.forEach(item => {
    const price = parseFloat(item.dataset.price) || 0;
    const qty = parseInt(item.querySelector('.qty-value').textContent) || 0;
    subtotal += price * qty;
    totalItems += qty;
  });

  const shipping = totalItems > 0 ? 12.00 : 0;
  const tax = subtotal * 0.08;
  const total = subtotal + shipping + tax;

  const subtotalEl = document.getElementById('subtotal-value');
  const shippingEl = document.getElementById('shipping-value');
  const taxEl = document.getElementById('tax-value');
  const totalEl = document.getElementById('total-value');

  if (subtotalEl) subtotalEl.textContent = `$${subtotal.toFixed(2)}`;
  if (shippingEl) shippingEl.textContent = shipping > 0 ? `$${shipping.toFixed(2)}` : '$0.00';
  if (taxEl) taxEl.textContent = `$${tax.toFixed(2)}`;
  if (totalEl) totalEl.textContent = `$${total.toFixed(2)}`;

  updateCartBubble();
}

// ===== Quantity Controls =====
function setupQtyControls() {
  document.querySelectorAll('.qty-plus').forEach(btn => {
    btn.addEventListener('click', function () {
      const valueEl = this.parentElement.querySelector('.qty-value');
      let val = parseInt(valueEl.textContent) || 1;
      valueEl.textContent = val + 1;
      updateOrderSummary();
    });
  });

  document.querySelectorAll('.qty-minus').forEach(btn => {
    btn.addEventListener('click', function () {
      const valueEl = this.parentElement.querySelector('.qty-value');
      let val = parseInt(valueEl.textContent) || 1;
      if (val > 1) {
        valueEl.textContent = val - 1;
        updateOrderSummary();
      }
    });
  });
}

// ===== Remove Items =====
function setupRemoveButtons() {
  document.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      const item = this.closest('.cart-item');
      if (item) {
        item.remove();
        updateOrderSummary();
        checkEmptyCart();
      }
    });
  });
}

// ===== Empty Cart State =====
function checkEmptyCart() {
  const items = document.querySelectorAll('#cart-items .cart-item');
  const layout = document.getElementById('cart-layout');
  const existingEmpty = document.querySelector('.cart-empty');

  if (items.length === 0 && layout) {
    // Hide normal layout
    layout.style.display = 'none';

    // Show empty state if not already shown
    if (!existingEmpty) {
      const emptyState = document.createElement('div');
      emptyState.className = 'cart-empty';
      emptyState.innerHTML = `
        <svg width="80" height="80" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M6 6h15l-1.5 9h-12L4 2H2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="10" cy="20" r="1" fill="currentColor"/>
          <circle cx="18" cy="20" r="1" fill="currentColor"/>
        </svg>
        <h3>Your cart is empty</h3>
        <p>Looks like you haven't added anything yet.</p>
        <a href="../index.html" class="shop-btn">Continue Shopping</a>
      `;
      const cartPage = document.querySelector('.cart-page');
      if (cartPage) cartPage.appendChild(emptyState);
    }
  } else if (items.length > 0 && layout) {
    layout.style.display = 'grid';
    if (existingEmpty) existingEmpty.remove();
  }
}

// ===== Promo Code (placeholder) =====
function setupPromoCode() {
  const applyBtn = document.getElementById('apply-promo');
  const promoInput = document.getElementById('promo-input');
  if (applyBtn && promoInput) {
    applyBtn.addEventListener('click', function () {
      const code = promoInput.value.trim().toUpperCase();
      if (code === 'SAVE10') {
        alert('Promo code applied! 10% discount will be reflected.');
      } else if (code) {
        alert(`"${code}" is not a valid promo code.`);
      } else {
        alert('Please enter a promo code.');
      }
    });
  }
}

// ===== Checkout (placeholder) =====
function setupCheckout() {
  const checkoutBtn = document.getElementById('checkout-btn');
  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', function () {
      const totalItems = getTotalItems();
      if (totalItems === 0) {
        alert('Your cart is empty. Add some items first!');
      } else {
        alert('Thank you for your purchase! This is a demo checkout.');
      }
    });
  }
}

// ===== Product Page - Reviews Data =====
let productReviews = [
  { name: 'Sarah M.', rating: 5, text: 'Amazing quality! Highly recommend this product.', date: '2025-01-15' },
  { name: 'James K.', rating: 4, text: 'Great value for the price. Would buy again.', date: '2025-02-03' },
  { name: 'Emily R.', rating: 5, text: 'Exceeded my expectations. Fast shipping too!', date: '2025-02-20' }
];

let selectedRating = 0;

// ===== Star Input (clickable stars) =====
function initStarInput() {
  const starBtns = document.querySelectorAll('.star-input .star-btn');
  starBtns.forEach(btn => {
    btn.addEventListener('click', function () {
      selectedRating = parseInt(this.dataset.value);
      starBtns.forEach(s => s.classList.remove('active'));
      // Highlight selected and all before it (since direction is rtl)
      starBtns.forEach(s => {
        if (parseInt(s.dataset.value) <= selectedRating) {
          s.classList.add('active');
        }
      });
    });

    btn.addEventListener('mouseenter', function () {
      const val = parseInt(this.dataset.value);
      starBtns.forEach(s => {
        s.classList.remove('active');
        if (parseInt(s.dataset.value) <= val) {
          s.style.color = '#f59e0b';
        } else {
          s.style.color = '#e2e8f0';
        }
      });
    });

    btn.addEventListener('mouseleave', function () {
      starBtns.forEach(s => {
        s.style.color = '';
        if (selectedRating > 0 && parseInt(s.dataset.value) <= selectedRating) {
          s.classList.add('active');
        }
      });
    });
  });
}

// ===== Submit Review =====
function initReviewSubmit() {
  const submitBtn = document.querySelector('.submit-review-btn');
  const textarea = document.querySelector('.review-form textarea');

  if (!submitBtn || !textarea) return;

  submitBtn.addEventListener('click', function () {
    const text = textarea.value.trim();
    if (selectedRating === 0) {
      alert('Please select a star rating.');
      return;
    }
    if (!text) {
      alert('Please write a review comment.');
      return;
    }

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];

    productReviews.push({
      name: 'You',
      rating: selectedRating,
      text: text,
      date: dateStr
    });

    // Reset form
    textarea.value = '';
    selectedRating = 0;
    document.querySelectorAll('.star-input .star-btn').forEach(s => s.classList.remove('active'));

    // Refresh displays
    displayReviews();
    displayAverageRating();
    alert('Thank you for your review!');
  });
}

// ===== Display Reviews =====
function displayReviews() {
  const reviewsList = document.querySelector('.reviews-list');
  if (!reviewsList) return;

  if (productReviews.length === 0) {
    reviewsList.innerHTML = '<p class="no-reviews">No reviews yet. Be the first to review!</p>';
    return;
  }

  reviewsList.innerHTML = productReviews.map(review => {
    const starsHtml = Array.from({ length: 5 }, (_, i) =>
      `<span class="star ${i < review.rating ? '' : 'empty'}">★</span>`
    ).join('');

    return `
      <div class="review-card">
        <div class="review-header">
          <span class="reviewer-name">${review.name}</span>
          <span class="review-date">${review.date}</span>
        </div>
        <div class="review-stars">${starsHtml}</div>
        <p class="review-text">${review.text}</p>
      </div>
    `;
  }).join('');
}

// ===== Calculate & Display Average Rating =====
function calculateAverageRating() {
  if (productReviews.length === 0) return 0;
  const total = productReviews.reduce((sum, r) => sum + r.rating, 0);
  return total / productReviews.length;
}

function displayAverageRating() {
  const starsDisplay = document.querySelector('.stars-display');
  const averageText = document.querySelector('.average-text');
  const reviewCount = document.querySelector('.review-count');

  if (!starsDisplay) return;

  const avg = calculateAverageRating();
  const fullStars = Math.floor(avg);
  const hasHalf = avg - fullStars >= 0.25 && avg - fullStars < 0.75;
  const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);

  let html = '';
  for (let i = 0; i < fullStars; i++) {
    html += '<span class="star filled">★</span>';
  }
  if (hasHalf) {
    html += '<span class="star half">★</span>';
  }
  for (let i = 0; i < emptyStars; i++) {
    html += '<span class="star">★</span>';
  }

  starsDisplay.innerHTML = html;
  if (averageText) averageText.textContent = avg > 0 ? avg.toFixed(1) : '0.0';
  if (reviewCount) reviewCount.textContent = `(${productReviews.length} review${productReviews.length !== 1 ? 's' : ''})`;
}

// ===== Add To Cart =====
function initAddToCart() {
  const addToCartBtn = document.querySelector('.btn-primary');
  if (addToCartBtn) {
    addToCartBtn.addEventListener('click', function () {
      const productName = document.querySelector('.product-name')?.textContent || 'Product';
      const productPrice = document.querySelector('.product-price')?.textContent || '$0.00';
      alert(`"${productName}" has been added to your cart!`);
    });
  }
}

// ===== Buy Now =====
function initBuyNow() {
  const buyNowBtn = document.querySelector('.btn-secondary');
  if (buyNowBtn) {
    buyNowBtn.addEventListener('click', function () {
      const productName = document.querySelector('.product-name')?.textContent || 'Product';
      const productPrice = document.querySelector('.product-price')?.textContent || '$0.00';
      alert(`Proceeding to checkout with "${productName}" - ${productPrice}`);
    });
  }
}

// ===== Init Product Page =====
function initProductPage() {
  initStarInput();
  initReviewSubmit();
  displayReviews();
  displayAverageRating();
  initAddToCart();
  initBuyNow();
}

// ===== Init =====
document.addEventListener('DOMContentLoaded', function () {
  setupQtyControls();
  setupRemoveButtons();
  setupPromoCode();
  setupCheckout();
  updateOrderSummary();
  checkEmptyCart();

  // Check if we're on the product page
  if (document.querySelector('.product-page')) {
    initProductPage();
  }
});
