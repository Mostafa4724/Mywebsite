(function () {
  "use strict";

  var EMAILJS_PUBLIC_KEY  = "POyuLcs-3SnIXAd8u";
  var EMAILJS_SERVICE_ID  = "service_o3h0CDF";
  var EMAILJS_TEMPLATE_ID = "template_ql3kd9w";

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

  emailjs.init(EMAILJS_PUBLIC_KEY);

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
      .send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
        from_name:  name,
        from_email: email,
        to_name:    "Mostafa",
        to_email:   "mnmaibrahim@gmail.com",
        message:    message,
        subject:    "New message from " + name
      })
      .then(function () {
        showStatus("Message sent successfully!", true);
        form.reset();
      })
      .catch(function (error) {
        console.error("Full error:", error);
        showStatus("Error: " + (error.status || "unknown") + "\n" + (error.text || JSON.stringify(error)), false);
      })
      .finally(function () {
        submitBtn.disabled    = false;
        submitBtn.textContent = originalText;
      });
  });
})();