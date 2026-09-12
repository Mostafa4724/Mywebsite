/* Replacing the credentials the shop was delivered with.
 *
 * The one thing this page must never do is leave the owner locked out. So:
 * the server bumps token_version on a password change, hands back a fresh
 * token pair, and this file stores them before doing anything else. Every
 * other device is signed out; this browser carries on.
 */

(function () {
  "use strict";

  const els = {
    banner: document.getElementById("banner"),
    danger: document.getElementById("dangerBox"),
    dangerText: document.getElementById("dangerText"),
    safe: document.getElementById("safeBox"),
    loading: document.getElementById("loading"),
    form: document.getElementById("accountForm"),
    username: document.getElementById("username"),
    email: document.getElementById("email"),
    currentPassword: document.getElementById("currentPassword"),
    newPassword: document.getElementById("newPassword"),
    confirmPassword: document.getElementById("confirmPassword"),
    currentHint: document.getElementById("currentHint"),
    newHint: document.getElementById("newHint"),
    pwNote: document.getElementById("pwNote"),
    strength: document.getElementById("strength"),
    strengthLabel: document.getElementById("strengthLabel"),
    logoutWarning: document.getElementById("logoutWarning"),
    saveBtn: document.getElementById("saveBtn"),
    resetBtn: document.getElementById("resetBtn"),
    status: document.getElementById("status"),
    nextStep: document.getElementById("nextStep"),
  };

  let state = null;
  let original = { username: "", email: "" };
  let minLength = 8;

  function token() {
    return sessionStorage.getItem("token") || "";
  }

  async function api(path, options) {
    const response = await fetch(API + path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token(),
        ...(options && options.headers),
      },
    });
    const data = await response.json().catch(() => ({}));
    return { response, data };
  }

  function showBanner(text, kind) {
    els.banner.textContent = text;
    els.banner.className = "settings-banner " + (kind || "");
    els.banner.hidden = false;
  }

  function clearErrors() {
    document.querySelectorAll(".settings-field").forEach(wrap => {
      wrap.classList.remove("invalid");
      const error = wrap.querySelector(".error-text");
      if (error) error.hidden = true;
    });
  }

  function showErrors(errors) {
    let first = null;
    Object.keys(errors || {}).forEach(key => {
      const wrap = document.querySelector(`[data-key="${CSS.escape(key)}"]`);
      if (!wrap) return;
      wrap.classList.add("invalid");
      const error = wrap.querySelector(".error-text");
      if (error) {
        error.textContent = errors[key];
        error.hidden = false;
      }
      if (!first) first = wrap;
    });
    if (first) first.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // ---------- password strength ----------

  function rateStrength(value) {
    if (!value) return null;
    let score = 0;
    if (value.length >= minLength) score++;
    if (value.length >= 12) score++;
    if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score++;
    if (/\d/.test(value)) score++;
    if (/[^A-Za-z0-9]/.test(value)) score++;
    if (value.length < minLength) return { key: "weak", label: "Too short" };
    if (score <= 2) return { key: "weak", label: "Weak" };
    if (score === 3) return { key: "fair", label: "Fair" };
    return { key: "strong", label: "Strong" };
  }

  function updateStrength() {
    const rating = rateStrength(els.newPassword.value);
    if (!rating) {
      els.strength.hidden = true;
      return;
    }
    els.strength.hidden = false;
    els.strength.className = "acc-strength " + rating.key;
    els.strengthLabel.textContent = rating.label;
  }

  function updateLogoutWarning() {
    els.logoutWarning.hidden = !els.newPassword.value;
  }

  // ---------- load ----------

  async function load() {
    els.loading.hidden = false;
    els.form.hidden = true;
    clearErrors();

    let result;
    try {
      result = await api("/admin/setup-status", { method: "GET" });
    } catch (_) {
      els.loading.hidden = true;
      showBanner(
        "Could not reach the backend at " + API + ". Start it with " +
          "`python app.py` in the backend folder.",
        "error"
      );
      return;
    }

    const { response, data } = result;

    if (response.status === 401) {
      sessionStorage.removeItem("token");
      window.location.replace("../page/login.html");
      return;
    }
    if (response.status === 403) {
      els.loading.hidden = true;
      showBanner("This page is for admin accounts only.", "error");
      return;
    }
    if (!response.ok || !data.success) {
      els.loading.hidden = true;
      showBanner(
        data.message ||
          "The backend has no /admin/setup-status route. Copy " +
            "backend/onboarding.py into place, register onboarding_bp in " +
            "app.py, then restart python app.py.",
        "error"
      );
      return;
    }

    state = data;
    minLength = data.min_password_length || 8;

    original = { username: data.username || "", email: data.email || "" };
    els.username.value = original.username;
    els.email.value = original.email;
    els.currentPassword.value = "";
    els.newPassword.value = "";
    els.confirmPassword.value = "";
    updateStrength();
    updateLogoutWarning();

    els.newHint.textContent =
      `At least ${minLength} characters. Mix letters, numbers and a symbol.`;

    renderState();

    els.loading.hidden = true;
    els.form.hidden = false;
  }

  function renderState() {
    const usingEmail = state.using_default_email;
    const usingPassword = state.using_default_password;

    if (!state.account_secure) {
      const bad = [];
      if (usingEmail) bad.push("the delivery email address");
      if (usingPassword) bad.push("the delivery password");
      els.dangerText.textContent =
        "You are still signing in with " + bad.join(" and ") + ".";
      els.danger.hidden = false;
      els.safe.hidden = true;
      els.pwNote.textContent =
        "Pick something only you know. Not the password you were handed, " +
        "and not one you use on another site.";
      els.currentHint.textContent =
        "The password you were given when the shop was delivered.";
    } else {
      els.danger.hidden = true;
      els.safe.hidden = false;
      els.pwNote.textContent =
        "Leave the new password boxes empty if you only want to change your " +
        "name or email.";
      els.currentHint.textContent =
        "Needed to confirm it is really you making the change.";
    }

    // Only nudge onward once the account is safe. Telling someone to go set
    // up email while their shop is still wide open is the wrong order.
    els.nextStep.hidden = !(state.account_secure && !state.email_configured);
  }

  // ---------- save ----------

  async function save(event) {
    event.preventDefault();
    clearErrors();

    const payload = {
      current_password: els.currentPassword.value,
      username: els.username.value.trim(),
      email: els.email.value.trim(),
      new_password: els.newPassword.value,
      confirm_password: els.confirmPassword.value,
    };

    if (!payload.current_password) {
      showErrors({ current_password: "Enter your current password." });
      return;
    }

    const nothingChanged =
      payload.username === original.username &&
      payload.email === original.email &&
      !payload.new_password;

    if (nothingChanged) {
      showBanner("Change something first, then save.", "warn");
      return;
    }

    // Catch the mismatch here so the password never leaves the browser
    // just to be told it was typed wrong.
    if (payload.new_password &&
        payload.new_password !== payload.confirm_password) {
      showErrors({ confirm_password: "The two passwords do not match." });
      return;
    }

    els.saveBtn.disabled = true;
    els.resetBtn.disabled = true;
    els.status.textContent = "Saving...";

    let result;
    try {
      result = await api("/admin/account", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    } catch (_) {
      els.saveBtn.disabled = false;
      els.resetBtn.disabled = false;
      els.status.textContent = "";
      showBanner("Could not reach the backend. Nothing was changed.", "error");
      return;
    }

    const { response, data } = result;
    els.saveBtn.disabled = false;
    els.resetBtn.disabled = false;
    els.status.textContent = "";

    if (response.status === 401) {
      sessionStorage.removeItem("token");
      window.location.replace("../page/login.html");
      return;
    }

    if (!response.ok || !data.success) {
      showErrors(data.errors);
      if (!data.errors || !Object.keys(data.errors).length) {
        showBanner(data.message || `Save failed (HTTP ${response.status}).`, "error");
      } else {
        showBanner(data.message || "Nothing was changed.", "error");
      }
      return;
    }

    // Store the replacement tokens before anything else can fail. The old
    // ones stopped working the moment the password changed.
    if (data.token) sessionStorage.setItem("token", data.token);
    if (data.refresh_token) {
      sessionStorage.setItem("refresh_token", data.refresh_token);
    }
    if (data.user) sessionStorage.setItem("user", JSON.stringify(data.user));

    const changed = data.changed || [];
    const readable = changed
      .map(c => (c === "password" ? "password" : c === "email" ? "login email" : "name"))
      .join(", ");

    showBanner(
      `Saved. Your ${readable} ${changed.length > 1 ? "have" : "has"} been ` +
        "updated. Use the new details next time you sign in.",
      "success"
    );

    if (window.AdminSetupStatus) window.AdminSetupStatus.refresh();
    await load();
  }

  // ---------- wiring ----------

  els.form.addEventListener("submit", save);
  els.resetBtn.addEventListener("click", () => load());
  els.newPassword.addEventListener("input", () => {
    updateStrength();
    updateLogoutWarning();
  });

  document.querySelectorAll("[data-toggle]").forEach(button => {
    button.addEventListener("click", () => {
      const input = document.getElementById(button.dataset.toggle);
      if (!input) return;
      const hidden = input.type === "password";
      input.type = hidden ? "text" : "password";
      button.textContent = hidden ? "Hide" : "Show";
    });
  });

  const menuToggle = document.getElementById("menuToggle");
  const sidebar = document.getElementById("adminSidebar");
  const overlay = document.getElementById("sidebarOverlay");
  if (menuToggle && sidebar) {
    menuToggle.addEventListener("click", () => {
      sidebar.classList.toggle("open");
      if (overlay) overlay.classList.toggle("show");
    });
  }
  if (overlay) {
    overlay.addEventListener("click", () => {
      sidebar.classList.remove("open");
      overlay.classList.remove("show");
    });
  }

  const logout = document.getElementById("adminLogout");
  if (logout) {
    logout.addEventListener("click", () => {
      sessionStorage.removeItem("token");
      sessionStorage.removeItem("user");
    });
  }

  if (!token()) {
    window.location.replace("../page/login.html");
  } else {
    load();
  }
})();
