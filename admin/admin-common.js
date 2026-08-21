(function () {
  "use strict";
  const API_BASE = "http://127.0.0.1:5000";
  async function loadAdminAvatar() {
    const avatar = document.querySelector(".admin-user-avatar");
    if (!avatar) return;
    const token = sessionStorage.getItem("token");
    const savedUser = (() => { try { return JSON.parse(sessionStorage.getItem("user") || "null"); } catch (_) { return null; } })();
    const fallback = String(savedUser?.username || savedUser?.name || savedUser?.email || "admin").trim();
    avatar.textContent = (fallback.charAt(0) || "A").toUpperCase();
    if (!token) return;
    try {
      const response = await fetch(API_BASE + "/me", { headers: { Authorization: "Bearer " + token } });
      const data = await response.json();
      const user = data.user || data;
      const username = String(user?.username || user?.name || fallback).trim();
      avatar.textContent = (username.charAt(0) || "A").toUpperCase();
      const label = document.querySelector(".admin-user-name");
      if (label) label.textContent = username || "Admin";
    } catch (_) { /* Keep the session-storage fallback. */ }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", loadAdminAvatar); else loadAdminAvatar();
})();
