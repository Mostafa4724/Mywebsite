const authBox = document.querySelector(".auth-box");
const form = document.getElementById("authForm");
const title = document.getElementById("authTitle");
const registerFields = document.getElementById("registerFields");
const username = document.getElementById("username");
const email = document.getElementById("email");
const password = document.getElementById("password");
const message = document.getElementById("authMessage");
const submitButton = document.getElementById("submitButton");
const loginTab = document.getElementById("loginTab");
const registerTab = document.getElementById("registerTab");

let registrationSubmitting = false;
const REGISTRATION_STATE_KEY = "pending_registration_verification";

let mode = "login";

// verify.html is a sibling of login.html, so navigate to it directly.
// Only the id travels in the URL — verify.html fetches the current numbers
// from the server, so a stale link can never show outdated choices.
function verifyPageUrl(verificationId) {
  const params = new URLSearchParams();
  params.set("verification_id", String(verificationId));
  return `verify.html?${params.toString()}`;
}

function setMode(next) {
  mode = next;
  const register = mode === "register";
  title.textContent = register ? "Create account" : "Login";
  submitButton.textContent = register ? "Create account" : "Login";

  // --- Button Design Changes (Add/Remove CSS classes) ---
  loginTab.classList.toggle("active", !register);
  registerTab.classList.toggle("active", register);
  authBox.classList.toggle("mode-register", register);

  if (register) {
    registerFields.style.display = "block";
    void registerFields.offsetWidth;
    registerFields.classList.add("show");
  } else {
    registerFields.classList.remove("show");
    registerFields.style.display = "none";
  }

  username.required = register;
  password.minLength = register ? 8 : 1;

  message.className = "";
  message.textContent = "";
}

// Initialize tab state on load
const initialParams = new URLSearchParams(window.location.search);
if (initialParams.get("mode") === "register") {
  setMode("register");
} else {
  loginTab.classList.add("active");
}

// If registration verification is pending, always return to verify.html.
function restorePendingVerification() {
  try {
    const raw = localStorage.getItem(REGISTRATION_STATE_KEY);
    if (!raw) return;
    const state = JSON.parse(raw);
    if (!state || !state.verification_id || !Array.isArray(state.choices) || state.choices.length !== 3) {
      localStorage.removeItem(REGISTRATION_STATE_KEY);
      return;
    }
    if (Date.now() - Number(state.saved_at || 0) > 15 * 60 * 1000) {
      localStorage.removeItem(REGISTRATION_STATE_KEY);
      return;
    }
    window.location.replace(verifyPageUrl(state.verification_id));
  } catch (_) {
    try { localStorage.removeItem(REGISTRATION_STATE_KEY); } catch (_) {}
  }
}
restorePendingVerification();

loginTab.addEventListener("click", () => setMode("login"));
registerTab.addEventListener("click", () => setMode("register"));


function showMessage(text, type) {
  message.textContent = text;
  message.className = "visible " + type;
}

