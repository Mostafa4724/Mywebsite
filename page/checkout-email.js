/* ===== Email Domain Restriction with Autocomplete Suggestions ===== */
var CheckoutEmail = (function () {
  // Allowed email domains — add or remove as needed
  var ALLOWED_DOMAINS = [
    "gmail.com",
    "outlook.com",
    "yahoo.com",
    "hotmail.com"
  ];

  // Visual style for each domain in the suggestion dropdown
  var DOMAIN_STYLES = {
    "gmail.com":    { bg: "gmail-bg",    letter: "G" },
    "outlook.com":  { bg: "outlook-bg",  letter: "O" },
    "yahoo.com":    { bg: "yahoo-bg",    letter: "Y" },
    "hotmail.com":  { bg: "hotmail-bg",  letter: "H" }
  };

  var emailInput = null;
  var emailError = null;
  var emailSuggestions = null;
  var domainTags = null;
  var highlightedIndex = -1;

  // ── Helpers ──────────────────────────────────────────────

  function getEmailDomain(email) {
    var parts = email.trim().split("@");
    return parts.length === 2 ? parts[1].toLowerCase() : "";
  }

  function getEmailLocal(email) {
    var parts = email.trim().split("@");
    return parts[0];
  }

  function isDomainAllowed(domain) {
    return ALLOWED_DOMAINS.indexOf(domain.toLowerCase()) !== -1;
  }

  // ── Core validation ──────────────────────────────────────

  function validateEmail(email) {
    var val = email.trim();

    if (val.length === 0) {
      return { valid: false, empty: true, message: "" };
    }

    if (!val.includes("@")) {
      return { valid: false, empty: false, message: 'Email must contain "@" symbol.' };
    }

    var parts = val.split("@");
    if (parts.length !== 2) {
      return { valid: false, empty: false, message: "Invalid email format." };
    }

    var local = parts[0];
    var domain = parts[1].toLowerCase();

    if (local.length === 0) {
      return { valid: false, empty: false, message: 'Enter a username before "@".' };
    }

    if (domain.length === 0) {
      return { valid: false, empty: false, message: 'Enter a domain after "@".' };
    }

    if (!isDomainAllowed(domain)) {
      return {
        valid: false,
        empty: false,
        message:
          "Only " +
          ALLOWED_DOMAINS.map(function (d) {
            return "@" + d;
          }).join(", ") +
          " are accepted."
      };
    }

    return { valid: true, empty: false, message: "" };
  }

  // ── Apply validation state to the input ──────────────────

  function applyValidation(result) {
    if (result.empty) {
      emailInput.classList.remove("input-error", "input-valid");
      emailError.classList.remove("visible");
    } else if (result.valid) {
      emailInput.classList.remove("input-error");
      emailInput.classList.add("input-valid");
      emailError.classList.remove("visible");
    } else {
      emailInput.classList.add("input-error");
      emailInput.classList.remove("input-valid");
      emailError.textContent = result.message;
      emailError.classList.add("visible");
    }
  }

  // ── Domain tag highlighting ──────────────────────────────

  function updateDomainTags(email) {
    var domain = getEmailDomain(email);
    var tags = domainTags.querySelectorAll(".email-domain-tag");
    tags.forEach(function (tag) {
      if (domain && tag.getAttribute("data-domain") === domain) {
        tag.classList.add("matched");
      } else {
        tag.classList.remove("matched");
      }
    });
  }

  // ── Suggestion dropdown ──────────────────────────────────

  function showSuggestions(email) {
    var local = getEmailLocal(email);
    var currentDomain = getEmailDomain(email);

    // Only show after user has typed something before @
    if (!email.includes("@") || local.length === 0) {
      closeSuggestions();
      return;
    }

    // If domain already matches an allowed one, no need to suggest
    if (isDomainAllowed(currentDomain)) {
      closeSuggestions();
      return;
    }

    // Filter domains that start with what user typed after @
    var matches = ALLOWED_DOMAINS.filter(function (d) {
      return d.indexOf(currentDomain) === 0;
    });

    if (matches.length === 0) {
      closeSuggestions();
      return;
    }

    // Build HTML
    var html = "";
    matches.forEach(function (domain, idx) {
      var style = DOMAIN_STYLES[domain] || {
        bg: "",
        letter: domain[0].toUpperCase()
      };
      var fullEmail = local + "@" + domain;
      html +=
        '<div class="email-suggestion-item" data-index="' +
        idx +
        '" data-email="' +
        fullEmail +
        '">';
      html +=
        '  <span class="suggestion-icon ' + style.bg + '">' + style.letter + "</span>";
      html +=
        '  <span>' +
        local +
        '@<span class="suggestion-domain">' +
        domain +
        "</span></span>";
      html += "</div>";
    });

    emailSuggestions.innerHTML = html;
    emailSuggestions.classList.add("open");
    highlightedIndex = -1;

    // Attach click handlers to each suggestion
    var items = emailSuggestions.querySelectorAll(".email-suggestion-item");
    items.forEach(function (item) {
      item.addEventListener("mousedown", function (e) {
        e.preventDefault(); // prevent blur from firing first
        emailInput.value = this.getAttribute("data-email");
        closeSuggestions();
        var result = validateEmail(emailInput.value);
        applyValidation(result);
        updateDomainTags(emailInput.value);
      });
    });
  }

  function closeSuggestions() {
    emailSuggestions.classList.remove("open");
    emailSuggestions.innerHTML = "";
    highlightedIndex = -1;
  }

  function highlightSuggestion(direction) {
    var items = emailSuggestions.querySelectorAll(".email-suggestion-item");
    if (items.length === 0) return;

    // Remove previous highlight
    if (highlightedIndex >= 0 && highlightedIndex < items.length) {
      items[highlightedIndex].classList.remove("highlighted");
    }

    if (direction === "down") {
      highlightedIndex = (highlightedIndex + 1) % items.length;
    } else {
      highlightedIndex =
        highlightedIndex <= 0 ? items.length - 1 : highlightedIndex - 1;
    }

    items[highlightedIndex].classList.add("highlighted");
    emailInput.value = items[highlightedIndex].getAttribute("data-email");
  }

  // ── Event binding ────────────────────────────────────────

  function bindEvents() {
    // On typing — only show error if a full domain has been typed
    emailInput.addEventListener("input", function () {
      var val = this.value.trim();
      var result = validateEmail(val);
      var domain = getEmailDomain(val);

      if (domain.length > 0 && !result.valid) {
        applyValidation(result);
      } else if (result.valid) {
        applyValidation(result);
      } else {
        // Still typing, clear visual states but don't show error
        this.classList.remove("input-error", "input-valid");
        emailError.classList.remove("visible");
      }

      updateDomainTags(val);
      showSuggestions(val);
    });

    // On blur — always run full strict validation
    emailInput.addEventListener("blur", function () {
      closeSuggestions();
      var result = validateEmail(this.value);
      applyValidation(result);
      updateDomainTags(this.value);
    });

    // On focus — reopen suggestions if applicable
    emailInput.addEventListener("focus", function () {
      showSuggestions(this.value);
    });

    // Keyboard navigation for suggestions
    emailInput.addEventListener("keydown", function (e) {
      if (!emailSuggestions.classList.contains("open")) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        highlightSuggestion("down");
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        highlightSuggestion("up");
      } else if (e.key === "Enter" || e.key === "Tab") {
        if (highlightedIndex >= 0) {
          e.preventDefault();
          var items = emailSuggestions.querySelectorAll(".email-suggestion-item");
          if (items[highlightedIndex]) {
            this.value = items[highlightedIndex].getAttribute("data-email");
            closeSuggestions();
            var result = validateEmail(this.value);
            applyValidation(result);
            updateDomainTags(this.value);
          }
        }
      } else if (e.key === "Escape") {
        closeSuggestions();
      }
    });

    // Close suggestions when clicking outside the email wrapper
    document.addEventListener("click", function (e) {
      if (!e.target.closest(".email-wrapper")) {
        closeSuggestions();
      }
    });
  }

  // ── Public API ───────────────────────────────────────────

  // Expose validate so checkout-form.js can trigger it on confirm
  function runValidation() {
    if (!emailInput) return { valid: false, empty: true };
    var result = validateEmail(emailInput.value);
    applyValidation(result);
    updateDomainTags(emailInput.value);
    return result;
  }

  function getInput() {
    return emailInput;
  }

  // ── Init ─────────────────────────────────────────────────

  function init() {
    emailInput = document.getElementById("checkoutEmail");
    emailError = document.getElementById("emailError");
    emailSuggestions = document.getElementById("emailSuggestions");
    domainTags = document.getElementById("domainTags");

    if (emailInput && emailError && emailSuggestions && domainTags) {
      bindEvents();
    }
  }

  // Run init when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Return public methods
  return {
    validate: runValidation,
    getInput: getInput,
    ALLOWED_DOMAINS: ALLOWED_DOMAINS
  };
})();