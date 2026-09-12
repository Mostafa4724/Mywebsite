/* Shared user-facing header + footer.
 *
 * Every customer page swaps out its <nav.site-nav> for the markup this
 * builds. That keeps one source of truth for the nav across the site --
 * change the layout here and every page picks it up.
 *
 * Rendering rules:
 *
 *   * Logo: shows the STORE_LOGO_URL image if the shop has uploaded one.
 *           Falls back to STORE_NAME as text if no logo is set. Never
 *           shows both -- the user has confirmed logo-only is correct.
 *
 *   * Profile icon: sits beside the cart. Goes to profile.html when the
 *           customer is signed in, or login.html when they aren't.
 *
 *   * Cart bubble + orders icon are always present.
 *
 * The nav is built synchronously with cached identity so pages don't
 * flash "Your Shop" for a beat before the real name appears. store-info.js
 * caches identity in sessionStorage for exactly this reason.
 */
(function () {
  "use strict";

  const path = window.location.pathname.replace(/\\/g, "/");
  const rootPage = /\/index\.html$/.test(path) || path.endsWith("/index.html");
  const P = rootPage ? "page/" : "";

  const links = {
    home:     P + "home.html",
    category: P + "Catagory.html",
    contact:  P + "Contact.html",
    about:    P + "About us.html",
    cart:     P + "cart.html",
    orders:   P + "orders.html",
    profile:  P + "profile.html",
    login:    P + "login.html",
    ordersIcon: P + "orders-icon.svg",
  };

  function isSignedIn() {
    try { return !!(window.Auth && window.Auth.isLoggedIn && window.Auth.isLoggedIn()); }
    catch (_) { return false; }
  }

  function buildLogo(store) {
    if (store && store.logo) {
      // Escape only what breaks out of a src attribute.
      const safeUrl = String(store.logo).replace(/"/g, "&quot;");
      const safeName = String(store.name || "Shop").replace(/"/g, "&quot;");
      return `<img class="nav-logo-img" src="${safeUrl}" alt="${safeName}" data-store="logo" />`;
    }
    // Text fallback. data-store="name" lets store-info.js update it live
    // if the shop name is changed while the tab is open.
    const safeName = store && store.name ? String(store.name) : "Your Shop";
    return `<span class="nav-logo-text" data-store="name">${safeName}</span>`;
  }

  function buildNav(store) {
    const profileHref = isSignedIn() ? links.profile : links.login;
    const profileTitle = isSignedIn() ? "My Account" : "Sign in";

    return `
<nav class="site-nav">
  <div class="nav-inner">
    <a href="${links.home}" class="logo" aria-label="${(store && store.name) || 'Home'}">
      ${buildLogo(store)}
    </a>

    <ul class="nav-links" role="menu" aria-label="Main navigation">
      <li><a href="${links.home}">Home</a></li>
      <li><a href="${links.category}">Catagory</a></li>
      <li><a href="${links.contact}">Contact Us</a></li>
      <li><a href="${links.about}">About us</a></li>
    </ul>

    <div class="nav-icons">
      <a class="icon-btn account" href="${profileHref}" aria-label="${profileTitle}" title="${profileTitle}">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="1.4" stroke-linecap="round"
             stroke-linejoin="round" aria-hidden="true">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
      </a>

      <a class="icon-btn cart" href="${links.cart}" aria-label="Cart" title="Cart">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
             xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M6 6h15l-1.5 9h-12L4 2H2" stroke="currentColor"
                stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="10" cy="20" r="1" fill="currentColor"/>
          <circle cx="18" cy="20" r="1" fill="currentColor"/>
        </svg>
        <span class="cart-bubble">0</span>
      </a>

      <a class="orders-nav-icon" href="${links.orders}" aria-label="My Orders" title="My Orders">
        <img src="${links.ordersIcon}" alt="" aria-hidden="true" />
      </a>
    </div>
  </div>
</nav>`;
  }

  function injectNav(store) {
    const existing = document.querySelector(".site-nav, .orders-topbar, .oc-topbar");
    if (existing) existing.outerHTML = buildNav(store);
  }

  function injectFooterIfMissing(store) {
    if (document.querySelector("footer")) return;
    const footer = document.createElement("footer");
    footer.className = "user-site-footer";
    const name = (store && store.name) || "Your Shop";
    footer.innerHTML =
      `<div class="user-site-footer__inner"><p>&copy; 2026 <span data-store="name">${name}</span>. All Rights Reserved.</p></div>`;
    document.body.appendChild(footer);
  }

  // Render synchronously with cached identity so no "Your Shop" flash.
  const cached = (window.StoreInfo && window.StoreInfo.get()) || null;
  injectNav(cached);
  injectFooterIfMissing(cached);

  // When the live identity arrives (first load after cache expiry, or a
  // fresh fetch), rerender so a name/logo change lands without a full
  // page reload.
  if (window.StoreInfo && window.StoreInfo.ready) {
    window.StoreInfo.ready.then(store => {
      injectNav(store);
      injectFooterIfMissing(store);
    }).catch(() => {});
  }
})();
