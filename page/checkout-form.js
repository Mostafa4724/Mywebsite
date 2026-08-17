/* ===== Checkout Form — Validation + Order Placement ===== */
(function () {
  "use strict";

  // ─────────────────────────────────────────────────────────────
  //  gatherCheckoutCustomer()
  //  Called by placeOrder() in script.js to collect shipping info
  //  from the checkout form and send it to the backend.
  // ─────────────────────────────────────────────────────────────
  window.gatherCheckoutCustomer = function () {
    return {
      first_name: (document.getElementById("firstNameInput") || {}).value || "",
      last_name: (document.getElementById("lastNameInput") || {}).value || "",
      email: (document.getElementById("checkoutEmail") || {}).value || "",
      street: (document.getElementById("streetInput") || {}).value || "",
      architecture: (document.getElementById("architectureInput") || {}).value || "",
      floor: (document.getElementById("floorInput") || {}).value || "",
      phone: (document.getElementById("phoneInput") || {}).value || "",
      cardholder_name: (document.getElementById("cardholderInput") || {}).value || "",
      lat: (document.getElementById("mapLat") || {}).value || "",
      lng: (document.getElementById("mapLng") || {}).value || "",
    };
  };

  // ─────────────────────────────────────────────────────────────
  //  CheckoutEmail — email validation module
  //  Called by name from the confirm button handler so it must be
  //  exposed on window.
  // ─────────────────────────────────────────────────────────────
  window.CheckoutEmail = {
    validate: function () {
      var el = document.getElementById("checkoutEmail");
      var err = document.getElementById("emailError");
      if (!el) return true;

      var val = el.value.trim();
      var valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);

      if (val.length > 0 && !valid) {
        el.classList.add("input-error");
        el.classList.remove("input-valid");
        if (err) {
          err.textContent = "Please enter a valid email address.";
          err.classList.add("visible");
        }
        return false;
      }

      if (val.length > 0 && valid) {
        el.classList.remove("input-error");
        el.classList.add("input-valid");
        if (err) err.classList.remove("visible");
        return true;
      }

      // Empty — not yet touched, don't show error
      el.classList.remove("input-error", "input-valid");
      if (err) err.classList.remove("visible");
      return false;
    },
  };

  // Bind email blur
  var emailEl = document.getElementById("checkoutEmail");
  if (emailEl) {
    emailEl.addEventListener("blur", function () {
      CheckoutEmail.validate();
    });
  }

  async function loadBankTransferInstructions() {
    try {
      const response = await fetch("http://127.0.0.1:5000/payment-settings");
      const data = await response.json();
      if (!data.success) return;
      const bank = data.bank_transfer || {};
      const box = document.getElementById("transferInfo");
      if (!box) return;
      const rows = box.querySelectorAll(".bank-detail-row strong");
      if (rows[0]) rows[0].textContent = bank.bank_name || "Store bank account";
      if (rows[1]) rows[1].textContent = bank.account_name || "Configured store account";
      if (rows[2]) rows[2].textContent = bank.account_number || "Contact the store for account details";
      if (rows[3]) rows[3].textContent = bank.routing_number || "—";
      const note = box.querySelector(".bank-note");
      if (note) note.textContent = (bank.reference_note || "Use your order number as the transfer reference.") +
        " Your order stays pending until an admin verifies the transfer.";
    } catch (error) {
      console.warn("Bank transfer instructions unavailable:", error);
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  Payment Method Switching
  // ─────────────────────────────────────────────────────────────
  var paymentOptions = document.querySelectorAll(".payment-option");
  var cardDetails = document.getElementById("cardDetails");
  var transferInfo = document.getElementById("transferInfo");
  var codInfo = document.getElementById("codInfo");

  function showPaymentDetails(method) {
    if (method === "card") {
      if (cardDetails) cardDetails.classList.add("visible");
      if (transferInfo) transferInfo.style.display = "none";
      if (codInfo) codInfo.style.display = "none";
    } else if (method === "transfer") {
      if (cardDetails) cardDetails.classList.remove("visible");
      if (transferInfo) transferInfo.style.display = "block";
      if (codInfo) codInfo.style.display = "none";
    } else if (method === "cod") {
      if (cardDetails) cardDetails.classList.remove("visible");
      if (transferInfo) transferInfo.style.display = "none";
      if (codInfo) codInfo.style.display = "block";
    }
  }

  paymentOptions.forEach(function (option) {
    option.addEventListener("click", function () {
      paymentOptions.forEach(function (opt) {
        opt.classList.remove("selected");
      });
      this.classList.add("selected");
      var method = this.getAttribute("data-method");
      showPaymentDetails(method);
    });
  });

  // Set correct details visible on page load
  var selectedPayment = document.querySelector('input[name="payment"]:checked');
  if (selectedPayment) {
    showPaymentDetails(selectedPayment.value);
  }
  loadBankTransferInstructions();

  // ─────────────────────────────────────────────────────────────
  //  Required text fields: blur validation
  // ─────────────────────────────────────────────────────────────
  var requiredFields = [
    { id: "firstNameInput", errorId: "firstNameError", label: "First name is required." },
    { id: "lastNameInput", errorId: "lastNameError", label: "Last name is required." },
    { id: "streetInput", errorId: "streetError", label: "Street address is required." },
    { id: "architectureInput", errorId: "architectureError", label: "Building NO. is required." },
    { id: "cardholderInput", errorId: "cardholderError", label: "Cardholder name is required." },
  ];


  requiredFields.forEach(function (field) {
    var el = document.getElementById(field.id);
    var errEl = document.getElementById(field.errorId);
    if (!el) return;

    el.addEventListener("blur", function () {
      var val = this.value.trim();
      if (val.length === 0) {
        this.classList.add("input-error");
        this.classList.remove("input-valid");
        if (errEl) {
          errEl.textContent = field.label;
          errEl.classList.add("visible");
        }
      } else {
        this.classList.remove("input-error");
        this.classList.add("input-valid");
        if (errEl) errEl.classList.remove("visible");
      }
    });

    // Clear error when user starts typing
    el.addEventListener("input", function () {
      this.classList.remove("input-error");
      if (errEl) errEl.classList.remove("visible");
    });
  });

  // ─────────────────────────────────────────────────────────────
  //  Phone: digits + basic formatting chars only
  // ─────────────────────────────────────────────────────────────
  var phoneInput = document.getElementById("phoneInput");
  var phoneError = document.getElementById("phoneError");

  if (phoneInput && phoneError) {
    phoneInput.addEventListener("input", function () {
      this.value = this.value.replace(/[^0-9+()\s\-]/g, "");
      this.classList.remove("input-error");
      phoneError.classList.remove("visible");
    });

    phoneInput.addEventListener("blur", function () {
      var digits = this.value.replace(/[^0-9]/g, "");
      if (digits.length > 0 && digits.length < 7) {
        this.classList.add("input-error");
        this.classList.remove("input-valid");
        phoneError.textContent = "Please enter a valid phone number.";
        phoneError.classList.add("visible");
      } else if (digits.length >= 7) {
        this.classList.remove("input-error");
        this.classList.add("input-valid");
        phoneError.classList.remove("visible");
      } else {
        this.classList.remove("input-error", "input-valid");
        phoneError.classList.remove("visible");
      }
    });
  }

  // ─────────────────────────────────────────────────────────────
  //  Card Number: digits only with auto-spacing every 4
  // ─────────────────────────────────────────────────────────────
  var cardNumberInput = document.getElementById("cardNumberInput");
  var cardNumberError = document.getElementById("cardNumberError");

  if (cardNumberInput && cardNumberError) {
    cardNumberInput.addEventListener("input", function () {
      var raw = this.value.replace(/[^0-9]/g, "");
      if (raw.length > 16) raw = raw.slice(0, 16);
      this.value = raw.replace(/(\d{4})(?=\d)/g, "$1 ");
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

  // ─────────────────────────────────────────────────────────────
  //  Expiry: auto-format MM / YY
  // ─────────────────────────────────────────────────────────────
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

  // ─────────────────────────────────────────────────────────────
  //  CVV: digits only, 3-4 chars
  // ─────────────────────────────────────────────────────────────
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

  // ─────────────────────────────────────────────────────────────
  //  Map validation helper
  // ─────────────────────────────────────────────────────────────
  var mapLatInput = document.getElementById("mapLat");
  var mapContainer = document.getElementById("mapContainer");
  var mapError = document.getElementById("mapError");

  function validateMap() {
    if (!mapLatInput || !mapLatInput.value) {
      if (mapContainer) {
        mapContainer.style.borderColor = "#ef4444";
        mapContainer.style.boxShadow = "0 0 0 3px rgba(239, 68, 68, 0.15)";
      }
      if (mapError) {
        mapError.textContent = "Please select your location on the map.";
        mapError.classList.add("visible");
      }
      return false;
    }
    if (mapContainer) {
      mapContainer.style.borderColor = "";
      mapContainer.style.boxShadow = "";
    }
    if (mapError) mapError.classList.remove("visible");
    return true;
  }

  // ─────────────────────────────────────────────────────────────
  //  CONFIRM BUTTON — the core fix
  //  Validates everything → calls placeOrder() → clears cart →
  //  redirects to confirmation page. NO inline onclick.
  // ─────────────────────────────────────────────────────────────
  var confirmBtn = document.getElementById("confirmPayBtn");

  if (confirmBtn) {
    confirmBtn.addEventListener("click", async function () {
      // Prevent double-click while order is processing
      if (confirmBtn.disabled) return;

      // ── Step 1: Trigger blur on all required text fields ──
      requiredFields.forEach(function (field) {
        var el = document.getElementById(field.id);
        if (el) {
          el.focus();
          el.blur();
        }
      });

      // ── Step 2: Validate email ──
      if (typeof CheckoutEmail !== "undefined" && CheckoutEmail.validate) {
        CheckoutEmail.validate();
      }

      // ── Step 3: Validate map ──
      var mapValid = validateMap();

      // ── Step 4: Validate phone ──
      if (phoneInput) {
        phoneInput.focus();
        phoneInput.blur();
      }

      // ── Step 5: Validate payment-specific fields ──
      var selectedPaymentRadio = document.querySelector(
        'input[name="payment"]:checked'
      );
      var paymentMethod = selectedPaymentRadio
        ? selectedPaymentRadio.value
        : "card";

      if (paymentMethod === "card") {
        if (cardNumberInput) {
          cardNumberInput.focus();
          cardNumberInput.blur();
        }
        if (expiryInput) {
          expiryInput.focus();
          expiryInput.blur();
        }
        if (cvvInput) {
          cvvInput.focus();
          cvvInput.blur();
        }
      }

      // ── Step 6: Small delay so all blur handlers finish ──
      await new Promise(function (resolve) {
        setTimeout(resolve, 150);
      });

      // ── Step 7: Check for any visible errors ──
      var visibleErrors = document.querySelectorAll(".field-error.visible");
      var invalidInputs = document.querySelectorAll(".input-error");

      if (
        visibleErrors.length > 0 ||
        invalidInputs.length > 0 ||
        !mapValid
      ) {
        // Scroll to the first error and focus it
        var firstError =
          document.querySelector(".input-error") ||
          document.querySelector(".field-error.visible");

        if (firstError) {
          firstError.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });

          if (firstError.classList.contains("input-error")) {
            firstError.focus();
          } else {
            // It's an error span — focus its preceding input
            var prev = firstError.previousElementSibling;
            if (
              prev &&
              (prev.tagName === "INPUT" || prev.tagName === "TEXTAREA")
            ) {
              prev.focus();
            }
          }
        }
        return; // Stop here — don't submit
      }

      // ── Step 8: All valid — show loading state ──
      var originalHTML = confirmBtn.innerHTML;
      confirmBtn.disabled = true;
      confirmBtn.style.opacity = "0.7";
      confirmBtn.style.cursor = "wait";
      confirmBtn.innerHTML =
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:adminSpin 1s linear infinite;"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg> Placing Order...';

      // ── Step 9: Call placeOrder() from script.js ──
      if (typeof placeOrder === "function") {
        try {
          var result = await placeOrder();

          if (result && result.success && result.order) {
            // Store order ID so the confirmation page can display it
            sessionStorage.setItem("lastOrderId", String(result.order.id));

            // Clear the purchased items from cart / buy-now storage
            if (typeof clearConsumedCheckout === "function") {
              var orderItems =
                result.order.items || result.order.order_items || [];
              clearConsumedCheckout(orderItems);
            }

            // Update cart bubble one last time
            if (typeof updateCartBubble === "function") {
              updateCartBubble();
            }

            // Redirect to confirmation page
            window.location.href = "order-confirmation.html";
          } else {
            // Order failed — restore button and show error
            confirmBtn.disabled = false;
            confirmBtn.style.opacity = "1";
            confirmBtn.style.cursor = "pointer";
            confirmBtn.innerHTML = originalHTML;

            var errorMsg =
              result && result.message
                ? result.message
                : "Failed to place order. Please try again.";
            alert(errorMsg);
          }
        } catch (err) {
          // Network or unexpected error
          console.error("Order placement error:", err);
          confirmBtn.disabled = false;
          confirmBtn.style.opacity = "1";
          confirmBtn.style.cursor = "pointer";
          confirmBtn.innerHTML = originalHTML;
          alert(
            "Something went wrong while placing your order. Please try again."
          );
        }
      } else {
        // placeOrder not found — script.js didn't load
        console.error(
          "placeOrder function not found. script.js may not have loaded."
        );
        confirmBtn.disabled = false;
        confirmBtn.style.opacity = "1";
        confirmBtn.style.cursor = "pointer";
        confirmBtn.innerHTML = originalHTML;
        alert(
          "A required script did not load correctly. Please refresh the page and try again."
        );
      }
    });
  }
})();