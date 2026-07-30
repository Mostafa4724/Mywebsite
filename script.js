// ===== LocalStorage Cart System =====
function getCart() {
  try {
    return JSON.parse(localStorage.getItem('shopping_cart')) || [];
  } catch {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem('shopping_cart', JSON.stringify(cart));
  updateCartBubble();
}

function generateId(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function addToCart(name, price, image) {
  const cart = getCart();
  const id = generateId(name);
  const existing = cart.find(item => item.id === id);

  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({
      id: id,
      name: name,
      price: parseFloat(price) || 0,
      image: image || '',
      quantity: 1
    });
  }

  saveCart(cart);
  return cart;
}

function removeFromCart(id) {
  let cart = getCart();
  cart = cart.filter(item => item.id !== id);
  saveCart(cart);
  return cart;
}

function updateCartItemQuantity(id, delta) {
  const cart = getCart();
  const item = cart.find(item => item.id === id);
  if (!item) return cart;

  item.quantity += delta;
  if (item.quantity <= 0) {
    return removeFromCart(id);
  }
  saveCart(cart);
  return cart;
}

function getCartCount() {
  const cart = getCart();
  return cart.reduce((sum, item) => sum + item.quantity, 0);
}

// ===== Cart Counter =====
function getTotalItems() {
  // On cart page, use DOM; elsewhere use localStorage
  if (document.querySelector('#cart-items')) {
    const qtyElements = document.querySelectorAll('#cart-items .qty-value');
    let total = 0;
    qtyElements.forEach(el => {
      total += parseInt(el.textContent) || 0;
    });
    return total;
  }
  return getCartCount();
}

function updateCartBubble() {
  const bubble = document.querySelector('.cart-bubble');
  if (!bubble) return;
  const count = getCartCount();
  bubble.textContent = count;
  bubble.style.display = count > 0 ? 'flex' : 'none';
}

// ===== Render Cart Items from localStorage =====
function renderCartItems() {
  const container = document.getElementById('cart-items');
  if (!container) return;

  const cart = getCart();
  container.innerHTML = '';

  if (cart.length === 0) {
    checkEmptyCart();
    updateOrderSummary();
    return;
  }

  cart.forEach(item => {
    const article = document.createElement('article');
    article.className = 'cart-item';
    article.dataset.name = item.name;
    article.dataset.price = item.price;

    article.innerHTML = `
      <div class="cart-item-img">
        <img src="${item.image || 'https://picsum.photos/300/250?default'}" alt="${item.name}" />
      </div>
      <div class="cart-item-info">
        <h3>${item.name}</h3>
        <p class="item-price">$${item.price.toFixed(2)}</p>
      </div>
      <div class="cart-item-actions">
        <div class="qty-controls">
          <button class="qty-btn qty-minus" data-id="${item.id}">−</button>
          <span class="qty-value">${item.quantity}</span>
          <button class="qty-btn qty-plus" data-id="${item.id}">+</button>
        </div>
        <button class="remove-btn" data-id="${item.id}">Remove</button>
      </div>
    `;

    container.appendChild(article);
  });

  // Setup event listeners for the rendered items
  setupQtyControls();
  setupRemoveButtons();
  updateOrderSummary();
  checkEmptyCart();
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
      const id = this.dataset.id;
      if (id) {
        updateCartItemQuantity(id, 1);
        renderCartItems();
        return;
      }
      const valueEl = this.parentElement.querySelector('.qty-value');
      let val = parseInt(valueEl.textContent) || 1;
      valueEl.textContent = val + 1;
      updateOrderSummary();
    });
  });

  document.querySelectorAll('.qty-minus').forEach(btn => {
    btn.addEventListener('click', function () {
      const id = this.dataset.id;
      if (id) {
        updateCartItemQuantity(id, -1);
        renderCartItems();
        return;
      }
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
      const id = this.dataset.id;
      if (id) {
        removeFromCart(id);
        renderCartItems();
        return;
      }
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
  const addToCartBtn = document.querySelector('.product-actions .btn-primary');
  if (addToCartBtn) {
    addToCartBtn.addEventListener('click', function () {
      const productName = document.querySelector('.product-name')?.textContent || 'Product';
      const priceText = document.querySelector('.product-price')?.textContent || '$0.00';
      const price = priceText.replace(/[^0-9.]/g, '');
      const productImage = document.querySelector('#product-image')?.src || '';

      addToCart(productName, price, productImage);

      // Show feedback
      const cartBubble = document.querySelector('.cart-bubble');
      if (cartBubble) {
        cartBubble.style.transform = 'scale(1.3)';
        setTimeout(() => { cartBubble.style.transform = 'scale(1)'; }, 200);
      }

      alert(`"${productName}" has been added to your cart!`);
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

// ===== Get URL Parameters =====
function getUrlParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    name: params.get('name') || '',
    price: params.get('price') || '',
    image: params.get('image') || ''
  };
}

// ===== Product Data Store =====
const productDataMap = {
  'wireless-headphone': {
    description: 'Experience premium sound quality with our Wireless Headphone. Designed for comfort and long-lasting use, this headphone delivers rich bass, clear highs, and a balanced mid-range that brings your music to life.',
    features: ['Bluetooth 5.0 with 30ft range', 'Up to 20 hours of battery life', 'Memory foam ear cushions for all-day comfort', 'Built-in microphone for hands-free calls', 'Foldable design for easy portability', 'Compatible with all Bluetooth-enabled devices']
  },
  'smart-watch': {
    description: 'Stay connected and track your fitness with our Smart Watch. Featuring a vibrant display, heart rate monitoring, and seamless smartphone integration, this smartwatch is your perfect daily companion.',
    features: ['1.4" AMOLED display with always-on mode', 'Heart rate & SpO2 monitoring', 'GPS tracking for runs and rides', 'Water resistant up to 50 meters', '7-day battery life', 'Compatible with iOS and Android']
  },
  'running-shoes': {
    description: 'Take your running to the next level with our lightweight Running Shoes. Engineered with responsive cushioning and breathable mesh, these shoes provide the perfect balance of comfort and performance.',
    features: ['Lightweight knit upper for breathability', 'Responsive foam midsole cushioning', 'Rubber outsole for durable traction', 'Padded collar and tongue for comfort', 'Reflective details for visibility', 'Weight: only 9.5 oz (size 9)']
  },
  'gaming-mouse': {
    description: 'Dominate the competition with our high-precision Gaming Mouse. Equipped with a custom optical sensor and programmable buttons, this mouse gives you the edge you need in every game.',
    features: ['16,000 DPI optical sensor', '8 programmable buttons', 'Customizable RGB lighting', 'Lightweight honeycomb shell design', 'Braided cable for durability', 'Onboard memory for profile storage']
  }
};

// ===== Load Product From URL =====
function loadProductFromURL() {
  const params = getUrlParams();
  if (!params.name) return;

  const productNameEl = document.getElementById('product-name');
  const productPriceEl = document.getElementById('product-price');
  const productImageEl = document.getElementById('product-image');
  const productId = generateId(params.name);

  if (productNameEl) productNameEl.textContent = params.name;
  if (productPriceEl) productPriceEl.textContent = `$${parseFloat(params.price).toFixed(2)}`;
  if (productImageEl) {
    productImageEl.src = params.image || 'https://picsum.photos/500/400?product';
    productImageEl.alt = params.name;
  }

  // Update about section
  const productData = productDataMap[productId] || productDataMap['wireless-headphone'];
  const aboutDesc = document.querySelector('.about-section p');
  const aboutList = document.querySelector('.about-section ul');

  if (aboutDesc) aboutDesc.textContent = productData.description;
  if (aboutList) {
    aboutList.innerHTML = productData.features.map(f =>
      `<li>${f}</li>`
    ).join('');
  }
}

// ===== Home Page Init =====
function initHomePage() {
  // Handle Add to Cart buttons on home page
  document.querySelectorAll('.add-to-cart-btn').forEach(btn => {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();

      const name = this.dataset.name || '';
      const price = this.dataset.price || '0';
      const image = this.dataset.image || '';

      addToCart(name, price, image);

      // Visual feedback
      const cartBubble = document.querySelector('.cart-bubble');
      if (cartBubble) {
        cartBubble.style.transform = 'scale(1.3)';
        setTimeout(() => { cartBubble.style.transform = 'scale(1)'; }, 200);
      }

      alert(`"${name}" has been added to your cart!`);
    });
  });
}

// ===== Buy Now (placeholder) =====
function initBuyNow() {
  const buyNowBtn = document.querySelector('.product-actions .btn-secondary');
  if (buyNowBtn) {
    buyNowBtn.addEventListener('click', function (e) {
      // Default behavior: link to checkout page
      // The href is already set to checkout.html
    });
  }
}

// ===== Init =====
document.addEventListener('DOMContentLoaded', function () {
  // Cart page: render from localStorage
  if (document.querySelector('.cart-page')) {
    renderCartItems();
  } else {
    setupQtyControls();
    setupRemoveButtons();
    updateOrderSummary();
    checkEmptyCart();
  }

  setupPromoCode();
  setupCheckout();
  updateCartBubble();

  // Check if we're on the product page
  if (document.querySelector('.product-page')) {
    loadProductFromURL();
    initProductPage();
  }

  // Check if we're on the home page
  if (document.querySelector('.hero') && document.querySelector('#product-container')) {
    initHomePage();
  }
});
