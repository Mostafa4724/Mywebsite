/* Admin .env editor.
 *
 * The form is built from the schema the server sends, so this file never
 * needs to know which settings exist. Secret values arrive masked and are
 * only sent back when the admin actually types a new one.
 */

(function () {
  "use strict";

  const banner = document.getElementById("banner");
  const loading = document.getElementById("loading");
  const form = document.getElementById("settingsForm");
  const groupsBox = document.getElementById("groups");
  const statusText = document.getElementById("status");
  const saveBtn = document.getElementById("saveBtn");
  const saveOnlyBtn = document.getElementById("saveOnlyBtn");
  const reloadBtn = document.getElementById("reloadBtn");
  const envPathLabel = document.getElementById("envPath");

  const testModal = document.getElementById("testModal");
  const testRecipient = document.getElementById("testRecipient");
  const testResult = document.getElementById("testResult");

  let MASK = "********";
  let schema = [];
  let bootId = null;

  function token() {
    return sessionStorage.getItem("token") || "";
  }

  function requireAdmin() {
    if (!token()) {
      window.location.replace("../page/login.html");
      return false;
    }
    return true;
  }

  function showBanner(text, kind) {
    banner.textContent = text;
    banner.className = "settings-banner " + (kind || "");
    banner.hidden = false;
    banner.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function hideBanner() {
    banner.hidden = true;
  }

  function setStatus(text) {
    statusText.textContent = text || "";
  }

  function busy(state) {
    [saveBtn, saveOnlyBtn, reloadBtn].forEach(b => (b.disabled = state));
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

  // ---------- rendering ----------

  function fieldId(key) {
    return "f_" + key;
  }

  function randomSecret(length) {
    const alphabet =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, b => alphabet[b % alphabet.length]).join("");
  }

  function buildField(field) {
    const wrap = document.createElement("div");
    wrap.className = "settings-field";
    wrap.dataset.key = field.key;
    if (field.type === "textarea") wrap.classList.add("wide");

    const label = document.createElement("label");
    label.setAttribute("for", fieldId(field.key));
    label.textContent = field.label;
    if (field.required) {
      const star = document.createElement("span");
      star.className = "req";
      star.textContent = "*";
      label.appendChild(star);
    }
    wrap.appendChild(label);

    const input =
      field.type === "textarea"
        ? document.createElement("textarea")
        : document.createElement("input");

    input.id = fieldId(field.key);
    input.name = field.key;
    input.value = field.value || "";
    input.dataset.secret = field.secret ? "1" : "";
    input.dataset.original = field.value || "";

    if (field.type !== "textarea") {
      input.type =
        field.type === "password"
          ? "password"
          : field.type === "number"
          ? "number"
          : "text"; // keep email/url as text so the browser never blocks a save
      if (field.type === "number") {
        if ("min" in field) input.min = field.min;
        if ("max" in field) input.max = field.max;
      }
    }
    if (field.placeholder) input.placeholder = field.placeholder;
    if (field.secret && field.has_value) {
      input.placeholder = "Saved - leave as is to keep it";
    }

    // Secret inputs start masked; clear on first focus so the admin never
    // accidentally submits the mask as a literal value.
    if (field.secret) {
      input.addEventListener("focus", function once() {
        if (input.value === MASK) input.value = "";
        input.removeEventListener("focus", once);
      });
    }

    const buttons = [];

    if (field.secret) {
      buttons.push(
        makeMini("Show", btn => {
          const hidden = input.type === "password";
          input.type = hidden ? "text" : "password";
          btn.textContent = hidden ? "Hide" : "Show";
        })
      );
    }

    if (field.key === "SECRET_KEY" || field.key === "JWT_SECRET_KEY") {
      buttons.push(
        makeMini("Generate", () => {
          input.value = randomSecret(48);
          input.type = "text";
          clearError(wrap);
        })
      );
    }

    if (field.key === "EMAIL_PASSWORD") {
      buttons.push(makeMini("Test email", () => openTestModal()));
    }

    if (buttons.length) {
      const row = document.createElement("div");
      row.className = "settings-input-row";
      row.appendChild(input);
      buttons.forEach(b => row.appendChild(b));
      wrap.appendChild(row);
    } else {
      wrap.appendChild(input);
    }

    if (field.help) {
      const hint = document.createElement("div");
      hint.className = "hint";
      hint.textContent = field.help;
      wrap.appendChild(hint);
    }

    const error = document.createElement("div");
    error.className = "error-text";
    error.hidden = true;
    wrap.appendChild(error);

    input.addEventListener("input", () => clearError(wrap));

    return wrap;
  }

  function makeMini(text, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "settings-mini";
    button.textContent = text;
    button.addEventListener("click", () => onClick(button));
    return button;
  }

  function clearError(wrap) {
    wrap.classList.remove("invalid");
    const error = wrap.querySelector(".error-text");
    if (error) error.hidden = true;
  }

  function showFieldErrors(errors) {
    Object.keys(errors || {}).forEach(key => {
      const wrap = groupsBox.querySelector(`[data-key="${CSS.escape(key)}"]`);
      if (!wrap) return;
      wrap.classList.add("invalid");
      const error = wrap.querySelector(".error-text");
      if (error) {
        error.textContent = errors[key];
        error.hidden = false;
      }
    });
    const first = groupsBox.querySelector(".settings-field.invalid");
    if (first) first.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function render(groups) {
    groupsBox.innerHTML = "";
    groups.forEach(group => {
      const section = document.createElement("section");
      section.className = "settings-group";

      const head = document.createElement("div");
      head.className = "settings-group-head";
      const title = document.createElement("h3");
      title.textContent = group.group;
      head.appendChild(title);
      if (group.note) {
        const note = document.createElement("p");
        note.textContent = group.note;
        head.appendChild(note);
      }
      section.appendChild(head);

      const body = document.createElement("div");
      body.className = "settings-group-body";
      group.fields.forEach(field => body.appendChild(buildField(field)));
      section.appendChild(body);

      groupsBox.appendChild(section);
    });
  }

  // ---------- values ----------

  function collect() {
    const values = {};
    groupsBox.querySelectorAll("input, textarea").forEach(input => {
      if (!input.name) return;
      const isSecret = input.dataset.secret === "1";
      const value = input.value;
      if (isSecret && value.trim() === "") {
        // Empty means "keep what is stored"; send the mask back.
        values[input.name] = input.dataset.original === MASK ? MASK : "";
      } else {
        values[input.name] = value;
      }
    });
    return values;
  }

  // ---------- load ----------

  async function load() {
    hideBanner();
    loading.hidden = false;
    form.hidden = true;

    try {
      const { response, data } = await api("/admin/settings", { method: "GET" });

      if (response.status === 401) {
        sessionStorage.removeItem("token");
        window.location.replace("../page/login.html");
        return;
      }
      if (response.status === 403) {
        loading.hidden = true;
        showBanner("This page is for admin accounts only.", "error");
        return;
      }
      if (!response.ok || !data.success) {
        loading.hidden = true;
        showBanner(
          data.message || `Could not load settings (HTTP ${response.status}).`,
          "error"
        );
        return;
      }

      MASK = data.mask || MASK;
      bootId = data.boot_id || bootId;
      schema = data.groups || [];
      envPathLabel.textContent = data.env_path || ".env";

      render(schema);
      loading.hidden = true;
      form.hidden = false;

      if (!data.env_exists) {
        showBanner(
          "No .env file exists yet. Fill in the required fields and save to " +
            "create one.",
          "warn"
        );
      }
    } catch (error) {
      console.error(error);
      loading.hidden = true;
      showBanner(await diagnose(), "error");
    }
  }

  /* A failed fetch looks identical whether the backend is down, the route is
   * missing, or CORS rejected the call. Probing a route that has always
   * existed tells those apart, which turns an unhelpful "could not reach the
   * server" into something actionable. */
  async function diagnose() {
    let alive = false;
    try {
      alive = (await fetch(API + "/", { cache: "no-store" })).ok;
    } catch (_) {
      alive = false;
    }

    if (!alive) {
      return (
        "Could not reach the backend at " + API + ". Start it with " +
        "`python app.py` in the backend folder, and check that Config.js " +
        "points at the right address."
      );
    }

    return (
      "The backend at " + API + " is running but has no /admin/settings " +
      "route. That means it is still running the old code: copy " +
      "backend/settings_admin.py into place, make sure app.py imports and " +
      "registers settings_bp, then stop and restart python app.py."
    );
  }

  // ---------- save ----------

  async function save(restart) {
    hideBanner();
    groupsBox
      .querySelectorAll(".settings-field")
      .forEach(wrap => clearError(wrap));

    busy(true);
    setStatus("Saving...");

    let result;
    try {
      result = await api("/admin/settings", {
        method: "POST",
        body: JSON.stringify({ values: collect(), restart: !!restart }),
      });
    } catch (error) {
      console.error(error);
      busy(false);
      setStatus("");
      showBanner("Could not reach the server.", "error");
      return;
    }

    const { response, data } = result;

    if (response.status === 401) {
      sessionStorage.removeItem("token");
      window.location.replace("../page/login.html");
      return;
    }

    if (!response.ok || !data.success) {
      busy(false);
      setStatus("");
      showFieldErrors(data.errors);
      showBanner(
        data.message || `Save failed (HTTP ${response.status}). Nothing changed.`,
        "error"
      );
      return;
    }

    if (!restart) {
      busy(false);
      setStatus("");
      showBanner(
        "Saved to .env. Restart the server for the changes to take effect.",
        "success"
      );
      await load();
      return;
    }

    setStatus("Restarting the server...");
    const backUp = await waitForRestart(data.boot_id || bootId, 30000);
    busy(false);
    setStatus("");

    if (!backUp) {
      showBanner(
        "The settings were saved but the server did not finish restarting " +
          "within 30 seconds. Check the terminal running app.py - a bad value " +
          "can stop it from starting. The previous file is saved as .env.bak.",
        "error"
      );
      return;
    }

    if (data.signed_out) {
      showBanner(
        "Saved and restarted. The security keys changed, so every session " +
          "including yours is now invalid. Redirecting to the login page...",
        "warn"
      );
      setTimeout(() => {
        sessionStorage.removeItem("token");
        window.location.replace("../page/login.html");
      }, 3000);
      return;
    }

    showBanner("Saved and the server restarted successfully.", "success");
    await load();
  }

  /* The dev reloader hands the listening socket to a fresh child process, so
   * the port never actually goes quiet during a restart. Polling for "is it
   * up" would therefore return true instantly against the process that is
   * about to die. Watching the per-process boot id change is the only honest
   * signal that the new configuration is the one now being served. */
  async function waitForRestart(previousBootId, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    await sleep(1200);
    while (Date.now() < deadline) {
      try {
        const response = await fetch(API + "/admin/settings/boot", {
          cache: "no-store",
        });
        if (response.ok) {
          const data = await response.json();
          if (data.boot_id && data.boot_id !== previousBootId) {
            bootId = data.boot_id;
            return true;
          }
        }
      } catch (_) {
        /* mid-restart, keep waiting */
      }
      await sleep(600);
    }
    return false;
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ---------- test email ----------

  function openTestModal() {
    testResult.hidden = true;
    testResult.textContent = "";
    const from = document.getElementById(fieldId("EMAIL_FROM"));
    const user = document.getElementById(fieldId("EMAIL_USERNAME"));
    testRecipient.value =
      (from && from.value.trim()) || (user && user.value.trim()) || "";
    testModal.hidden = false;
    testRecipient.focus();
  }

  document.getElementById("testCancel").addEventListener("click", () => {
    testModal.hidden = true;
  });

  document.getElementById("testSend").addEventListener("click", async () => {
    const button = document.getElementById("testSend");
    button.disabled = true;
    testResult.hidden = false;
    testResult.className = "settings-modal-result";
    testResult.textContent = "Sending...";

    try {
      const { response, data } = await api("/admin/settings/test-email", {
        method: "POST",
        body: JSON.stringify({
          recipient: testRecipient.value.trim(),
          values: collect(),
        }),
      });
      testResult.className =
        "settings-modal-result " + (data.success ? "ok" : "bad");
      testResult.textContent =
        data.message || `HTTP ${response.status}`;
    } catch (error) {
      testResult.className = "settings-modal-result bad";
      testResult.textContent = await diagnose();
    } finally {
      button.disabled = false;
    }
  });

  // ---------- wiring ----------

  form.addEventListener("submit", event => {
    event.preventDefault();
    save(true);
  });

  saveOnlyBtn.addEventListener("click", () => save(false));
  reloadBtn.addEventListener("click", () => load());

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

  if (requireAdmin()) load();
})();
