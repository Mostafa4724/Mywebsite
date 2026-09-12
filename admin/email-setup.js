/* Email setup wizard.
 *
 * A shop owner should be able to finish this without knowing what SMTP is.
 * It writes only the six email keys; everything else in .env is left alone
 * by the server's merge step.
 *
 * Nothing is saved until a test email actually arrives, so a shop can never
 * end up live with a broken sender and silent registration failures.
 */

(function () {
  "use strict";

  const PROVIDERS = [
    {
      id: "brevo",
      name: "Brevo",
      kind: "Sending service",
      badge: "safe",
      host: "smtp-relay.brevo.com",
      port: "587",
      usernameLabel: "SMTP login",
      usernameHint: "Shown on the Brevo SMTP page. Often not your login email.",
      passwordLabel: "SMTP key",
      passwordHint: "A long key from Brevo. Not your Brevo account password.",
      steps: [
        "Sign in to Brevo and open SMTP & API, then the SMTP tab.",
        "Copy the SMTP login it shows you.",
        "Click Generate a new SMTP key and copy the key.",
      ],
    },
    {
      id: "sendgrid",
      name: "SendGrid",
      kind: "Sending service",
      badge: "safe",
      host: "smtp.sendgrid.net",
      port: "587",
      usernameFixed: "apikey",
      usernameLabel: "Username",
      usernameHint: "Always the literal word apikey. Leave it as it is.",
      passwordLabel: "API key",
      passwordHint: "Starts with SG. — create one with Mail Send permission.",
      steps: [
        "In SendGrid open Settings, then API Keys.",
        "Create an API key with Mail Send permission only.",
        "Copy it now; SendGrid will not show it again.",
      ],
    },
    {
      id: "resend",
      name: "Resend",
      kind: "Sending service",
      badge: "safe",
      host: "smtp.resend.com",
      port: "587",
      usernameFixed: "resend",
      usernameLabel: "Username",
      usernameHint: "Always the literal word resend.",
      passwordLabel: "API key",
      passwordHint: "Starts with re_.",
      steps: [
        "In Resend open API Keys and create one with sending access.",
        "Verify your domain first, or sending will be limited.",
      ],
    },
    {
      id: "mailgun",
      name: "Mailgun",
      kind: "Sending service",
      badge: "safe",
      host: "smtp.mailgun.org",
      port: "587",
      usernameLabel: "SMTP login",
      usernameHint: "Looks like postmaster@mg.yourdomain.com",
      passwordLabel: "SMTP password",
      passwordHint: "From the SMTP credentials section of your domain.",
      steps: [
        "Open your domain in Mailgun and find SMTP credentials.",
        "Copy the login, then reset the password to reveal a new one.",
      ],
    },
    {
      id: "ses",
      name: "Amazon SES",
      kind: "Sending service",
      badge: "safe",
      host: "email-smtp.us-east-1.amazonaws.com",
      port: "587",
      usernameLabel: "SMTP username",
      usernameHint: "The SMTP username SES generated, not your AWS key ID.",
      passwordLabel: "SMTP password",
      passwordHint: "The SMTP password SES generated. It is shown once.",
      steps: [
        "In SES open SMTP settings and create SMTP credentials.",
        "Change the host below to match your AWS region.",
        "A new SES account is in sandbox mode and can only send to verified addresses.",
      ],
    },
    {
      id: "gmail",
      name: "Gmail",
      kind: "Personal mailbox",
      badge: "mailbox",
      host: "smtp.gmail.com",
      port: "587",
      usernameLabel: "Gmail address",
      usernameHint: "The full address, for example yourshop@gmail.com",
      passwordLabel: "App password",
      passwordHint:
        "16 characters from Google, not your Gmail password. Spaces are fine.",
      steps: [
        "Turn on 2-Step Verification in your Google account first.",
        "Go to Google Account, Security, then App passwords.",
        "Create one for Mail and copy the 16 characters.",
      ],
      warning:
        "Gmail caps sending at a few hundred messages a day and shop emails " +
        "often land in spam. Fine while you are starting out; move to a " +
        "sending service before you get busy.",
    },
    {
      id: "outlook",
      name: "Outlook / Microsoft 365",
      kind: "Personal mailbox",
      badge: "mailbox",
      host: "smtp.office365.com",
      port: "587",
      usernameLabel: "Email address",
      usernameHint: "The full address you sign in with.",
      passwordLabel: "Password or app password",
      passwordHint:
        "If your account uses 2-step verification you need an app password.",
      steps: [
        "Business accounts often have SMTP turned off by default.",
        "Ask your Microsoft 365 administrator to enable authenticated SMTP.",
      ],
    },
    {
      id: "custom",
      name: "Something else",
      kind: "Any SMTP server",
      host: "",
      port: "587",
      usernameLabel: "Username",
      usernameHint: "Usually the full email address.",
      passwordLabel: "Password",
      passwordHint: "",
      steps: [
        "Your host or provider will list an SMTP server address and port.",
        "This app uses STARTTLS, which is normally port 587.",
      ],
    },
  ];

  const MASK_DEFAULT = "********";

  const els = {
    banner: document.getElementById("banner"),
    loading: document.getElementById("loading"),
    wizard: document.getElementById("wizard"),
    providers: document.getElementById("providers"),
    step2: document.getElementById("step2"),
    step3: document.getElementById("step3"),
    providerHint: document.getElementById("providerHint"),
    providerGuide: document.getElementById("providerGuide"),
    storeName: document.getElementById("storeName"),
    emailFrom: document.getElementById("emailFrom"),
    emailUsername: document.getElementById("emailUsername"),
    emailPassword: document.getElementById("emailPassword"),
    emailHost: document.getElementById("emailHost"),
    emailPort: document.getElementById("emailPort"),
    usernameHint: document.getElementById("usernameHint"),
    passwordLabel: document.getElementById("passwordLabel"),
    passwordHint: document.getElementById("passwordHint"),
    advanced: document.getElementById("advanced"),
    advancedToggle: document.getElementById("advancedToggle"),
    togglePassword: document.getElementById("togglePassword"),
    testRecipient: document.getElementById("testRecipient"),
    testBtn: document.getElementById("testBtn"),
    testResult: document.getElementById("testResult"),
    saveBtn: document.getElementById("saveBtn"),
    skipTest: document.getElementById("skipTest"),
    status: document.getElementById("status"),
  };

  let MASK = MASK_DEFAULT;
  let bootId = null;
  let selected = null;
  let passwordStored = false;
  let passwordTouched = false;
  let testPassed = false;

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

  async function diagnose() {
    try {
      if ((await fetch(API + "/", { cache: "no-store" })).ok) {
        return (
          "The backend is running but has no /admin/settings route. Copy " +
          "backend/settings_admin.py into place, register settings_bp in " +
          "app.py, then restart python app.py."
        );
      }
    } catch (_) {
      /* fall through */
    }
    return (
      "Could not reach the backend at " + API + ". Start it with " +
      "`python app.py` in the backend folder."
    );
  }

  // ---------- providers ----------

  function guessProvider(host) {
    const value = String(host || "").toLowerCase();
    if (!value) return null;
    const match = PROVIDERS.find(
      p => p.host && value === p.host.toLowerCase()
    );
    if (match) return match;
    if (value.includes("amazonaws.com")) return byId("ses");
    if (value.includes("gmail")) return byId("gmail");
    if (value.includes("office365") || value.includes("outlook")) {
      return byId("outlook");
    }
    return byId("custom");
  }

  function byId(id) {
    return PROVIDERS.find(p => p.id === id);
  }

  function renderProviders() {
    els.providers.innerHTML = "";
    PROVIDERS.forEach(provider => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "mail-provider";
      button.dataset.id = provider.id;

      const name = document.createElement("span");
      name.className = "name";
      name.textContent = provider.name;
      button.appendChild(name);

      const kind = document.createElement("span");
      kind.className = "kind";
      kind.textContent = provider.kind;
      button.appendChild(kind);

      if (provider.badge) {
        const badge = document.createElement("span");
        badge.className = "badge " + provider.badge;
        badge.textContent =
          provider.badge === "safe" ? "Revocable key" : "Mailbox login";
        button.appendChild(badge);
      }

      button.addEventListener("click", () => selectProvider(provider.id, true));
      els.providers.appendChild(button);
    });
  }

  function selectProvider(id, fillDefaults) {
    selected = byId(id);
    if (!selected) return;

    els.providers.querySelectorAll(".mail-provider").forEach(button => {
      button.classList.toggle("selected", button.dataset.id === id);
    });

    els.step2.hidden = false;
    els.step3.hidden = false;

    els.providerHint.textContent =
      selected.id === "custom"
        ? "Enter the SMTP details your provider gave you."
        : `Details from your ${selected.name} account.`;

    // Guide
    const parts = [];
    if (selected.warning) {
      parts.push(`<strong>${escapeHtml(selected.warning)}</strong>`);
    }
    if (selected.steps && selected.steps.length) {
      parts.push(
        "<ol>" +
          selected.steps.map(s => `<li>${escapeHtml(s)}</li>`).join("") +
          "</ol>"
      );
    }
    els.providerGuide.innerHTML = parts.join("");
    els.providerGuide.hidden = parts.length === 0;

    els.usernameHint.textContent = selected.usernameHint || "";
    els.passwordHint.textContent = selected.passwordHint || "";
    els.passwordLabel.innerHTML =
      escapeHtml(selected.passwordLabel || "Password") +
      '<span class="req">*</span>';
    document.querySelector('[data-key="EMAIL_USERNAME"] label').innerHTML =
      escapeHtml(selected.usernameLabel || "Username") +
      '<span class="req">*</span>';

    if (fillDefaults) {
      if (selected.host) els.emailHost.value = selected.host;
      if (selected.port) els.emailPort.value = selected.port;
      if (selected.usernameFixed) {
        els.emailUsername.value = selected.usernameFixed;
        els.emailUsername.readOnly = true;
      } else {
        els.emailUsername.readOnly = false;
      }
      if (selected.id === "custom" && !els.emailHost.value) {
        openAdvanced();
      }
      invalidateTest();
    } else if (selected.usernameFixed) {
      els.emailUsername.readOnly = true;
    }
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = String(text);
    return div.innerHTML;
  }

  function openAdvanced() {
    els.advanced.hidden = false;
    els.advancedToggle.classList.add("open");
  }

  // ---------- values ----------

  function values() {
    const password = els.emailPassword.value;
    return {
      STORE_NAME: els.storeName.value.trim(),
      EMAIL_FROM: els.emailFrom.value.trim(),
      EMAIL_USERNAME: els.emailUsername.value.trim(),
      // Gmail shows app passwords in groups of four; the spaces are display
      // only and Gmail rejects the login if they are sent.
      EMAIL_PASSWORD: passwordTouched
        ? password.replace(/\s+/g, "")
        : passwordStored
        ? MASK
        : "",
      EMAIL_HOST: els.emailHost.value.trim(),
      EMAIL_PORT: els.emailPort.value.trim() || "587",
    };
  }

  function clearErrors() {
    document.querySelectorAll(".settings-field").forEach(wrap => {
      wrap.classList.remove("invalid");
      const error = wrap.querySelector(".error-text");
      if (error) error.hidden = true;
    });
  }

  function showFieldErrors(errors) {
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
      if (key === "EMAIL_HOST" || key === "EMAIL_PORT") openAdvanced();
    });
    if (first) first.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function invalidateTest() {
    if (!testPassed) return;
    testPassed = false;
    els.saveBtn.disabled = true;
    els.testResult.hidden = true;
    els.status.textContent = "Details changed — send another test.";
  }

  // ---------- error translation ----------

  /* SMTP errors are written for mail administrators. A shop owner needs to
   * know which field to go fix, so map the common ones onto plain advice. */
  function explain(raw) {
    const text = String(raw || "");
    const lower = text.toLowerCase();

    if (lower.includes("authenticationerror") ||
        lower.includes("535") ||
        lower.includes("username and password not accepted")) {
      return selected && selected.id === "gmail"
        ? "Google rejected the login. Use a 16-character App Password, not " +
          "your Gmail password, and make sure 2-Step Verification is on."
        : "The server rejected the username or password. Check both, and " +
          "make sure you used the key from your provider rather than your " +
          "account password.";
    }
    if (lower.includes("serverdisconnected") ||
        lower.includes("connection unexpectedly closed")) {
      return "The mail server accepted the connection and then hung up " +
             "during login, without saying why. On Windows this is almost " +
             "always antivirus: Avast, AVG, ESET, Kaspersky and Bitdefender " +
             "all have a mail shield that breaks SMTP logins. Turn off the " +
             "mail/email shield and try again. If that is not it, run " +
             "`python diagnose_smtp.py` in the backend folder for the full " +
             "server conversation.";
    }
    if (lower.includes("gaierror") || lower.includes("name or service") ||
        lower.includes("nodename nor servname")) {
      return "The SMTP host address could not be found. Check it for typos.";
    }
    if (lower.includes("timed out") || lower.includes("timeout")) {
      return "The server did not answer. The port may be blocked by your " +
             "host or firewall — try port 587.";
    }
    if (lower.includes("connectionrefused") || lower.includes("refused")) {
      return "The server refused the connection. Check the host and port.";
    }
    if (lower.includes("senderrefused") || lower.includes("553") ||
        lower.includes("not allowed") || lower.includes("not verified")) {
      return "The server refused the From address. Most providers only let " +
             "you send from an address or domain you have verified with them.";
    }
    if (lower.includes("starttls") || lower.includes("ssl") ||
        lower.includes("wrong version number")) {
      return "The connection could not be secured. This app uses STARTTLS, " +
             "which is normally port 587 rather than 465.";
    }
    return "";
  }

  // ---------- load ----------

  async function load() {
    els.loading.hidden = false;
    els.wizard.hidden = true;

    let result;
    try {
      result = await api("/admin/settings", { method: "GET" });
    } catch (_) {
      els.loading.hidden = true;
      showBanner(await diagnose(), "error");
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
        data.message || `Could not load settings (HTTP ${response.status}).`,
        "error"
      );
      return;
    }

    MASK = data.mask || MASK;
    bootId = data.boot_id || null;

    const flat = {};
    (data.groups || []).forEach(group =>
      group.fields.forEach(field => (flat[field.key] = field))
    );

    els.storeName.value = (flat.STORE_NAME && flat.STORE_NAME.value) || "";
    els.emailFrom.value = (flat.EMAIL_FROM && flat.EMAIL_FROM.value) || "";
    els.emailUsername.value =
      (flat.EMAIL_USERNAME && flat.EMAIL_USERNAME.value) || "";
    els.emailHost.value = (flat.EMAIL_HOST && flat.EMAIL_HOST.value) || "";
    els.emailPort.value = (flat.EMAIL_PORT && flat.EMAIL_PORT.value) || "587";

    passwordStored = !!(flat.EMAIL_PASSWORD && flat.EMAIL_PASSWORD.has_value);
    passwordTouched = false;
    els.emailPassword.value = "";
    els.emailPassword.placeholder = passwordStored
      ? "Already saved — type a new one to replace it"
      : "";

    els.testRecipient.value = els.emailFrom.value || els.emailUsername.value;

    renderProviders();
    const guessed = guessProvider(els.emailHost.value);
    if (guessed) selectProvider(guessed.id, false);

    els.loading.hidden = true;
    els.wizard.hidden = false;

    if (passwordStored) {
      showBanner(
        "Email is already configured. Send a test to check it still works, " +
          "or enter new details to replace it.",
        "success"
      );
    }
  }

  // ---------- test ----------

  async function sendTest() {
    clearErrors();
    const recipient = els.testRecipient.value.trim();
    if (!recipient) {
      els.testResult.hidden = false;
      els.testResult.className = "mail-test-result bad";
      els.testResult.textContent = "Enter an address to send the test to.";
      return;
    }

    els.testBtn.disabled = true;
    els.testResult.hidden = false;
    els.testResult.className = "mail-test-result";
    els.testResult.textContent = "Sending...";

    let result;
    try {
      result = await api("/admin/settings/test-email", {
        method: "POST",
        body: JSON.stringify({ recipient, values: values() }),
      });
    } catch (_) {
      els.testBtn.disabled = false;
      els.testResult.className = "mail-test-result bad";
      els.testResult.textContent = await diagnose();
      return;
    }

    const { response, data } = result;
    els.testBtn.disabled = false;

    if (response.status === 401) {
      sessionStorage.removeItem("token");
      window.location.replace("../page/login.html");
      return;
    }

    if (data.success) {
      testPassed = true;
      els.saveBtn.disabled = false;
      els.skipTest.hidden = true;
      els.status.textContent = "";
      els.testResult.className = "mail-test-result ok";
      els.testResult.textContent =
        `Sent to ${recipient}. Check the inbox, and the spam folder. ` +
        "Once you see it, save below.";
      return;
    }

    testPassed = false;
    els.saveBtn.disabled = true;
    els.skipTest.hidden = false;
    els.testResult.className = "mail-test-result bad";
    els.testResult.textContent = data.message || `HTTP ${response.status}`;

    const advice = explain(data.message);
    if (advice) {
      const line = document.createElement("span");
      line.className = "fix";
      line.textContent = advice;
      els.testResult.appendChild(line);
    }
  }

  // ---------- save ----------

  async function save() {
    clearErrors();
    els.saveBtn.disabled = true;
    els.skipTest.disabled = true;
    els.status.textContent = "Saving...";

    let result;
    try {
      result = await api("/admin/settings", {
        method: "POST",
        body: JSON.stringify({ values: values(), restart: true }),
      });
    } catch (_) {
      els.saveBtn.disabled = false;
      els.skipTest.disabled = false;
      els.status.textContent = "";
      showBanner(await diagnose(), "error");
      return;
    }

    const { response, data } = result;

    if (response.status === 401) {
      sessionStorage.removeItem("token");
      window.location.replace("../page/login.html");
      return;
    }

    if (!response.ok || !data.success) {
      els.saveBtn.disabled = false;
      els.skipTest.disabled = false;
      els.status.textContent = "";
      showFieldErrors(data.errors);
      showBanner(
        data.message || `Save failed (HTTP ${response.status}). Nothing changed.`,
        "error"
      );
      return;
    }

    els.status.textContent = "Restarting the server...";
    const restarted = await waitForRestart(data.boot_id || bootId, 30000);
    els.skipTest.disabled = false;
    els.status.textContent = "";

    if (!restarted) {
      showBanner(
        "Saved, but the server did not finish restarting within 30 seconds. " +
          "Check the terminal running app.py.",
        "error"
      );
      els.saveBtn.disabled = false;
      return;
    }

    showBanner(
      "Email is set up. Registration and password-reset emails will now be " +
        "sent from this account.",
      "success"
    );
    await load();
  }

  async function waitForRestart(previous, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    await sleep(1200);
    while (Date.now() < deadline) {
      try {
        const response = await fetch(API + "/admin/settings/boot", {
          cache: "no-store",
        });
        if (response.ok) {
          const data = await response.json();
          if (data.boot_id && data.boot_id !== previous) {
            bootId = data.boot_id;
            return true;
          }
        }
      } catch (_) {
        /* mid-restart */
      }
      await sleep(600);
    }
    return false;
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ---------- wiring ----------

  els.emailPassword.addEventListener("input", () => {
    passwordTouched = true;
    invalidateTest();
  });

  [els.emailUsername, els.emailHost, els.emailPort, els.emailFrom].forEach(
    input => input.addEventListener("input", invalidateTest)
  );

  els.togglePassword.addEventListener("click", () => {
    const hidden = els.emailPassword.type === "password";
    els.emailPassword.type = hidden ? "text" : "password";
    els.togglePassword.textContent = hidden ? "Hide" : "Show";
  });

  els.advancedToggle.addEventListener("click", () => {
    const open = els.advanced.hidden;
    els.advanced.hidden = !open;
    els.advancedToggle.classList.toggle("open", open);
  });

  els.testBtn.addEventListener("click", sendTest);
  els.saveBtn.addEventListener("click", save);
  els.skipTest.addEventListener("click", () => {
    els.saveBtn.disabled = false;
    save();
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
