const API_BASE = (window.SHOP_API_BASE || (location.port === "5500" ? `${location.protocol}//${location.hostname}:5000` : ""));

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

let mode = "login";

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
loginTab.classList.add("active");

loginTab.addEventListener("click", () => setMode("login"));
registerTab.addEventListener("click", () => setMode("register"));

function showMessage(text, type) {
  message.textContent = text;
  message.className = "visible " + type;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

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

    const response = await fetch(`${API_BASE}/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok || !data.success || !data.token) {
      showMessage(data.message || "Authentication failed.", "error");
      return;
    }

    showMessage("Success! Redirecting...", "success");
    sessionStorage.setItem("token", data.token);
    sessionStorage.setItem("auth_user", JSON.stringify(data.user));

    // Brief pause so the user sees the success message
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
  }
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
    const apiResponse = await fetch(`${API_BASE}/google-login`, {
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

const forgotPasswordLink=document.getElementById("forgotPasswordLink");
forgotPasswordLink?.addEventListener("click",async()=>{const email=(document.getElementById("email")?.value||"").trim();if(!email){showMessage("Enter your email first.","error");return;}try{const r=await fetch(`${API_BASE}/forgot-password`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email})});const d=await r.json();showMessage(d.message||"Check your email.",r.ok?"success":"error")}catch(e){showMessage("Could not connect to the server.","error")}});
