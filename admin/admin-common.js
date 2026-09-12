(function () {
  "use strict";

  function token() {
    return sessionStorage.getItem("token") || "";
  }

  async function loadAdminAvatar() {
    const avatar = document.querySelector(".admin-user-avatar");
    if (!avatar) return;
    const savedUser = (() => {
      try {
        return JSON.parse(sessionStorage.getItem("user") || "null");
      } catch (_) {
        return null;
      }
    })();
    const fallback = String(
      savedUser?.username || savedUser?.name || savedUser?.email || "admin"
    ).trim();
    avatar.textContent = (fallback.charAt(0) || "A").toUpperCase();
    if (!token()) return;
    try {
      const response = await fetch(API + "/me", {
        headers: { Authorization: "Bearer " + token() },
      });
      const data = await response.json();
      const user = data.user || data;
      const username = String(user?.username || user?.name || fallback).trim();
      avatar.textContent = (username.charAt(0) || "A").toUpperCase();
      const label = document.querySelector(".admin-user-name");
      if (label) label.textContent = username || "Admin";
    } catch (_) {
      /* Keep the session-storage fallback. */
    }
  }

  /* Onboarding bubbles.
   *
   * A shop handed over with its delivery password is one guess away from
   * being taken over, and the owner has no way of knowing that. So the panel
   * says so on every page until it is fixed, rather than hoping they wander
   * into the right screen.
   */

  function badgeFor(link) {
    let badge = link.querySelector(".sidebar-badge");
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "sidebar-badge";
      link.appendChild(badge);
    }
    return badge;
  }

  function clearBubbles() {
    document.querySelectorAll(".sidebar-link .sidebar-badge").forEach(badge => {
      // Leave the orders counter alone; it is not ours.
      if (badge.id === "orderBubble") return;
      badge.hidden = true;
      badge.classList.remove("attention");
      badge.removeAttribute("title");
    });
  }

  function renderCallout(tasks) {
    const existing = document.querySelector(".setup-callout");
    if (existing) existing.remove();

    const urgent = tasks.find(task => task.urgent);
    if (!urgent) return;

    // Not on the page that fixes it -- that page has its own explanation.
    const here = (location.pathname.split("/").pop() || "").toLowerCase();
    if (here === "account-security.html") return;

    const content = document.querySelector(".admin-content");
    if (!content) return;

    const box = document.createElement("div");
    box.className = "setup-callout";

    const text = document.createElement("span");
    text.textContent =
      urgent.title +
      " \u2014 this shop is still using the login it was delivered with.";
    box.appendChild(text);

    const link = document.createElement("a");
    link.href = "account-security.html";
    link.textContent = "Secure it now";
    box.appendChild(link);

    content.insertBefore(box, content.firstChild);
  }

  async function loadSetupStatus() {
    if (!token()) return;

    let data;
    try {
      const response = await fetch(API + "/admin/setup-status", {
        headers: { Authorization: "Bearer " + token() },
        cache: "no-store",
      });
      if (!response.ok) return; // Old backend, or not an admin. Stay quiet.
      data = await response.json();
    } catch (_) {
      return; // Backend down. The page has bigger problems than a bubble.
    }

    if (!data || !data.success) return;

    clearBubbles();

    const tasks = data.tasks || [];
    tasks.forEach(task => {
      const link = document.querySelector(
        '.sidebar-link[data-section="' + task.section + '"]'
      );
      if (!link) return;
      const badge = badgeFor(link);
      badge.textContent = task.badge || "!";
      badge.title = task.title;
      badge.hidden = false;
      badge.classList.toggle("attention", !!task.urgent);
    });

    renderCallout(tasks);
    window.AdminSetupStatus.last = data;
  }

  window.AdminSetupStatus = { last: null, refresh: loadSetupStatus };

  function start() {
    loadAdminAvatar();
    loadSetupStatus();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
