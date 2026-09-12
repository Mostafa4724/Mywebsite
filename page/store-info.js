/* Shared shop-identity loader for every customer-facing page.
 *
 * Fetches /public/store-info once, caches the result in sessionStorage for
 * the tab's lifetime (so subsequent pages don't re-hit the network on
 * every navigation), and applies it to the DOM in three ways:
 *
 *   1. Any element with data-store="name|email|phone|address|website|logo"
 *      has its textContent (or href, or src, for the obvious types)
 *      replaced with the live value.
 *
 *   2. document.title has the literal words "Your Shop" or "Website"
 *      replaced with the live shop name. This lets the source HTML stay
 *      readable ("Home - Website") while showing "Home - Ahmed's Store"
 *      in the browser tab.
 *
 *   3. window.StoreInfo.ready is a Promise that resolves with the store
 *      object, so scripts that need to render more complex UI (e.g.
 *      user-shell.js building the nav) can await it.
 *
 * When the fetch fails (backend down, first load, offline), everything
 * falls back gracefully to whatever the source HTML already contains.
 */
(function () {
  "use strict";

  const CACHE_KEY = "store_info_cache_v1";
  const FALLBACK = {
    name: "Your Shop",
    email: "",
    phone: "",
    address: "",
    website: "",
    logo: "",
  };

  function readCache() {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      return { ...FALLBACK, ...parsed };
    } catch (_) {
      return null;
    }
  }

  function writeCache(store) {
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(store)); }
    catch (_) { /* private mode / quota -- fine, we just refetch next time */ }
  }

  async function fetchStore() {
    const cached = readCache();
    if (cached) return cached;
    try {
      const base = detectBackendBase();
      const response = await fetch(base + "/public/store-info", { cache: "no-store" });
      if (!response.ok) throw new Error("HTTP " + response.status + " from " + base);
      const data = await response.json();
      if (!data || !data.success || !data.store) throw new Error("bad payload");
      const store = { ...FALLBACK, ...data.store };
      writeCache(store);
      return store;
    } catch (err) {
      // Only visible when the developer opens the console -- customers see
      // the source-HTML placeholders instead.
      console.warn("[store-info] using fallback because:", err && err.message);
      return FALLBACK;
    }
  }

  /* Figure out where the Flask backend is without depending on Config.js
   * having loaded first (which fails silently when the page includes it
   * with the wrong casing -- ../config.js vs ../Config.js).
   *
   * Priority order:
   *   1. window.API set by Config.js -- the real intended source.
   *   2. Any script on the page whose src contains /Config.js -- fetch
   *      it, extract the URL from the `const API = "..."` line.
   *      (Not implemented; too slow for the first paint. Included as
   *      a doc note in case someone extends this later.)
   *   3. Same host as the page, but on port 5000 -- covers Live Server
   *      on 5500 talking to Flask on 5000, which is what this repo
   *      always does in dev.
   *   4. Hard-coded http://127.0.0.1:5000 -- last resort.
   */
  function detectBackendBase() {
    if (typeof window.API === "string" && window.API) return window.API.replace(/\/+$/, "");

    try {
      const loc = window.location;
      // Any localhost-style origin -> assume Flask on 5000. Covers
      // 127.0.0.1:5500, localhost:5500, 0.0.0.0:5500, and their http/https
      // variants. Not applied to real domains because in production the
      // frontend and backend should live at the same origin.
      if (/^(127\.|localhost|0\.0\.0\.0)/.test(loc.hostname)) {
        return `${loc.protocol}//${loc.hostname}:5000`;
      }
    } catch (_) { /* ignore -- fall through */ }

    return "http://127.0.0.1:5000";
  }

  function applyToElement(element, store) {
    const key = element.getAttribute("data-store");
    const value = store[key];
    if (!value) return; // keep the source HTML placeholder in place

    switch (key) {
      case "email":
        element.textContent = value;
        if (element.tagName === "A") element.href = "mailto:" + value;
        break;
      case "phone":
        element.textContent = value;
        if (element.tagName === "A") {
          // Strip anything a `tel:` link can't dial.
          element.href = "tel:" + value.replace(/[^\d+]/g, "");
        }
        break;
      case "website":
        element.textContent = value;
        if (element.tagName === "A") element.href = value;
        break;
      case "logo":
        if (element.tagName === "IMG") {
          element.src = value;
          element.hidden = false;
        } else {
          element.style.backgroundImage = `url("${value.replace(/"/g, "%22")}")`;
        }
        break;
      case "name":
      case "address":
      default:
        element.textContent = value;
    }
  }

  function applyToDom(store) {
    document.querySelectorAll("[data-store]").forEach(el => applyToElement(el, store));

    // Update the tab title. The source HTML uses "Your Shop" or "Website"
    // as a stand-in so it stays readable; swap in the real name.
    if (store.name && store.name !== "Your Shop") {
      document.title = document.title
        .replace(/Your Shop/g, store.name)
        .replace(/\bWebsite\b/g, store.name);
    }

    // Footer copyright, when written as "&copy; 2026 Your Shop..."
    document.querySelectorAll(".user-site-footer, .footer-inner, footer").forEach(footer => {
      if (!store.name || store.name === "Your Shop") return;
      footer.querySelectorAll("p").forEach(p => {
        if (p.textContent.includes("Your Shop")) {
          p.textContent = p.textContent.replace(/Your Shop/g, store.name);
        }
      });
    });
  }

  const ready = fetchStore().then(store => {
    // If the DOM is already parsed, apply immediately. Otherwise wait.
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => applyToDom(store), { once: true });
    } else {
      applyToDom(store);
    }
    return store;
  });

  window.StoreInfo = {
    ready,
    get: () => readCache() || FALLBACK,
    // Force a refetch (e.g. right after the admin saves settings).
    refresh() {
      try { sessionStorage.removeItem(CACHE_KEY); } catch (_) {}
      return fetchStore().then(store => { applyToDom(store); return store; });
    },
  };
})();
