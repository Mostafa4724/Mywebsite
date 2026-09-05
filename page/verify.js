const choicesBox = document.getElementById("verificationChoices");
const message = document.getElementById("verificationMessage");
const backButton = document.getElementById("backToRegister");
const resendButton = document.getElementById("resendCode");
const STATE_KEY = "pending_registration_verification";

let verificationId = 0;
let choices = [];

function setMessage(text, type = "") {
  message.textContent = text;
  message.className = type ? `visible ${type}` : "visible";
}

function clearState() {
  try { localStorage.removeItem(STATE_KEY); } catch (_) {}
}

function saveState() {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify({
      verification_id: verificationId,
      choices,
      saved_at: Date.now()
    }));
  } catch (_) {}
}

function backToRegister(delay = 1800) {
  clearState();
  setTimeout(() => window.location.replace("login.html?mode=register"), delay);
}

// Only the id is taken from the URL / stored state. The numbers themselves
// always come from the server, so stale state can never be displayed.
function readVerificationId() {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = Number(params.get("verification_id"));
  if (fromUrl > 0) return fromUrl;

  try {
    const state = JSON.parse(localStorage.getItem(STATE_KEY) || "null");
    if (state && Number(state.verification_id) > 0) {
      if (Date.now() - Number(state.saved_at || 0) <= 15 * 60 * 1000) {
        return Number(state.verification_id);
      }
    }
  } catch (_) {}
  return 0;
}

function renderChoices() {
  choicesBox.innerHTML = "";
  choices.forEach(choice => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "verification-choice";
    button.textContent = choice;
    button.addEventListener("click", () => verify(choice));
    choicesBox.appendChild(button);
  });
}

function syncUrl() {
  const url = new URL(window.location.href);
  url.searchParams.set("verification_id", String(verificationId));
  url.searchParams.delete("choices"); // no longer authoritative
  window.history.replaceState(null, "", url.toString());
}

function applyServerChoices(data) {
  verificationId = Number(data.verification_id);
  choices = data.choices.map(String);
  renderChoices();
  saveState();
  syncUrl();
}

async function loadVerification() {
  verificationId = readVerificationId();

  if (!verificationId) {
    clearState();
    setMessage("This verification page is invalid or expired.", "error");
    if (resendButton) resendButton.disabled = true;
    return;
  }

  setMessage("Loading your verification numbers...");

  try {
    const response = await fetch(`${API}/register/verification/${verificationId}`);
    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success || !Array.isArray(data.choices) || data.choices.length !== 3) {
      setMessage(data.message || "This verification page is invalid or expired.", "error");
      if (resendButton) resendButton.disabled = true;
      if (data.restart === true) backToRegister();
      return;
    }

    applyServerChoices(data);
    setMessage("Check your email, then click the matching number.");
  } catch (error) {
    console.error("Could not load verification:", error);
    setMessage("Could not connect to the server.", "error");
  }
}

async function verify(code) {
  const buttons = choicesBox.querySelectorAll("button");
  buttons.forEach(b => b.disabled = true);
  if (resendButton) resendButton.disabled = true;
  setMessage("Verifying...");

  try {
    const response = await fetch(`${API}/register/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verification_id: verificationId, code: String(code) })
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success || !data.token) {
      setMessage(data.message || "Incorrect verification number.", "error");

      // Clear the pending state before leaving, otherwise login.html
      // redirects straight back here.
      if (data.restart === true) {
        backToRegister();
        return;
      }

      buttons.forEach(b => b.disabled = false);
      if (resendButton) resendButton.disabled = false;
      return;
    }

    clearState();
    Auth.setSession(data);
    setMessage("Verified! Creating your account and signing you in...", "success");

    setTimeout(() => {
      window.location.replace(
        data.user?.role === "admin" ? "../admin/dashboard.html" : "home.html"
      );
    }, 500);
  } catch (error) {
    console.error("Registration verification failed:", error);
    setMessage("Could not connect to the server.", "error");
    buttons.forEach(b => b.disabled = false);
    if (resendButton) resendButton.disabled = false;
  }
}

// A hashed code cannot be re-sent, so a resend issues a brand new number.
if (resendButton) {
  resendButton.addEventListener("click", async () => {
    if (!verificationId) {
      setMessage("Nothing to resend. Please register again.", "error");
      return;
    }

    resendButton.disabled = true;
    setMessage("Sending a new verification email...");

    try {
      const response = await fetch(`${API}/register/resend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verification_id: verificationId })
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success || !data.verification_id || !Array.isArray(data.choices)) {
        setMessage(
          data.message || `Could not resend the email (HTTP ${response.status}).`,
          "error"
        );
        if (data.restart === true) backToRegister();
        return;
      }

      applyServerChoices(data);
      setMessage("New email sent. Click the number it contains.", "success");
    } catch (error) {
      console.error("Resend failed:", error);
      setMessage("Could not connect to the server.", "error");
    } finally {
      resendButton.disabled = false;
    }
  });
}

backButton.addEventListener("click", () => {
  clearState();
  window.location.replace("login.html?mode=register");
});

loadVerification();