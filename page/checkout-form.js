/* ===== Checkout Form Field Validation ===== */
(function () {
  // ── Phone: numbers only ──────────────────────────────────

  var phoneInput = document.getElementById("phoneInput");
  var phoneError = document.getElementById("phoneError");

  if (phoneInput && phoneError) {
    phoneInput.addEventListener("input", function () {
      this.value = this.value.replace(/[^0-9]/g, "");
    });

    phoneInput.addEventListener("blur", function () {
      var val = this.value.trim();
      if (val.length > 0 && val.length < 7) {
        this.classList.add("input-error");
        this.classList.remove("input-valid");
        phoneError.textContent = "Please enter a valid phone number.";
        phoneError.classList.add("visible");
      } else if (val.length >= 7) {
        this.classList.remove("input-error");
        this.classList.add("input-valid");
        phoneError.classList.remove("visible");
      } else {
        this.classList.remove("input-error", "input-valid");
        phoneError.classList.remove("visible");
      }
    });
  }

  // ── Card Number: numbers only with auto-spacing ──────────

  var cardNumberInput = document.getElementById("cardNumberInput");
  var cardNumberError = document.getElementById("cardNumberError");

  if (cardNumberInput && cardNumberError) {
    cardNumberInput.addEventListener("input", function () {
      var raw = this.value.replace(/[^0-9]/g, "");
      if (raw.length > 16) raw = raw.slice(0, 16);
      var formatted = raw.replace(/(\d{4})(?=\d)/g, "$1 ");
      this.value = formatted;
      this.classList.remove("input-error", "input-valid");
      cardNumberError.classList.remove("visible");
    });

    cardNumberInput.addEventListener("blur", function () {
      var digits = this.value.replace(/[^0-9]/g, "");
      if (digits.length > 0 && digits.length < 13) {
        this.classList.add("input-error");
        this.classList.remove("input-valid");
        cardNumberError.textContent = "Card number must be at least 13 digits.";
        cardNumberError.classList.add("visible");
      } else if (digits.length >= 13) {
        this.classList.remove("input-error");
        this.classList.add("input-valid");
        cardNumberError.classList.remove("visible");
      } else {
        this.classList.remove("input-error", "input-valid");
        cardNumberError.classList.remove("visible");
      }
    });
  }

  // ── Expiry: numbers only with auto-format MM / YY ───────

  var expiryInput = document.getElementById("expiryInput");
  var expiryError = document.getElementById("expiryError");

  if (expiryInput && expiryError) {
    expiryInput.addEventListener("input", function () {
      var raw = this.value.replace(/[^0-9]/g, "");
      if (raw.length > 4) raw = raw.slice(0, 4);
      if (raw.length >= 3) {
        this.value = raw.slice(0, 2) + " / " + raw.slice(2);
      } else {
        this.value = raw;
      }
      this.classList.remove("input-error", "input-valid");
      expiryError.classList.remove("visible");
    });

    expiryInput.addEventListener("blur", function () {
      var digits = this.value.replace(/[^0-9]/g, "");
      if (digits.length > 0 && digits.length < 4) {
        this.classList.add("input-error");
        this.classList.remove("input-valid");
        expiryError.textContent = "Enter full expiry (MM / YY).";
        expiryError.classList.add("visible");
      } else if (digits.length === 4) {
        var month = parseInt(digits.slice(0, 2), 10);
        if (month < 1 || month > 12) {
          this.classList.add("input-error");
          this.classList.remove("input-valid");
          expiryError.textContent = "Month must be 01\u201312.";
          expiryError.classList.add("visible");
        } else {
          this.classList.remove("input-error");
          this.classList.add("input-valid");
          expiryError.classList.remove("visible");
        }
      } else {
        this.classList.remove("input-error", "input-valid");
        expiryError.classList.remove("visible");
      }
    });
  }

  // ── CVV: numbers only ───────────────────────────────────

  var cvvInput = document.getElementById("cvvInput");
  var cvvError = document.getElementById("cvvError");

  if (cvvInput && cvvError) {
    cvvInput.addEventListener("input", function () {
      this.value = this.value.replace(/[^0-9]/g, "");
      this.classList.remove("input-error", "input-valid");
      cvvError.classList.remove("visible");
    });

    cvvInput.addEventListener("blur", function () {
      var val = this.value.trim();
      if (val.length > 0 && val.length < 3) {
        this.classList.add("input-error");
        this.classList.remove("input-valid");
        cvvError.textContent = "CVV must be 3 or 4 digits.";
        cvvError.classList.add("visible");
      } else if (val.length >= 3) {
        this.classList.remove("input-error");
        this.classList.add("input-valid");
        cvvError.classList.remove("visible");
      } else {
        this.classList.remove("input-error", "input-valid");
        cvvError.classList.remove("visible");
      }
    });
  }

  // ── Confirm button: validate everything before proceeding ─

  var confirmBtn = document.getElementById("confirmPayBtn");

  if (confirmBtn) {
    confirmBtn.addEventListener("click", async function () {
      // All fields that need blur-triggered validation
      var fieldsToCheck = [phoneInput, cardNumberInput, expiryInput, cvvInput];

      // Trigger blur on each field to run its validation
      fieldsToCheck.forEach(function (field) {
        if (field) {
          field.focus();
          field.blur();
        }
      });

      // Also run email validation via the CheckoutEmail module
      if (typeof CheckoutEmail !== "undefined" && CheckoutEmail.validate) {
        CheckoutEmail.validate();
      } else {
        // Fallback: blur the email input directly
        var emailEl = document.getElementById("checkoutEmail");
        if (emailEl) {
          emailEl.focus();
          emailEl.blur();
        }
      }

      // Small delay for all blur handlers to finish
      setTimeout(async function () {
        var errorEls = document.querySelectorAll(".field-error.visible");
        var inputErrors = document.querySelectorAll(".input-error");

        if (errorEls.length > 0 || inputErrors.length > 0) {
          var firstError = document.querySelector(".input-error");
          if (firstError) {
            firstError.scrollIntoView({ behavior: "smooth", block: "center" });
            firstError.focus();
          }
          return;
        }

        // All valid — place the order
        if (typeof placeOrder === "function") {
          const result = await placeOrder();
          if (result && result.success && result.order) {
            // Store the order ID for retrieval on order confirmation page
            sessionStorage.setItem("lastOrderId", result.order.id);
            window.location.href = "order-confirmation.html";
          } else {
            alert(result.message || "Failed to place order. Please try again.");
          }
        } else {
          // Fallback if placeOrder is not available
          window.location.href = "order-confirmation.html";
        }
      }, 120);
    });
  }
})();
