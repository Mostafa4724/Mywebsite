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

  /* ── Ensure overlay / iframe / blocker CSS allows scroll ── */
  (function ensureScrollableCSS() {
    var style = document.createElement("style");
    style.id = "preview-scroll-fix";
    style.textContent = [
      "#previewOverlay.active {",
      "  overflow: hidden !important;",
      "}",
      "#previewIframe {",
      "  width: 100% !important;",
      "  height: 100% !important;",
      "  border: none !important;",
      "  display: block !important;",
      "}",
      "#previewBlocker {",
      "  position: absolute !important;",
      "  top: 0 !important;",
      "  left: 0 !important;",
      "  width: 100% !important;",
      "  height: 100% !important;",
      "  z-index: 2 !important;",
      "  cursor: default !important;",
      "}",
      "#previewCloseBtn {",
      "  z-index: 10 !important;",
      "}"
    ].join("\n");
    document.head.appendChild(style);
  })();

  /* ── Detect the actual scrollable element inside iframe ─── */
  function getIframeScroller() {
    try {
      var doc = iframe.contentDocument || iframe.contentWindow.document;
      var win = iframe.contentWindow;

      /* check for a custom scroll container first */
      var candidates = doc.querySelectorAll(
        '[style*="overflow"], .scroll-container, .scrollable, [data-scrollable], main'
      );
      for (var i = 0; i < candidates.length; i++) {
        var el = candidates[i];
        var cs = win.getComputedStyle(el);
        if (
          (cs.overflowY === "auto" || cs.overflowY === "scroll") &&
          el.scrollHeight > el.clientHeight + 2
        ) {
          return { el: el, win: win, doc: doc, isWindow: false };
        }
      }

      return { el: doc.documentElement, win: win, doc: doc, isWindow: true };
    } catch (e) {
      return null;
    }
  }

  /* ── Unified scroll helper ──────────────────────────────── */
  function scrollIframe(deltaX, deltaY) {
    var s = getIframeScroller();
    if (!s) return;

    try {
      if (s.isWindow) {
        s.win.scrollBy({ top: deltaY, left: deltaX, behavior: "auto" });
      } else {
        s.el.scrollTop  += deltaY;
        s.el.scrollLeft += deltaX;
      }
    } catch (e) {
      try {
        var doc = iframe.contentDocument;
        doc.documentElement.scrollTop  += deltaY;
        doc.documentElement.scrollLeft += deltaX;
      } catch (e2) { /* cross-origin fallback – nothing we can do */ }
    }
  }

  /* ── Read current scroll position & bounds ──────────────── */
  function getIframeScrollInfo() {
    try {
      var win = iframe.contentWindow;
      var doc = iframe.contentDocument;
      return {
        scrollTop:   win.pageYOffset || doc.documentElement.scrollTop || 0,
        scrollHeight: Math.max(doc.documentElement.scrollHeight, doc.body.scrollHeight),
        clientHeight: win.innerHeight || doc.documentElement.clientHeight
      };
    } catch (e) {
      return null;
    }
  }

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

  /* ── Scroll forwarding: mouse wheel ─────────────────────── */
  if (blocker) {
    blocker.addEventListener(
      "wheel",
      function (e) {
        e.preventDefault();
        e.stopPropagation();

        var deltaY = e.deltaY;
        var deltaX = e.deltaX;

        /* normalise delta-mode (0 = px, 1 = lines, 2 = pages) */
        if (e.deltaMode === 1) {
          deltaY *= 40;
          deltaX *= 40;
        } else if (e.deltaMode === 2) {
          deltaY *= (window.innerHeight || 800);
          deltaX *= (window.innerWidth  || 1200);
        }

        scrollIframe(deltaX, deltaY);
      },
      { passive: false }
    );

    /* ── Scroll forwarding: touch with momentum ───────────── */
    var lastTouchY = 0;
    var lastTouchX = 0;
    var touchStartTime = 0;
    var touchStartY = 0;
    var momentumRAF = 0;

    function cancelMomentum() {
      if (momentumRAF) {
        cancelAnimationFrame(momentumRAF);
        momentumRAF = 0;
      }
    }

    blocker.addEventListener(
      "touchstart",
      function (e) {
        cancelMomentum();
        lastTouchY = e.touches[0].clientY;
        lastTouchX = e.touches[0].clientX;
        touchStartTime = Date.now();
        touchStartY = lastTouchY;
      },
      { passive: true }
    );

    blocker.addEventListener(
      "touchmove",
      function (e) {
        e.preventDefault();
        e.stopPropagation();

        var ty = e.touches[0].clientY;
        var tx = e.touches[0].clientX;
        var dy = lastTouchY - ty;
        var dx = lastTouchX - tx;
        lastTouchY = ty;
        lastTouchX = tx;

        scrollIframe(dx, dy);
      },
      { passive: false }
    );

    blocker.addEventListener(
      "touchend",
      function (e) {
        var elapsed = Date.now() - touchStartTime;
        var endY = e.changedTouches[0] ? e.changedTouches[0].clientY : touchStartY;
        var dist  = touchStartY - endY;

        /* fast flick → animate momentum */
        if (elapsed < 300 && Math.abs(dist) > 20) {
          var totalMomentum = dist * 2.5;
          var info = getIframeScrollInfo();
          if (!info) return;

          var startScroll = info.scrollTop;
          var maxScroll   = Math.max(0, info.scrollHeight - info.clientHeight);
          var startTime   = Date.now();
          var duration    = 500;

          function animate() {
            var now      = Date.now();
            var progress = Math.min((now - startTime) / duration, 1);
            /* ease-out cubic */
            var eased    = 1 - Math.pow(1 - progress, 3);
            var offset   = totalMomentum * eased;
            var target   = Math.max(0, Math.min(startScroll + offset, maxScroll));

            try {
              iframe.contentWindow.scrollTo(0, target);
            } catch (e) {}

            if (progress < 1) {
              momentumRAF = requestAnimationFrame(animate);
            } else {
              momentumRAF = 0;
            }
          }

          momentumRAF = requestAnimationFrame(animate);
        }
      },
      { passive: true }
    );

    /* ── Block all click / pointer interactions ───────────── */
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

  /* ── Keyboard: close + scroll ───────────────────────────── */
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && isOpen) {
      closePreview();
      return;
    }
    if (!isOpen) return;

    var dy = 0;
    var dx = 0;

    switch (e.key) {
      case "ArrowDown":
      case "j":
        dy = 100;
        break;
      case "ArrowUp":
      case "k":
        dy = -100;
        break;
      case "ArrowRight":
        dx = 100;
        break;
      case "ArrowLeft":
        dx = -100;
        break;
      case "PageDown":
        dy = -(window.innerHeight * 0.85);
        break;
      case "PageUp":
        dy = window.innerHeight * 0.85;
        break;
      case "Home":
        try { iframe.contentWindow.scrollTo(0, 0); } catch (e) {}
        e.preventDefault();
        return;
      case "End":
        var info = getIframeScrollInfo();
        if (info) {
          try {
            iframe.contentWindow.scrollTo(0, info.scrollHeight - info.clientHeight);
          } catch (e) {}
        }
        e.preventDefault();
        return;
      case " ":
        dy = e.shiftKey
          ? window.innerHeight * 0.85
          : -(window.innerHeight * 0.85);
        break;
      default:
        return;
    }

    e.preventDefault();
    scrollIframe(dx, dy);
  });

  /* ── Close button ───────────────────────────────────────── */
  closeBtn.addEventListener("click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    closePreview();
  });

  /* ── Inject read-only + scroll-safe styles into iframe ──── */
  iframe.addEventListener("load", function () {
    try {
      var doc = iframe.contentDocument || iframe.contentWindow.document;
      if (!doc || !doc.head) return;

      var existing = doc.getElementById("preview-readonly-styles");
      if (existing) existing.remove();

      var style = doc.createElement("style");
      style.id = "preview-readonly-styles";
      style.textContent = [
        "/* ── force scrollability ── */",
        "html, body {",
        "  overflow: auto !important;",
        "  overflow-x: hidden !important;",
        "  height: auto !important;",
        "  min-height: 100% !important;",
        "}",
        "",
        "/* ── disable interactive elements ── */",
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

  /* ── Find product ID from a card element ────────────────── */
  function getProductId(card) {
    if (card.dataset.id)        return card.dataset.id;
    if (card.dataset.productId) return card.dataset.productId;
    if (card.dataset.pid)       return card.dataset.pid;

    var idEls = card.querySelectorAll("[data-id],[data-product-id],[data-pid]");
    for (var i = 0; i < idEls.length; i++) {
      if (idEls[i].dataset.id)        return idEls[i].dataset.id;
      if (idEls[i].dataset.productId) return idEls[i].dataset.productId;
      if (idEls[i].dataset.pid)       return idEls[i].dataset.pid;
    }

    var links = card.querySelectorAll("a[href*='product']");
    for (var j = 0; j < links.length; j++) {
      var match = links[j].href.match(/[?&]id=([^&]+)/);
      if (match) return decodeURIComponent(match[1]);
      var hashMatch = links[j].href.match(/product\.html#(.+)$/);
      if (hashMatch) return decodeURIComponent(hashMatch[1]);
    }

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
    if (card.querySelector(".preview-product-btn")) return;

    var productId = getProductId(card);
    if (!productId) return;

    var btn = createPreviewButton(productId);

    var actions =
      card.querySelector(".admin-card-actions") ||
      card.querySelector(".product-card-actions") ||
      card.querySelector("[class*='actions']") ||
      card.querySelector("[class*='buttons']");

    if (actions) {
      actions.appendChild(btn);
      return;
    }

    var lastBtn = card.querySelector("button:last-of-type");
    if (lastBtn && lastBtn.parentNode === card) {
      lastBtn.parentNode.insertBefore(btn, lastBtn.nextSibling);
      return;
    }

    card.appendChild(btn);
  }

  /* ── Scan grids and inject buttons ──────────────────────── */
  function addPreviewButtons() {
    var grids = document.querySelectorAll(".products-grid");
    for (var g = 0; g < grids.length; g++) {
      var children = grids[g].children;
      for (var i = 0; i < children.length; i++) {
        var child = children[i];

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

  function startObserving() {
    var grids = document.querySelectorAll(".products-grid");
    for (var i = 0; i < grids.length; i++) {
      observer.observe(grids[i], { childList: true, subtree: true });
    }
  }

  /* ── Initialization ─────────────────────────────────────── */
  function init() {
    startObserving();
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