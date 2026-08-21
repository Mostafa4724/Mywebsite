/**
 * preview-product.js
 * Adds a "Preview" button to every admin product card.
 * Opens the product page in a scrollable iframe where only
 * the image-gallery prev/next buttons and scrolling are active.
 */
(function () {
  "use strict";

  var overlay  = document.getElementById("previewOverlay");
  var iframe   = document.getElementById("previewIframe");
  var closeBtn = document.getElementById("previewCloseBtn");
  var blocker  = document.getElementById("previewBlocker");

  if (!overlay || !iframe || !closeBtn) return;

  var isOpen = false;

  /* ── Host-page CSS: kill blocker so iframe scrolls natively ─ */
  (function () {
    var s = document.createElement("style");
    s.id = "preview-host-css";
    s.textContent =
      "#previewBlocker{pointer-events:none!important}" +
      "#previewIframe{width:100%!important;height:100%!important;border:none!important;display:block!important}" +
      "#previewCloseBtn{z-index:10!important;position:relative!important}";
    document.head.appendChild(s);
  })();

  /* ── Open / Close ──────────────────────────────────────── */
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

  closeBtn.addEventListener("click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    closePreview();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && isOpen) closePreview();
  });

  /* ── Iframe load: style + script injection ──────────────── */
  iframe.addEventListener("load", function () {
    try {
      var doc = iframe.contentDocument || iframe.contentWindow.document;
      if (!doc || !doc.head) return;

      /* cleanup previous */
      var os = doc.getElementById("preview-ro-s");
      if (os) os.remove();
      var oj = doc.getElementById("preview-ro-j");
      if (oj) oj.remove();

      /*
       * Selector for image-gallery prev / next buttons.
       * Covers the most common class-name patterns — extend if needed.
       */
      var GALLERY_BTN =
        '.gallery-prev, .gallery-next, ' +
        '.carousel-prev, .carousel-next, ' +
        '.slider-prev, .slider-next, ' +
        '.image-prev, .image-next, ' +
        '.img-prev, .img-next, ' +
        '.thumb-prev, .thumb-next, ' +
        '.product-prev, .product-next, ' +
        '.nav-prev, .nav-next, ' +
        '[class*="gallery-prev"], [class*="gallery-next"], ' +
        '[class*="carousel-prev"], [class*="carousel-next"], ' +
        '[class*="slider-prev"], [class*="slider-next"], ' +
        '[class*="image-prev"], [class*="image-next"], ' +
        '.product-images button, ' +
        '.product-gallery button, ' +
        '.image-gallery button, ' +
        '.main-image-container button, ' +
        '.product-image-nav button';

      /* ── styles ── */
      var style = doc.createElement("style");
      style.id = "preview-ro-s";
      style.textContent =
        /* ensure scrollable */
        "html,body{overflow:auto!important;overflow-x:hidden!important;height:auto!important;min-height:100%!important}" +
        /* disable everything interactive … */
        "button,input,textarea,select,a,form," +
        "[role='button'],[onclick],[data-action]{pointer-events:none!important;opacity:.45!important;cursor:not-allowed!important;filter:grayscale(.3)}" +
        /* … but re-enable gallery nav buttons */
        GALLERY_BTN + "{pointer-events:auto!important;opacity:1!important;cursor:pointer!important;filter:none!important}" +
        /* watermark */
        "body::after{content:'READ-ONLY PREVIEW';position:fixed;bottom:16px;right:16px;padding:6px 14px;" +
        "background:rgba(15,23,36,.85);color:rgba(255,255,255,.6);font-size:11px;font-weight:700;" +
        "letter-spacing:1px;border-radius:8px;z-index:9999;pointer-events:none;backdrop-filter:blur(6px)}";
      doc.head.appendChild(style);

      /* ── script: block clicks except on gallery buttons ── */
      var script = doc.createElement("script");
      script.id = "preview-ro-j";
      script.textContent =
        '(function(){' +
        'var G="' + GALLERY_BTN + '";' +
        'document.addEventListener("click",function(e){' +
        '  if(e.target.closest(G))return;' +          /* allow gallery nav  */
        '  if(e.target.closest("button,input,textarea,select,a,form,[role=button],[onclick],[data-action]")){' +
        '    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation()' +
        '  }' +
        '},true);' +
        'document.addEventListener("submit",function(e){e.preventDefault();e.stopPropagation()},true);' +
        'document.addEventListener("focusin",function(e){' +
        '  if(e.target.closest("input,textarea,select"))e.target.blur()' +
        '},true);' +
        '})();';
      doc.head.appendChild(script);
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

  /* ── MutationObserver ───────────────────────────────────── */
  var observer = new MutationObserver(function (mutations) {
    for (var i = 0; i < mutations.length; i++) {
      if (mutations[i].addedNodes.length > 0) { addPreviewButtons(); return; }
    }
  });

  function startObserving() {
    var grids = document.querySelectorAll(".products-grid");
    for (var i = 0; i < grids.length; i++) {
      observer.observe(grids[i], { childList: true, subtree: true });
    }
  }

  /* ── Init ───────────────────────────────────────────────── */
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