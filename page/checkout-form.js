// ===== Payment Options Toggle =====
var paymentOptions = document.querySelectorAll(".payment-option");
var cardDetails = document.getElementById("cardDetails");

paymentOptions.forEach(function (option) {
  option.addEventListener("click", function () {
    paymentOptions.forEach(function (o) {
      o.classList.remove("selected");
    });
    option.classList.add("selected");
    var method = option.getAttribute("data-method");
    if (method === "card") {
      cardDetails.classList.add("visible");
    } else {
      cardDetails.classList.remove("visible");
    }
  });
});

// ===== Card Number Formatting =====
var cardInput = document.querySelector(
  '#cardDetails input[placeholder*="1234"]',
);
if (cardInput) {
  cardInput.addEventListener("input", function (e) {
    var value = e.target.value.replace(/\D/g, "");
    value = value.substring(0, 16);
    var formatted = value.replace(/(.{4})/g, "$1 ").trim();
    e.target.value = formatted;
  });
}

// ===== Expiry Date Formatting =====
var expiryInput = document.querySelector(
  '#cardDetails input[placeholder*="MM"]',
);
if (expiryInput) {
  expiryInput.addEventListener("input", function (e) {
    var value = e.target.value.replace(/\D/g, "");
    value = value.substring(0, 4);
    if (value.length >= 2) {
      value = value.substring(0, 2) + " / " + value.substring(2);
    }
    e.target.value = value;
  });
}

// ===== CVV Formatting =====
var cvvInput = document.querySelector('#cardDetails input[placeholder*="123"]');
if (cvvInput) {
  cvvInput.addEventListener("input", function (e) {
    e.target.value = e.target.value.replace(/\D/g, "").substring(0, 4);
  });
}

// ===== Confirm Button =====
var confirmBtn = document.querySelector(".checkout-btn-primary");
if (confirmBtn) {
  confirmBtn.addEventListener("click", function () {
    var formSection = document.querySelector(".checkout-form-sections");
    var inputs = formSection.querySelectorAll(
      "input[required], select[required]",
    );
    var allFilled = true;

    inputs.forEach(function (input) {
      if (!input.value.trim()) {
        allFilled = false;
        input.style.borderColor = "#ef4444";
        input.style.boxShadow = "0 0 0 3px rgba(239, 68, 68, 0.1)";
        input.addEventListener("focus", function handler() {
          input.style.borderColor = "";
          input.style.boxShadow = "";
          input.removeEventListener("focus", handler);
        });
      }
    });

    // Validate map selection
    var mapLat = document.getElementById("mapLat");
    var mapContainer = document.getElementById("mapContainer");
    if (mapLat && !mapLat.value.trim() && mapContainer) {
      allFilled = false;
      mapContainer.style.borderColor = "#ef4444";
      mapContainer.style.boxShadow = "0 0 0 3px rgba(239, 68, 68, 0.1)";
      mapContainer.addEventListener("click", function handler() {
        mapContainer.style.borderColor = "";
        mapContainer.style.boxShadow = "";
        mapContainer.removeEventListener("click", handler);
      });
    }

    if (!allFilled) {
      var firstEmpty = Array.from(inputs).find(function (i) {
        return !i.value.trim();
      });
      if (firstEmpty) {
        firstEmpty.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
        firstEmpty.focus();
      } else if (mapLat && !mapLat.value.trim() && mapContainer) {
        mapContainer.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
      return;
    }

    confirmBtn.innerHTML =
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg> Order Placed Successfully!';
    confirmBtn.style.background =
      "linear-gradient(135deg, #16a34a 0%, #22c55e 100%)";
    confirmBtn.style.pointerEvents = "none";

    var steps = document.querySelectorAll(".step");
    steps[1].classList.remove("active");
    steps[1].classList.add("completed");
    steps[1].querySelector(".step-num").innerHTML =
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';
    steps[2].classList.add("active");
  });
}
