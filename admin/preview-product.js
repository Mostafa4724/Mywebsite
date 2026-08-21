/**
 * preview-product.js
 * Adds a "Preview" button to every admin product card.
 * Opens the product page in a scrollable, read-only fullscreen iframe.
 * X button on the left closes the preview.
 */
(function () {
  "use strict";

  /* ── DOM references ─────────────────────────────────────── */
  var overlay  = document.getElementById("previewOverlay");
  var iframe   = document.getElementById("previewIframe");
  var closeBtn = document.getElementById("previewCloseBtn");
  var blocker  = document.getElementById("previewBlocker");

  if (!overlay || !iframe || !closeBtn) return;

  var isOpen = false;

  /* ── Open / Close helpers ───────────────────────────────── */
  function openPreview(productId) {
    if (isOpen) return;
    isOpen = true;

    iframe.src = "../page/product.html?id=" + encodeURIComponent(productId);

    overlay.classList.remove("closing");
    overlay.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  function closePreview() {
    if (!isOpen) return;
    isOpen = false;

    overlay.classList.add("closing");

    setTimeout(function () {
      overlay.classList.remove("active", "closing");
      iframe.src = "about:blank";
      document.body.style.overflow = "";
    }, 250);
  }

  /* ── Scroll forwarding (wheel) ──────────────────────────── */
  if (blocker) {
    blocker.addEventListener(
      "wheel",
      function (e) {
        e.preventDefault();
        try {
          iframe.contentWindow.scrollBy({
            top: e.deltaY,
            left: e.deltaX,
            behavior: "auto"
          });
        } catch (err) {
          try {
            var doc = iframe.contentDocument;
            doc.documentElement.scrollTop += e.deltaY;
          } catch (err2) {}
        }
      },
      { passive: false }
    );

    /* ── Scroll forwarding (touch / mobile) ───────────────── */
    var lastTouchY = 0;
    var lastTouchX = 0;

    blocker.addEventListener(
      "touchstart",
      function (e) {
        lastTouchY = e.touches[0].clientY;
        lastTouchX = e.touches[0].clientX;
      },
      { passive: true }
    );

    blocker.addEventListener(
      "touchmove",
      function (e) {
        e.preventDefault();
        var touchY = e.touches[0].clientY;
        var touchX = e.touches[0].clientX;
        var deltaY = lastTouchY - touchY;
        var deltaX = lastTouchX - touchX;
        lastTouchY = touchY;
        lastTouchX = touchX;

        try {
          iframe.contentWindow.scrollBy(deltaX, deltaY);
        } catch (err) {
          try {
            var doc = iframe.contentDocument;
            doc.documentElement.scrollTop += deltaY;
            doc.documentElement.scrollLeft += deltaX;
          } catch (err2) {}
        }
      },
      { passive: false }
    );

    /* ── Block all click interactions ─────────────────────── */
    blocker.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
    });

    blocker.addEventListener("mousedown", function (e) {
      e.preventDefault();
    });

    blocker.addEventListener("dblclick", function (e) {
      e.preventDefault();
    });

    blocker.addEventListener("contextmenu", function (e) {
      e.preventDefault();
    });
  }

  /* ── Close button & keyboard ────────────────────────────── */
  closeBtn.addEventListener("click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    closePreview();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && isOpen) {
      closePreview();
    }
  });

  /* ── Inject read-only styles into iframe (same-origin) ─── */
  iframe.addEventListener("load", function () {
    try {
      var doc = iframe.contentDocument || iframe.contentWindow.document;
      if (!doc || !doc.head) return;

      var existing = doc.getElementById("preview-readonly-styles");
      if (existing) existing.remove();

      var style = doc.createElement("style");
      style.id = "preview-readonly-styles";
      style.textContent = [
        "button,",
        "input,",
        "textarea,",
        "select,",
        'a[class*="cart"],',
        'a[href*="cart"],',
        'a[href*="checkout"],',
        'a[href*="wishlist"],',
        ".add-to-cart-btn,",
        ".checkout-btn,",
        ".submit-review-btn,",
        ".qty-btn,",
        ".product-actions .btn-primary,",
        ".product-actions .btn-secondary,",
        ".wishlist-heart,",
        ".promo-input-group button,",
        ".newsletter-box button {",
        "  pointer-events: none !important;",
        "  opacity: 0.45 !important;",
        "  cursor: not-allowed !important;",
        "  filter: grayscale(0.3);",
        "}",
        "form {",
        "  pointer-events: none !important;",
        "}",
        "body::after {",
        "  content: 'READ-ONLY PREVIEW';",
        "  position: fixed;",
        "  bottom: 16px;",
        "  right: 16px;",
        "  padding: 6px 14px;",
        "  background: rgba(15,23,36,0.85);",
        "  color: rgba(255,255,255,0.6);",
        "  font-size: 11px;",
        "  font-weight: 700;",
        "  letter-spacing: 1px;",
        "  border-radius: 8px;",
        "  z-index: 9999;",
        "  pointer-events: none;",
        "  backdrop-filter: blur(6px);",
        "}"
      ].join("\n");

      doc.head.appendChild(style);
    } catch (err) {}
  });

  /* ── Create the Preview button ──────────────────────────── */
  function createPreviewButton(productId) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "preview-product-btn";
    btn.setAttribute("aria-label", "Preview product");
    btn.innerHTML =
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>' +
        '<circle cx="12" cy="12" r="3"/>' +
      "</svg>" +
      " Preview";

    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      openPreview(productId);
    });

    return btn;
  }

  /* ── Scan for cards and inject buttons ──────────────────── */
  function addPreviewButtons() {
    /* Target the EXACT class used by admin-products.js */
    var cards = document.querySelectorAll(".product-admin-card");

    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];

      /* Already has a preview button — skip */
      if (card.querySelector(".preview-product-btn")) continue;

      /* Product ID lives in data-product-id (set by createProductCard) */
      var productId = card.dataset.productId;
      if (!productId) continue;

      /* Actions container is .product-admin-actions */
      var actions = card.querySelector(".product-admin-actions");
      if (!actions) continue;

      var btn = createPreviewButton(productId);
      actions.appendChild(btn);
    }
  }

  /* ── Polling approach — guaranteed to catch async renders ─ */
  var pollCount = 0;
  var MAX_POLLS = 40; /* 40 × 300ms = 12 seconds of coverage */
  var pollTimer = null;

  function poll() {
    addPreviewButtons();
    pollCount++;

    if (pollCount >= MAX_POLLS) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  /* Also watch for future mutations (search filtering, etc.) */
  var observer = new MutationObserver(function () {
    addPreviewButtons();
  });

  function startObserving() {
    var grids = document.querySelectorAll(".products-grid");
    for (var i = 0; i < grids.length; i++) {
      observer.observe(grids[i], { childList: true, subtree: true });
    }
  }

  /* ── Initialization ─────────────────────────────────────── */
  function init() {
    startObserving();

    /* Immediate first attempt */
    addPreviewButtons();

    /* Then poll every 300ms to catch async API-loaded cards */
    pollTimer = setInterval(poll, 300);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();