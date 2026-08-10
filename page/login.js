const API_BASE = "http://127.0.0.1:5000";

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
  const isRegister = mode === "register";

  /* --- Text updates --- */
  title.textContent = isRegister ? "Create account" : "Login";
  submitButton.textContent = isRegister ? "Create account" : "Login";

  /* --- Tab active classes --- */
  loginTab.classList.toggle("active", !isRegister);
  registerTab.classList.toggle("active", isRegister);

  /* --- Card mode class (shifts accent bar + button color) --- */
  authBox.classList.toggle("mode-register", isRegister);

  /* --- Register fields slide animation --- */
  if (isRegister) {
    registerFields.style.display = "block";
    // Force reflow so the animation replays every time
    void registerFields.offsetWidth;
    registerFields.classList.add("show");
  } else {
    registerFields.classList.remove("show");
    registerFields.style.display = "none";
  }

  username.required = isRegister;

  /* --- Clear message --- */
  message.className = "";
  message.textContent = "";
}

/* Initialize tab state on load */
loginTab.classList.add("active");

loginTab.addEventListener("click", () => setMode("login"));
registerTab.addEventListener("click", () => setMode("register"));

function showMessage(text, type) {
  message.textContent = text;
  message.className = "visible " + type; // "visible error" or "visible success"
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  /* --- Loading state --- */
  submitButton.classList.add("loading");
  submitButton.disabled = true;
  message.className = "";
  message.textContent = "Please wait...";

  try {
    const body = mode === "register"
      ? { username: username.value.trim(), email: email.value.trim(), password: password.value }
      : { email: email.value.trim(), password: password.value };

    const response = await fetch(`${API_BASE}/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!response.ok || !data.success || !data.token) {
      showMessage(data.message || "Authentication failed.", "error");
      return;
    }

    showMessage("Success! Redirecting...", "success");
    localStorage.setItem("token", data.token);
    localStorage.setItem("auth_user", JSON.stringify(data.user));

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
    submitButton.classList.remove("loading");
    submitButton.disabled = false;
  }
});