async function startAuthentication(event) {
  // Registration/login is intentionally handled only by JavaScript.
  // The submit button is type=button as an extra guard against the browser
  // performing a native form navigation/reload.
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  if (registrationSubmitting) return;
  registrationSubmitting = true;

  // --- Button Loading State Design ---
  submitButton.classList.add("loading");
  submitButton.disabled = true;
  message.className = "";
  message.textContent = "Please wait...";

  try {
    const body =
      mode === "register"
        ? {
            username: username.value.trim(),
            email: email.value.trim(),
            password: password.value,
          }
        : { email: email.value.trim(), password: password.value };

    const response = await fetch(`${API}/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    // A non-JSON body (500 page, proxy error) must not be swallowed as
    // "could not connect" — surface the real status instead.
    const data = await response.json().catch(() => ({}));

    if (mode === "register") {
      if (!response.ok || !data.success || !data.verification_id || !Array.isArray(data.choices)) {
        showMessage(
          data.message || `Could not start account verification (HTTP ${response.status}).`,
          "error"
        );
        return;
      }

      let choices = data.choices;
      if (typeof choices === "string") {
        try { choices = JSON.parse(choices); } catch (_) { choices = []; }
      }

      if (!Array.isArray(choices) || choices.length !== 3 || !data.verification_id) {
        showMessage("The server returned invalid verification information.", "error");
        return;
      }

      // Save the pending verification BEFORE navigating. verify.html can then
      // restore the exact request even if the browser reloads that page.
      localStorage.setItem(REGISTRATION_STATE_KEY, JSON.stringify({
        verification_id: data.verification_id,
        choices: choices.map(String),
        saved_at: Date.now()
      }));

      showMessage("Check your email. Opening the verification page...", "success");
      window.location.assign(verifyPageUrl(data.verification_id));
      return;
    }

    if (!response.ok || !data.success || !data.token) {
      showMessage(data.message || "Authentication failed.", "error");
      return;
    }

    showMessage("Success! Redirecting...", "success");
    Auth.setSession(data);

    setTimeout(() => {
      if (data.user.role === "admin") {
        window.location.href = "../admin/dashboard.html";
      } else {
        window.location.href = "../page/home.html";
      }
    }, 600);
  } catch (error) {
    console.error(error);
    showMessage("Could not connect to the server.", "error");
  } finally {
    // --- Remove Button Loading State Design ---
    submitButton.classList.remove("loading");
    submitButton.disabled = false;
    registrationSubmitting = false;
  }
}

// Never allow a native form submission to reload this page.
form.addEventListener("submit", (event) => {
  event.preventDefault();
  event.stopPropagation();
  startAuthentication(event);
});
submitButton.addEventListener("click", (event) => {
  startAuthentication(event);
});

// ===== Password Toggle =====
const passwordToggle = document.getElementById("passwordToggle");
if (passwordToggle) {
  passwordToggle.addEventListener("click", function (e) {
    e.preventDefault();
    const isPassword = password.type === "password";
    password.type = isPassword ? "text" : "password";

    const eyeIcon = passwordToggle.querySelector(".eye-icon");
    const eyeOffIcon = passwordToggle.querySelector(".eye-off-icon");

    if (isPassword) {
      eyeIcon.style.display = "none";
      eyeOffIcon.style.display = "block";
    } else {
      eyeIcon.style.display = "block";
      eyeOffIcon.style.display = "none";
    }
  });
}

// ---------------------------------------------------------------------------
// Sign in with Google (Google Identity Services)
// ---------------------------------------------------------------------------
const googleSignIn = document.getElementById("googleSignIn");
const googleHelp = document.getElementById("googleHelp");

async function handleGoogleCredentialResponse(response) {
  if (!response || !response.credential) {
    if (googleHelp)
      googleHelp.textContent = "Google did not return a credential.";
    return;
  }

  if (googleHelp) googleHelp.textContent = "Signing in with Google...";

  try {
    const apiResponse = await fetch(`${API}/google-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential: response.credential }),
    });

    const data = await apiResponse.json();
    if (!apiResponse.ok || !data.success || !data.token) {
      if (googleHelp)
        googleHelp.textContent = data.message || "Google sign-in failed.";
      return;
    }

    Auth.setSession(data);

    if (data.user.role === "admin") {
      window.location.href = "../admin/dashboard.html";
    } else {
      window.location.href = "../page/home.html";
    }
  } catch (error) {
    console.error("Google sign-in failed:", error);
    if (googleHelp) googleHelp.textContent = "Could not connect to the server.";
  }
}

async function initializeGoogleSignIn() {
  if (!googleSignIn) return;

  try {
    const response = await fetch(`${API}/google-config`);
    const config = await response.json();

    if (!response.ok || !config.success || !config.client_id) {
      if (googleHelp) {
        googleHelp.textContent =
          "Google Sign-In is not configured yet. Set GOOGLE_CLIENT_ID in the backend environment.";
      }
      return;
    }

    const waitForGoogle = () => {
      if (
        !window.google ||
        !window.google.accounts ||
        !window.google.accounts.id
      ) {
        setTimeout(waitForGoogle, 100);
        return;
      }

      window.google.accounts.id.initialize({
        client_id: config.client_id,
        callback: handleGoogleCredentialResponse,
        ux_mode: "popup",
      });

      window.google.accounts.id.renderButton(googleSignIn, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "rectangular",
        width: 320,
      });

      if (googleHelp) googleHelp.textContent = "";
    };

    waitForGoogle();
  } catch (error) {
    console.error("Failed to initialize Google Sign-In:", error);
    if (googleHelp)
      googleHelp.textContent =
        "Google Sign-In is unavailable while the server is offline.";
  }
}

initializeGoogleSignIn();