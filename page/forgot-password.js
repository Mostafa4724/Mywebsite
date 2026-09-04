const form = document.getElementById("forgotForm");
const email = document.getElementById("email");
const message = document.getElementById("message");
const button = document.getElementById("submitButton");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  button.disabled = true;
  message.textContent = "Please wait...";

  try {
    const response = await fetch(`${API}/forgot-password`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({email: email.value.trim()})
    });
    const data = await response.json().catch(() => ({}));
    message.textContent = data.message || "Check your email.";
    message.className = response.ok ? "success" : "error";
  } catch (_) {
    message.textContent = "Could not connect to the server.";
    message.className = "error";
  } finally {
    button.disabled = false;
  }
});
