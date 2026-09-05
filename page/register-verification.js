const choicesBox = document.getElementById("verificationChoices");
const message = document.getElementById("verificationMessage");
const backButton = document.getElementById("backToRegister");
const STATE_KEY = "pending_registration_verification";

function setMessage(text, type = "") {
  message.textContent = text;
  message.className = type ? `visible ${type}` : "visible";
}

function clearState() {
  try { localStorage.removeItem(STATE_KEY); } catch (_) {}
}

const params = new URLSearchParams(window.location.search);
const verificationId = Number(params.get("verification_id"));
const choices = (params.get("choices") || "").split(",").map(v => v.trim()).filter(Boolean);

if (!verificationId || choices.length !== 3 || choices.some(v => !/^\d{2}$/.test(v))) {
  clearState();
  setMessage("This verification page is invalid or expired.", "error");
  choicesBox.innerHTML = "";
} else {
  setMessage("Check your email, then click the matching number.");
  choices.forEach(choice => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "verification-choice";
    button.textContent = choice;
    button.addEventListener("click", () => verify(choice));
    choicesBox.appendChild(button);
  });
}

async function verify(code) {
  const buttons = choicesBox.querySelectorAll("button");
  buttons.forEach(b => b.disabled = true);
  setMessage("Verifying...");

  try {
    const response = await fetch(`${API}/register/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verification_id: verificationId, code })
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success || !data.token) {
      setMessage(data.message || "Incorrect verification number.", "error");
      buttons.forEach(b => b.disabled = false);
      return;
    }

    clearState();
    setMessage("Email verified! Your account has been created.", "success");
    Auth.setSession(data);
    setTimeout(() => {
      window.location.replace(data.user && data.user.role === "admin" ? "../admin/dashboard.html" : "home.html");
    }, 500);
  } catch (error) {
    console.error("Registration verification failed:", error);
    setMessage("Could not connect to the server.", "error");
    buttons.forEach(b => b.disabled = false);
  }
}

backButton.addEventListener("click", () => {
  clearState();
  window.location.replace("login.html?mode=register");
});
