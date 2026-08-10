const API_BASE = "http://127.0.0.1:5000";

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

let mode = "login";

function setMode(next) {
  mode = next;
  const register = mode === "register";
  title.textContent = register ? "Create account" : "Login";
  submitButton.textContent = register ? "Create account" : "Login";
  registerFields.style.display = register ? "block" : "none";
  username.required = register;
  message.textContent = "";
}

loginTab.addEventListener("click", () => setMode("login"));
registerTab.addEventListener("click", () => setMode("register"));

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  message.textContent = "Please wait...";
  submitButton.disabled = true;

  try {
    const body = mode === "register"
      ? { username: username.value.trim(), email: email.value.trim(), password: password.value }
      : { email: email.value.trim(), password: password.value };

    const response = await fetch(`${API_BASE}/${mode}`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!response.ok || !data.success || !data.token) {
      message.textContent = data.message || "Authentication failed.";
      return;
    }

    sessionStorage.setItem("token", data.token);
    sessionStorage.setItem("auth_user", JSON.stringify(data.user));

    // Backend decides the role; frontend only chooses the appropriate UI.
    if (data.user.role === "admin") {
      window.location.href = "../admin/dashboard.html";
    } else {
      window.location.href = "../page/home.html";
    }
  } catch (error) {
    console.error(error);
    message.textContent = "Could not connect to the server.";
  } finally {
    submitButton.disabled = false;
  }
});


// ---------------------------------------------------------------------------
// Sign in with Google (Google Identity Services)
// ---------------------------------------------------------------------------
const googleSignIn = document.getElementById("googleSignIn");
const googleHelp = document.getElementById("googleHelp");

async function handleGoogleCredentialResponse(response) {
  if (!response || !response.credential) {
    if (googleHelp) googleHelp.textContent = "Google did not return a credential.";
    return;
  }

  if (googleHelp) googleHelp.textContent = "Signing in with Google...";

  try {
    const apiResponse = await fetch(`${API_BASE}/google-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential: response.credential })
    });

    const data = await apiResponse.json();
    if (!apiResponse.ok || !data.success || !data.token) {
      if (googleHelp) googleHelp.textContent = data.message || "Google sign-in failed.";
      return;
    }

    sessionStorage.setItem("token", data.token);
    sessionStorage.setItem("auth_user", JSON.stringify(data.user));

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
    const response = await fetch(`${API_BASE}/google-config`);
    const config = await response.json();

    if (!response.ok || !config.success || !config.client_id) {
      if (googleHelp) {
        googleHelp.textContent =
          "Google Sign-In is not configured yet. Set GOOGLE_CLIENT_ID in the backend environment.";
      }
      return;
    }

    const waitForGoogle = () => {
      if (!window.google || !window.google.accounts || !window.google.accounts.id) {
        setTimeout(waitForGoogle, 100);
        return;
      }

      window.google.accounts.id.initialize({
        client_id: config.client_id,
        callback: handleGoogleCredentialResponse,
        ux_mode: "popup"
      });

      window.google.accounts.id.renderButton(googleSignIn, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "rectangular",
        width: 320
      });

      if (googleHelp) googleHelp.textContent = "";
    };

    waitForGoogle();
  } catch (error) {
    console.error("Failed to initialize Google Sign-In:", error);
    if (googleHelp) googleHelp.textContent = "Google Sign-In is unavailable while the server is offline.";
  }
}

initializeGoogleSignIn();
