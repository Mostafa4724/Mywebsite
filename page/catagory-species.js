/* ===== SCROLL REVEAL ===== */
(function () {
  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
        }
      });
    },
    { threshold: 0.06, rootMargin: "0px 0px -30px 0px" }
  );

  document.querySelectorAll(".reveal").forEach(function (el) {
    observer.observe(el);
  });
})();

/* ===== ADD TO CART ===== */
(function () {
  document.querySelectorAll(".add-to-cart-btn").forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();

      var name = this.dataset.name || "";
      var price = this.dataset.price || "0";
      var image = this.dataset.image || "";

      if (typeof addToCart === "function") {
        addToCart(name, price, image);
      }

      var originalHTML = this.innerHTML;
      this.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Added';
      this.classList.add("added");

      var self = this;
      setTimeout(function () {
        self.innerHTML = originalHTML;
        self.classList.remove("added");
      }, 1500);
    });
  });
})();

/* ===== CARD TILT ===== */
(function () {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  document.querySelectorAll(".product-card").forEach(function (card) {
    card.addEventListener("mousemove", function (e) {
      var rect = this.getBoundingClientRect();
      var x = e.clientX - rect.left;
      var y = e.clientY - rect.top;
      var cx = rect.width / 2;
      var cy = rect.height / 2;
      var rx = ((y - cy) / cy) * -2.5;
      var ry = ((x - cx) / cx) * 2.5;
      this.style.transform =
        "translateY(-8px) perspective(700px) rotateX(" +
        rx + "deg) rotateY(" + ry + "deg)";
    });

    card.addEventListener("mouseleave", function () {
      this.style.transform = "";
    });
  });
})();