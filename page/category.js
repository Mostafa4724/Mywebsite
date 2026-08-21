// SHOP_API_BASE is provided globally by /script.js (loaded first).
const catGrid = document.getElementById("catGrid");
const categorySearch = document.getElementById("categorySearch");
const categorySearchEmpty = document.getElementById("category-search-empty");
let allCategories = [];

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
function renderCategories(categories) {
  if (!catGrid) return;
  catGrid.innerHTML = "";
  if (!categories.length) {
    if (categorySearchEmpty) categorySearchEmpty.hidden = false;
    return;
  }
  if (categorySearchEmpty) categorySearchEmpty.hidden = true;
  categories.forEach((cat, index) => {
    const delay = Math.min((index % 8) + 1, 8);
    const card = document.createElement("a");
    card.className = "cat-item reveal reveal-d" + delay;
    card.href = "catagory-species.html?category=" + cat.id;
    card.setAttribute("aria-label", cat.name);
    card.dataset.name = cat.name;
    const categoryImage = getSavedCategoryImage(cat.id) || "https://picsum.photos/seed/" + encodeURIComponent(cat.name) + "/600/400.jpg";
    card.innerHTML = '<div class="cat-item__img"><span class="cat-item__num">' + String(index + 1).padStart(2, "0") + '</span><img src="' + categoryImage + '" alt="' + cat.name + '" loading="lazy" /><div class="cat-item__icon-wrap">' + categoryEmoji(index) + '</div></div>' +
      '<div class="cat-item__body"><h3 class="cat-item__name">' + cat.name + '</h3><p class="cat-item__desc">Browse all products in ' + cat.name + '.</p><div class="cat-item__footer"><span class="cat-item__count">' + (cat.product_count || 0) + ' items</span><span class="cat-item__arrow">↗</span></div></div>';
    catGrid.appendChild(card);
  });
  initReveal();
  initTilt();
}

async function loadCategories() {
  if (!catGrid) return;
  try {
    const response = await fetch(SHOP_API_BASE + "/categories");
    const data = await response.json();
    if (!data.success) return;
    allCategories = data.categories || [];
    filterCategories();
  } catch (err) {
    console.error("Failed to load categories:", err);
  }
}

function filterCategories() {
  const query = String(categorySearch?.value || "").trim().toLowerCase();
  const filtered = allCategories.filter((cat) => String(cat.name || "").toLowerCase().includes(query));
  renderCategories(filtered);
}

categorySearch?.addEventListener("input", filterCategories);

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