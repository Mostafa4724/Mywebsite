(function () {
  "use strict";
  const path = window.location.pathname.replace(/\\/g, "/");
  const rootPage = /\/index\.html$/.test(path) || path.endsWith("/index.html");
  const home = rootPage ? "page/home.html" : "home.html";
  const category = rootPage ? "page/Catagory.html" : "Catagory.html";
  const contact = rootPage ? "page/Contact.html" : "Contact.html";
  const about = rootPage ? "page/About us.html" : "About us.html";
  const cart = rootPage ? "page/cart.html" : "cart.html";
  const orders = rootPage ? "page/orders.html" : "orders.html";
  const ordersIcon = rootPage ? "page/orders-icon.svg" : "orders-icon.svg";
  const nav = document.querySelector(".site-nav, .orders-topbar, .oc-topbar");
  if (nav) {
    const active = location.pathname.toLowerCase();
    nav.outerHTML = `<nav class="site-nav"><div class="nav-inner"><a href="${home}" class="logo">Logo Here.</a><ul class="nav-links" role="menu" aria-label="Main navigation"><li><a href="${home}">Home</a></li><li><a href="${category}">Catagory</a></li><li><a href="${contact}">Contact Us</a></li><li><a href="${about}">About us</a></li></ul><div class="nav-icons"><i class="fa-solid fa-user"></i></a><a class="icon-btn cart" href="${cart}" aria-label="Cart"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M6 6h15l-1.5 9h-12L4 2H2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="10" cy="20" r="1" fill="currentColor"/><circle cx="18" cy="20" r="1" fill="currentColor"/></svg><span class="cart-bubble">0</span></a><a class="orders-nav-icon" href="${orders}" aria-label="My Orders" title="My Orders"><img src="${ordersIcon}" alt="" aria-hidden="true" /></a></div></div></nav>`;
  }
  if (!document.querySelector("footer")) {
    const footer = document.createElement("footer");
    footer.innerHTML = `<div class="footer-inner"><p>&copy; 2026 Your Shop. All Rights Reserved.</p></div>`;
    document.body.appendChild(footer);
  }
})();