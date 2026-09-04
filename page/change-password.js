if (!Auth.requireUser()) throw new Error("Authentication required.");

const form = document.getElementById("changeForm");
const currentPassword = document.getElementById("currentPassword");
const newPassword = document.getElementById("newPassword");
const confirmPassword = document.getElementById("confirmPassword");
const message = document.getElementById("message");
const strength = document.getElementById("strength");
const button = document.getElementById("submitButton");

newPassword.addEventListener("input", () => {
  const p = newPassword.value;
  strength.textContent =
    p.length < 8 ? "Too short" :
    /[A-Z]/.test(p) && /\d/.test(p) && /[^A-Za-z0-9]/.test(p) ? "Strong" :
    /[A-Z]/.test(p) && /\d/.test(p) ? "Good" : "Weak";
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (newPassword.value !== confirmPassword.value) {
    message.textContent = "New passwords do not match.";
    return;
  }

  button.disabled = true;
  try {
    const response = await Auth.fetch(`${API}/change-password`, {
      method: "POST",
      headers: {"Content-Type": "application/json", Authorization: `Bearer ${Auth.getToken()}`},
      body: JSON.stringify({
        current_password: currentPassword.value,
        new_password: newPassword.value
      })
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok && data.success) {
      Auth.setSession(data);
      message.textContent = "Password changed successfully.";
      form.reset();
    } else {
      message.textContent = data.message || "Could not change password.";
    }
  } catch (_) {
    message.textContent = "Could not connect to the server.";
  } finally {
    button.disabled = false;
  }
});
