(function () {
  "use strict";

  var PUBLIC_KEY  = "POyuLcs-3SnIXAd8u";
  var SERVICE_ID  = "service_o3h0CDF";
  var TEMPLATE_ID = "template_ql3kd9w";

  var form      = document.getElementById("contactForm");
  var submitBtn = document.getElementById("contactSubmitBtn");

  if (!form || !submitBtn) return;

  function removeStatus() {
    var existing = form.querySelector(".contact-status");
    if (existing) existing.remove();
  }

  function showStatus(message, isSuccess) {
    removeStatus();
    var el = document.createElement("p");
    el.className = "contact-status" + (isSuccess ? " contact-status-success" : " contact-status-error");
    el.textContent = message;
    el.style.whiteSpace = "pre-wrap";
    submitBtn.parentNode.insertBefore(el, submitBtn.nextSibling);
  }

  // Verify EmailJS loaded
  if (typeof emailjs === "undefined") {
    console.error("EmailJS library not loaded!");
    return;
  }

  emailjs.init(PUBLIC_KEY);

  // Quick account verification
  console.log("EmailJS initialized. Testing connection...");
  emailjs.send(SERVICE_ID, TEMPLATE_ID, {
    from_name: "Test",
    from_email: "test@test.com",
    to_email: "mnmaibrahim@gmail.com",
    message: "Connection test - ignore this email"
  }).then(function() {
    console.log("Connection test PASSED!");
  }).catch(function(err) {
    console.error("Connection test FAILED:", err.status, err.text);
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    removeStatus();

    var name    = document.getElementById("contactName").value.trim();
    var email   = document.getElementById("contactEmail").value.trim();
    var message = document.getElementById("contactMessage").value.trim();

    if (!name || !email || !message) {
      showStatus("Please fill in all fields.", false);
      return;
    }

    var originalText = submitBtn.textContent;
    submitBtn.disabled    = true;
    submitBtn.textContent = "Sending...";

    emailjs
      .send(SERVICE_ID, TEMPLATE_ID, {
        from_name:  name,
        from_email: email,
        to_email:   "mnmaibrahim@gmail.com",
        message:    message
      })
      .then(function () {
        showStatus("Message sent successfully!", true);
        form.reset();
      })
      .catch(function (error) {
        console.error("Send error:", error.status, error.text);
        showStatus("Error " + error.status + ": " + error.text, false);
      })
      .finally(function () {
        submitBtn.disabled    = false;
        submitBtn.textContent = originalText;
      });
  });
})();