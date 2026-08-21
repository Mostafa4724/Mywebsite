/**
 * preview-product.js
 * Adds a "Preview" button to every admin product card.
 * Opens the product page in a read-only fullscreen iframe overlay.
 * An X button on the left closes the preview.
 */
(function () {
  "use strict";

  /* ── DOM references ─────────────────────────────────────── */
  var overlay  = document.getElementById("previewOverlay");
  var iframe   = document.getElementById("previewIframe");
  var closeBtn = document.getElementById("previewCloseBtn");

  if (!overlay || !iframe || !closeBtn) return;

  var isOpen = false;

  /* ── Open / Close helpers ───────────────────────────────── */
  function openPreview(productId) {
    if (isOpen) return;
    isOpen = true;

    /* Build the URL: admin/  →  ../page/product.html?id=... */
    iframe.src = "../page/product.html?id=" + encodeURIComponent(productId);

    overlay.classList.remove("closing");
    overlay.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  function closePreview() {
    if (!isOpen) return;
    isOpen = false;

    overlay.classList.add("closing");

    /* Wait for fade-out animation, then hide & clear */
    setTimeout(function () {
      overlay.classList.remove("active", "closing");
      iframe.src = "about:blank";
      document.body.style.overflow = "";
    }, 250);
  }

  /* ── Event listeners ────────────────────────────────────── */
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

  /* Prevent accidental interaction with the blocker itself */
  overlay.querySelector(".preview-blocker").addEventListener(
    "click",
    function (e) {
      e.preventDefault();
    }
  );

  /* ── (Optional) Inject read-only styles into the iframe ─── */
  /* Works when served from the same origin (localhost / server).
     Falls back silently on file:// due to cross-origin restrictions. */
  iframe.addEventListener("load", function () {
    try {
      var doc = iframe.contentDocument || iframe.contentWindow.document;
      if (!doc || !doc.head) return;

      var style = doc.createElement("style");
      style.id = "preview-readonly-styles";
      style.textContent = [
        /* Disable all interactive elements */
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
        /* Prevent form submissions */
        "form {",
        "  pointer-events: none !important;",
        "}",
        /* Subtle overlay hint */
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

      /* Avoid duplicate injections */
      if (doc.getElementById("preview-readonly-styles")) {
        doc.getElementById("preview-readonly-styles").remove();
      }
      doc.head.appendChild(style);
    } catch (err) {
      /* Cross-origin — the blocker div already prevents interaction */
    }
  });

  /* ── Find product ID from a card element ────────────────── */
  function getProductId(card) {
    /* 1. Direct data attributes on the card */
    if (card.dataset.id)        return card.dataset.id;
    if (card.dataset.productId) return card.dataset.productId;
    if (card.dataset.pid)       return card.dataset.pid;

    /* 2. Any child element with a product ID */
    var idEls = card.querySelectorAll("[data-id],[data-product-id],[data-pid]");
    for (var i = 0; i < idEls.length; i++) {
      if (idEls[i].dataset.id)        return idEls[i].dataset.id;
      if (idEls[i].dataset.productId) return idEls[i].dataset.productId;
      if (idEls[i].dataset.pid)       return idEls[i].dataset.pid;
    }

    /* 3. Extract from a link that points to product.html */
    var links = card.querySelectorAll("a[href*='product']");
    for (var j = 0; j < links.length; j++) {
      var match = links[j].href.match(/[?&]id=([^&]+)/);
      if (match) return decodeURIComponent(match[1]);
      /* Also try hash-based: product.html#id */
      var hashMatch = links[j].href.match(/product\.html#(.+)$/);
      if (hashMatch) return decodeURIComponent(hashMatch[1]);
    }

    /* 4. Extract from onclick / action attributes */
    var clickables = card.querySelectorAll("[onclick],[data-action]");
    for (var k = 0; k < clickables.length; k++) {
      var attr = clickables[k].getAttribute("onclick") ||
                 clickables[k].getAttribute("data-action") || "";
      var m = attr.match(/id['":\s]+(['"]?)([\w\-]+)\1/i);
      if (m) return m[2];
    }

    return null;
  }

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

  /* ── Insert Preview button into a card ──────────────────── */
  function injectPreviewButton(card) {
    /* Skip if already injected */
    if (card.querySelector(".preview-product-btn")) return;

    var productId = getProductId(card);
    if (!productId) return;

    var btn = createPreviewButton(productId);

    /* Strategy: find the best place to insert the button */

    /* A. Existing actions container */
    var actions =
      card.querySelector(".admin-card-actions") ||
      card.querySelector(".product-card-actions") ||
      card.querySelector("[class*='actions']") ||
      card.querySelector("[class*='buttons']");

    if (actions) {
      actions.appendChild(btn);
      return;
    }

    /* B. After the last button in the card */
    var lastBtn = card.querySelector("button:last-of-type");
    if (lastBtn && lastBtn.parentNode === card) {
      lastBtn.parentNode.insertBefore(btn, lastBtn.nextSibling);
      return;
    }

    /* C. At the very end of the card */
    card.appendChild(btn);
  }

  /* ── Scan grids and inject buttons ──────────────────────── */
  function addPreviewButtons() {
    var grids = document.querySelectorAll(".products-grid");
    for (var g = 0; g < grids.length; g++) {
      var children = grids[g].children;
      for (var i = 0; i < children.length; i++) {
        var child = children[i];

        /* Skip message placeholders */
        if (
          child.classList.contains("admin-products-message") ||
          child.tagName === "SCRIPT" ||
          child.tagName === "STYLE"
        ) {
          continue;
        }

        injectPreviewButton(child);
      }
    }
  }

  /* ── MutationObserver — catch dynamically added cards ───── */
  var observer = new MutationObserver(function (mutations) {
    var shouldScan = false;
    for (var i = 0; i < mutations.length; i++) {
      if (mutations[i].addedNodes.length > 0) {
        shouldScan = true;
        break;
      }
    }
    if (shouldScan) addPreviewButtons();
  });

  /* Start observing each product grid */
  function startObserving() {
    var grids = document.querySelectorAll(".products-grid");
    for (var i = 0; i < grids.length; i++) {
      observer.observe(grids[i], { childList: true, subtree: true });
    }
  }

  /* ── Initialization ─────────────────────────────────────── */
  function init() {
    startObserving();

    /* Run immediately + delayed retries (cards may load async) */
    addPreviewButtons();
    setTimeout(addPreviewButtons, 200);
    setTimeout(addPreviewButtons, 600);
    setTimeout(addPreviewButtons, 1200);
    setTimeout(addPreviewButtons, 2500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();