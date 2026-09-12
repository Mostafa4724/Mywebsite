/* Customer profile page controller.
 *
 * The page has four tabs:
 *   - Profile: edit display name and login email
 *   - Orders:  compact list of the signed-in user's orders
 *   - Password: change password (mirrors change-password.js flow)
 *   - Contact: shop's own contact details, populated by store-info.js
 *
 * Everything below the sign-in gate assumes Auth.requireUser() has already
 * bounced the visitor to login.html if they were not signed in.
 */

(function () {
  "use strict";

  if (!window.Auth || !Auth.requireUser()) return;

  const els = {
    banner: document.getElementById("profileBanner"),
    avatar: document.getElementById("profileAvatar"),
    headerName: document.getElementById("profileHeaderName"),
    headerEmail: document.getElementById("profileHeaderEmail"),

    // Overview
    username: document.getElementById("pfUsername"),
    email: document.getElementById("pfEmail"),
    saveBtn: document.getElementById("pfSaveBtn"),
    resetBtn: document.getElementById("pfResetBtn"),
    status: document.getElementById("pfStatus"),
    profileForm: document.getElementById("profileForm"),
    joined: document.getElementById("pfJoined"),
    role: document.getElementById("pfRole"),
    orderCount: document.getElementById("pfOrderCount"),

    // Orders
    ordersList: document.getElementById("pfOrdersList"),

    // Password
    passwordForm: document.getElementById("pfPasswordForm"),
    currentPw: document.getElementById("pfCurrent"),
    newPw: document.getElementById("pfNew"),
    confirmPw: document.getElementById("pfConfirm"),
    pwSaveBtn: document.getElementById("pfPwSaveBtn"),
    pwStatus: document.getElementById("pfPwStatus"),

    logoutBtn: document.getElementById("logoutBtn"),
  };

  let originalProfile = { username: "", email: "" };

  // ------------------------------------------------------------------
  // Tabs
  // ------------------------------------------------------------------

  function showTab(name) {
    document.querySelectorAll(".profile-menu-item").forEach(btn => {
      const active = btn.dataset.tab === name;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });
    document.querySelectorAll("[data-tab-panel]").forEach(panel => {
      panel.hidden = panel.dataset.tabPanel !== name;
    });
    // Sync the URL hash so a refresh returns to the same tab. Purely
    // cosmetic; no server round-trip.
    if (location.hash !== "#" + name) history.replaceState(null, "", "#" + name);
  }

  document.querySelectorAll(".profile-menu-item[data-tab]").forEach(btn => {
    btn.addEventListener("click", () => showTab(btn.dataset.tab));
  });

  const initialTab = (location.hash || "").replace(/^#/, "");
  if (["overview", "orders", "password", "support"].includes(initialTab)) {
    showTab(initialTab);
  }

  // ------------------------------------------------------------------
  // Banner helpers
  // ------------------------------------------------------------------

  function showBanner(text, kind) {
    els.banner.textContent = text;
    els.banner.className = "profile-banner " + (kind || "");
    els.banner.hidden = false;
    els.banner.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  function hideBanner() { els.banner.hidden = true; }

  // ------------------------------------------------------------------
  // Load user + orders
  // ------------------------------------------------------------------

  function initialFromName(name) {
    const trimmed = String(name || "").trim();
    if (!trimmed) return "?";
    return trimmed.charAt(0).toUpperCase();
  }

  function fillProfileFromCached() {
    const user = Auth.getUser() || {};
    originalProfile = {
      username: user.username || "",
      email: user.email || "",
    };
    els.username.value = originalProfile.username;
    els.email.value = originalProfile.email;
    els.headerName.textContent = originalProfile.username || "Signed in";
    els.headerEmail.textContent = originalProfile.email || "";
    els.avatar.textContent = initialFromName(originalProfile.username || originalProfile.email);
    els.role.textContent = user.role === "admin" ? "Administrator" : "Customer";
  }

  async function loadOrders() {
    // Uses the same /orders endpoint the orders.html page uses.
    try {
      const response = await Auth.fetch(`${API}/orders`, {
        headers: { Authorization: `Bearer ${Auth.getToken()}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success || !Array.isArray(data.orders)) {
        els.ordersList.innerHTML = `<p class="profile-empty">Couldn't load your orders right now.</p>`;
        els.orderCount.textContent = "0";
        return;
      }

      const orders = data.orders;
      els.orderCount.textContent = String(orders.length);

      if (!orders.length) {
        els.ordersList.innerHTML = `
          <p class="profile-empty">You haven't placed any orders yet.
          <a href="home.html">Start shopping</a>.</p>`;
        return;
      }

      // Newest first, cap at 6 rows for the profile view. Full list is on
      // orders.html, and we already link to it from the tab.
      const sorted = orders.slice().sort((a, b) => {
        const ta = Date.parse(a.created_at || 0) || 0;
        const tb = Date.parse(b.created_at || 0) || 0;
        return tb - ta;
      });

      els.ordersList.innerHTML = sorted.slice(0, 6).map(order => {
        const total = Number(order.total || 0).toFixed(2);
        const status = String(order.status || "pending");
        const date = order.created_at
          ? new Date(order.created_at).toLocaleDateString()
          : "";
        const items = Array.isArray(order.items) ? order.items.length : 0;
        return `
          <a class="profile-order-row" href="order-confirmation.html?order=${order.id}">
            <span class="profile-order-id">Order #${order.id}</span>
            <span class="profile-order-meta">${date} · ${items} item${items === 1 ? "" : "s"}</span>
            <span class="profile-order-status status-${status.toLowerCase()}">${status}</span>
            <span class="profile-order-total">$${total}</span>
          </a>`;
      }).join("");
    } catch (_) {
      els.ordersList.innerHTML = `<p class="profile-empty">Couldn't load your orders right now.</p>`;
    }
  }

  async function loadFromServer() {
    // Refresh from /me so we're not showing a stale cached user record
    // (e.g. after an email update from another device).
    try {
      const response = await Auth.fetch(`${API}/me`, {
        headers: { Authorization: `Bearer ${Auth.getToken()}` },
      });
      if (!response.ok) return; // fallback to cached data is fine
      const data = await response.json().catch(() => ({}));
      if (data && data.success && data.user) {
        const merged = { ...(Auth.getUser() || {}), ...data.user };
        // Update Auth's stored user without changing tokens.
        try { localStorage.setItem("auth_user", JSON.stringify(merged)); } catch (_) {}
        fillProfileFromCached();
      }
      if (data && data.user && data.user.created_at) {
        els.joined.textContent = new Date(data.user.created_at).toLocaleDateString();
      }
    } catch (_) { /* offline is fine, cached data still shown */ }
  }

  // ------------------------------------------------------------------
  // Save profile (name/email)
  // ------------------------------------------------------------------

  els.profileForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideBanner();

    const username = els.username.value.trim();
    const email = els.email.value.trim();

    if (!username || !email) {
      showBanner("Both name and email are required.", "error");
      return;
    }
    if (username === originalProfile.username && email === originalProfile.email) {
      showBanner("Nothing changed.", "warn");
      return;
    }

    els.saveBtn.disabled = true;
    els.status.textContent = "Saving...";

    try {
      const response = await Auth.fetch(`${API}/me`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Auth.getToken()}`,
        },
        body: JSON.stringify({ username, email }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        showBanner(data.message || "Could not save your changes.", "error");
        return;
      }
      if (data.user) {
        try { localStorage.setItem("auth_user", JSON.stringify(data.user)); } catch (_) {}
      }
      fillProfileFromCached();
      showBanner("Your profile is up to date.", "success");
    } catch (_) {
      showBanner("Could not reach the server.", "error");
    } finally {
      els.saveBtn.disabled = false;
      els.status.textContent = "";
    }
  });

  els.resetBtn.addEventListener("click", () => {
    els.username.value = originalProfile.username;
    els.email.value = originalProfile.email;
    hideBanner();
  });

  // ------------------------------------------------------------------
  // Change password
  // ------------------------------------------------------------------

  els.passwordForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideBanner();

    if (els.newPw.value !== els.confirmPw.value) {
      els.pwStatus.textContent = "New passwords do not match.";
      return;
    }

    els.pwSaveBtn.disabled = true;
    els.pwStatus.textContent = "Changing...";

    try {
      const response = await Auth.fetch(`${API}/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Auth.getToken()}`,
        },
        body: JSON.stringify({
          current_password: els.currentPw.value,
          new_password: els.newPw.value,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.success) {
        Auth.setSession(data);
        els.passwordForm.reset();
        els.pwStatus.textContent = "";
        showBanner("Password changed. Other devices have been signed out.", "success");
      } else {
        els.pwStatus.textContent = data.message || "Could not change password.";
      }
    } catch (_) {
      els.pwStatus.textContent = "Could not reach the server.";
    } finally {
      els.pwSaveBtn.disabled = false;
    }
  });

  // ------------------------------------------------------------------
  // Logout
  // ------------------------------------------------------------------

  els.logoutBtn.addEventListener("click", async () => {
    try { await Auth.logout(); } catch (_) {}
    window.location.href = "home.html";
  });

  // ------------------------------------------------------------------
  // Boot
  // ------------------------------------------------------------------

  fillProfileFromCached();
  loadFromServer();
  loadOrders();
})();
