// SHOP_API_BASE is provided globally by /script.js (loaded first).
const catGrid = document.getElementById("catGrid");

const emojiFallback = ["🛍️", "🪞", "⌚", "🎒", "🧢", "📦", "🔋", "🏷️"];

function categoryEmoji(index) {
  return emojiFallback[index % emojiFallback.length];
}

const CATEGORY_IMAGES_STORAGE_KEY = "shop_category_images";

function getSavedCategoryImage(categoryId) {
  try {
    const raw = localStorage.getItem(CATEGORY_IMAGES_STORAGE_KEY);
    const images = raw ? JSON.parse(raw) : {};
    return images[String(categoryId)] || "";
  } catch (err) {
    console.warn("Could not read category images:", err);
    return "";
  }
}

// Load categories from the backend and render category cards
async function loadCategories() {
  if (!catGrid) return;

  try {
    const response = await fetch(SHOP_API_BASE + "/categories");
    const data = await response.json();

    if (!data.success) return;

    catGrid.innerHTML = "";

    if (data.categories.length === 0) {
      catGrid.innerHTML =
        '<p class="cat-item__desc" style="grid-column:1/-1;text-align:center;padding:40px;color:var(--fg-muted);">No categories yet. Check back soon!</p>';
      return;
    }

    data.categories.forEach((cat, index) => {
      const delay = Math.min((index % 8) + 1, 8);

      const card = document.createElement("a");
      card.className =
        "cat-item reveal reveal-d" + delay;
      card.href =
        "catagory-species.html?category=" + cat.id;
      card.setAttribute("aria-label", cat.name);
      card.dataset.name = cat.name;

      const categoryImage =
        getSavedCategoryImage(cat.id) ||
        "https://picsum.photos/seed/" +
        encodeURIComponent(cat.name) +
        "/600/400.jpg";

      card.innerHTML =
        '<div class="cat-item__img">' +
        '<span class="cat-item__num">' +
        String(index + 1).padStart(2, "0") +
        "</span>" +
        '<img src="' +
        categoryImage +
        '" alt="' +
        cat.name +
        '" loading="lazy" />' +
        '<div class="cat-item__icon-wrap">' +
        categoryEmoji(index) +
        "</div>" +
        "</div>" +
        '<div class="cat-item__body">' +
        '<h3 class="cat-item__name">' +
        cat.name +
        "</h3>" +
        '<p class="cat-item__desc">Browse all products in ' +
        cat.name +
        ".</p>" +
        '<div class="cat-item__footer">' +
        '<span class="cat-item__count">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>' +
        (cat.product_count || 0) +
        " items</span>" +
        '<span class="cat-item__arrow">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>' +
        "</span>" +
        "</div>" +
        "</div>";

      catGrid.appendChild(card);
    });

    // Init reveal + tilt for the newly added cards
    initReveal();
    initTilt();
  } catch (err) {
    console.error("Failed to load categories:", err);
  }
}

/* ===== SCROLL REVEAL ===== */
function initReveal() {
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
}

/* ===== CARD TILT (respects reduced motion) ===== */
function initTilt() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  document.querySelectorAll(".cat-item").forEach(function (card) {
    if (card.dataset.tiltBound) return;
    card.dataset.tiltBound = "1";

    card.addEventListener("mousemove", function (e) {
      var rect = this.getBoundingClientRect();
      var x = e.clientX - rect.left;
      var y = e.clientY - rect.top;
      var cx = rect.width / 2;
      var cy = rect.height / 2;
      var rx = ((y - cy) / cy) * -3;
      var ry = ((x - cx) / cx) * 3;
      this.style.transform =
        "translateY(-8px) perspective(700px) rotateX(" +
        rx +
        "deg) rotateY(" +
        ry +
        "deg)";
    });

    card.addEventListener("mouseleave", function () {
      this.style.transform = "";
    });
  });
}

loadCategories();