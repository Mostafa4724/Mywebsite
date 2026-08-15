// =====================================================================
// Admin Order Notification Bubble
// =====================================================================
// Shows the number of orders that are STILL "placed".
//
// placed       -> COUNT
// confirmed    -> NOT COUNTED
// processing   -> NOT COUNTED
// shipped      -> NOT COUNTED
// delivered    -> NOT COUNTED
// cancelled    -> NOT COUNTED
//
// The bubble updates:
// 1. When the page opens
// 2. After "orderStatusUpdated" is fired
// 3. Every 3 seconds
// =====================================================================

(function () {
  "use strict";

  // Your backend API
  var API_BASE = "http://127.0.0.1:5000";

  // Check for new/updated orders every 3 seconds
  var REFRESH_INTERVAL = 3000;


  // ===================================================================
  // Find the order bubble
  // ===================================================================

  function getOrderBubbles() {

    var bubbles = [];

    // Main bubble
    var orderBubble = document.getElementById("orderBubble");

    if (orderBubble) {
      bubbles.push(orderBubble);
    }

    // Also look for any badge inside the Orders sidebar link
    var orderLink = document.querySelector(
      '.sidebar-link[href="orders.html"]'
    );

    if (orderLink) {

      var badges = orderLink.querySelectorAll(
        ".sidebar-badge"
      );

      badges.forEach(function (badge) {

        if (bubbles.indexOf(badge) === -1) {
          bubbles.push(badge);
        }

      });

    }

    return bubbles;
  }


  // ===================================================================
  // Show / hide the bubble
  // ===================================================================

  function renderOrderBubble(count) {

    var bubbles = getOrderBubbles();

    bubbles.forEach(function (bubble) {

      if (count > 0) {

        // Show number
        bubble.textContent = String(count);

        bubble.hidden = false;

        // In case CSS uses display:none
        bubble.style.display = "";

      } else {

        // No placed orders
        bubble.textContent = "";

        bubble.hidden = true;

        // Make sure it disappears
        bubble.style.display = "none";
      }

    });

  }


  // ===================================================================
  // Get all orders and count ONLY "placed"
  // ===================================================================

  async function updateOrderBubble() {

    var bubbles = getOrderBubbles();

    // There is no bubble on this page
    if (!bubbles.length) {
      return;
    }


    try {

      // Get the same login token used by your admin pages
      var token = sessionStorage.getItem("token");


      var headers = {
        "Accept": "application/json"
      };


      // Send authentication token
      if (token) {

        headers["Authorization"] =
          "Bearer " + token;

      }


      // Get all orders
      var response = await fetch(
        API_BASE + "/orders",
        {
          method: "GET",

          headers: headers,

          credentials: "include",

          cache: "no-store"
        }
      );


      // Check HTTP response
      if (!response.ok) {

        throw new Error(
          "Failed to load orders. HTTP status: " +
          response.status
        );

      }


      // Convert response to JSON
      var data = await response.json();


      // Make sure the API returned orders
      if (
        !data ||
        data.success !== true ||
        !Array.isArray(data.orders)
      ) {

        throw new Error(
          "Invalid orders response."
        );

      }


      // ===============================================================
      // IMPORTANT:
      // COUNT ONLY orders whose status is exactly "placed"
      // ===============================================================

      var placedCount =
        data.orders.filter(function (order) {

          var status = String(
            order.status || ""
          )
            .trim()
            .toLowerCase();


          return status === "placed";

        }).length;


      // Update bubble
      renderOrderBubble(placedCount);


      console.log(
        "Placed orders:",
        placedCount
      );


    } catch (error) {

      console.error(
        "Order bubble error:",
        error
      );


      // Do not show an incorrect number
      renderOrderBubble(0);

    }

  }


  // ===================================================================
  // Start the notification system
  // ===================================================================

  function startOrderBubble() {

    // First check immediately
    updateOrderBubble();


    // ================================================================
    // IMPORTANT:
    // view-order.js already dispatches this event after successfully
    // changing the order status.
    //
    // Example:
    //
    // placed -> confirmed
    //
    // The bubble will update immediately.
    // ================================================================

    window.addEventListener(
      "orderStatusUpdated",
      function () {

        updateOrderBubble();

      }
    );


    // ================================================================
    // Also listen for a general order change event
    // ================================================================

    window.addEventListener(
      "ordersChanged",
      function () {

        updateOrderBubble();

      }
    );


    // ================================================================
    // Automatically check every 3 seconds
    // ================================================================

    window.setInterval(
      function () {

        updateOrderBubble();

      },
      REFRESH_INTERVAL
    );


    // ================================================================
    // Make the function available globally
    // This allows another admin JS file to manually refresh it.
    // ================================================================

    window.updateOrderBubble =
      updateOrderBubble;

  }


  // ===================================================================
  // Start after HTML has loaded
  // ===================================================================

  if (
    document.readyState === "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      startOrderBubble
    );

  } else {

    startOrderBubble();

  }

})();