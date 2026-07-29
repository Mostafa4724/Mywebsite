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

// ===== Init =====
document.addEventListener('DOMContentLoaded', function () {
  setupQtyControls();
  setupRemoveButtons();
  setupPromoCode();
  setupCheckout();
  updateOrderSummary();
  checkEmptyCart();
});
