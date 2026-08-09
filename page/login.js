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

    localStorage.setItem("token", data.token);
    localStorage.setItem("auth_user", JSON.stringify(data.user));

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
