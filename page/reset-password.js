const token = new URLSearchParams(location.search).get("token") || "";
const form = document.getElementById("resetForm");
const password = document.getElementById("password");
const confirmPassword = document.getElementById("confirmPassword");
const status = document.getElementById("status");
const message = document.getElementById("message");
const strength = document.getElementById("strength");
const button = document.getElementById("submitButton");

function passwordStrength(value) {
  let score = 0;
  if (value.length >= 8) score++;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score++;
  if (/\d/.test(value)) score++;
  if (/[^A-Za-z0-9]/.test(value)) score++;
  return ["Too short", "Weak", "Fair", "Good", "Strong"][score];
}

password.addEventListener("input", () => {
  strength.textContent = passwordStrength(password.value);
});

(async () => {
  if (!token) {
    status.textContent = "This reset link is missing.";
    return;
  }

  try {
    const response = await fetch(`${API}/reset-password/check?token=${encodeURIComponent(token)}`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.valid) {
      status.textContent = data.message || "This reset link is invalid or expired.";
      return;
    }
    status.hidden = true;
    form.hidden = false;
  } catch (_) {
    status.textContent = "Could not verify the reset link.";
  }
})();

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  message.textContent = "";

  if (password.value !== confirmPassword.value) {
    message.textContent = "Passwords do not match.";
    return;
  }

  button.disabled = true;
  try {
    const response = await fetch(`${API}/reset-password`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({token, password: password.value})
    });
    const data = await response.json().catch(() => ({}));
    message.textContent = data.message || "Done.";
    if (response.ok && data.success) {
      setTimeout(() => location.href = "login.html", 1000);
    }
  } catch (_) {
    message.textContent = "Could not connect to the server.";
  } finally {
    button.disabled = false;
  }
});
