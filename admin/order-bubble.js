// =====================================================================
// Admin order notification bubble
// Counts all orders whose current status is "placed".
// This file is used by every admin page that has the sidebar.
// =====================================================================
(function () {
  "use strict";

  var API_BASE = "http://127.0.0.1:5000";
  var REFRESH_INTERVAL = 3000;

  function getOrderBubbles() {
    // Use the id when available, but also support every sidebar badge
    // beside the Orders link so the script works on all admin pages.
    var byId = document.getElementById("orderBubble");
    var bubbles = byId ? [byId] : [];

    var orderLink = document.querySelector(
      '.sidebar-link[href="orders.html"]'
    );

    if (orderLink) {
      var badges = orderLink.querySelectorAll(".sidebar-badge");

      badges.forEach(function (badge) {
        if (bubbles.indexOf(badge) === -1) {
          bubbles.push(badge);
        }
      });
    }

    return bubbles;
  }

  function renderOrderBubble(count) {
    var bubbles = getOrderBubbles();

    bubbles.forEach(function (bubble) {
      if (count > 0) {
        bubble.textContent = String(count);
        bubble.hidden = false;
      } else {
        bubble.textContent = "";
        bubble.hidden = true;
      }
    });
  }

  async function updateOrderBubble() {
    var bubbles = getOrderBubbles();

    if (!bubbles.length) {
      return;
    }

    try {
      var token = sessionStorage.getItem("token");

      var headers = {
        Accept: "application/json"
      };

      if (token) {
        headers.Authorization = "Bearer " + token;
      }

      var response = await fetch(API_BASE + "/orders", {
        method: "GET",
        headers: headers,
        credentials: "include",
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error(
          "Orders request failed: HTTP " + response.status
        );
      }

      var data = await response.json();

      if (
        !data ||
        data.success !== true ||
        !Array.isArray(data.orders)
      ) {
        throw new Error("Invalid orders response.");
      }

      var placedCount = data.orders.filter(function (order) {
        var status = String(
          order.status || ""
        ).trim().toLowerCase();

        // "pending" is treated as placed by the existing order UI.
        return status === "placed" || status === "pending";
      }).length;

      renderOrderBubble(placedCount);

    } catch (error) {
      console.error(
        "Failed to update order notification bubble:",
        error
      );

      // Do not show an incorrect number if the backend cannot be reached.
      renderOrderBubble(0);
    }
  }

  function start() {
    updateOrderBubble();

    // Refresh immediately after an order status changes.
    window.addEventListener(
      "orderStatusUpdated",
      updateOrderBubble
    );

    window.addEventListener(
      "ordersChanged",
      updateOrderBubble
    );

    // Keep synchronized every 3 seconds.
    window.setInterval(
      updateOrderBubble,
      REFRESH_INTERVAL
    );

    // Allow other scripts to refresh it manually.
    window.updateOrderBubble =
      updateOrderBubble;
  }

  if (
    document.readyState === "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      start
    );
  } else {
    start();
  }

})();