// =====================================================================
// Admin order notification bubble
// Shows the number of orders that are still in "placed" status.
// When an order is changed to "confirmed", the number updates/clears.
// =====================================================================
(function () {
  "use strict";

  var API_BASE = "http://127.0.0.1:5000";
  var REFRESH_INTERVAL = 3000;

  function getOrderBubble() {
    return document.getElementById("orderBubble");
  }

  function renderOrderBubble(count) {
    var bubble = getOrderBubble();
    if (!bubble) return;

    if (count > 0) {
      bubble.textContent = String(count);
      bubble.hidden = false;
    } else {
      bubble.textContent = "";
      bubble.hidden = true;
    }
  }

  async function updateOrderBubble() {
    var bubble = getOrderBubble();
    if (!bubble) return;

    try {
      var token = sessionStorage.getItem("token");
      var headers = {};

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
          "Failed to load orders: HTTP " + response.status
        );
      }

      var data = await response.json();

      var orders = Array.isArray(data)
        ? data
        : Array.isArray(data.orders)
          ? data.orders
          : [];

      var placedCount = orders.filter(function (order) {
        return String(order.status || "").toLowerCase() === "placed";
      }).length;

      renderOrderBubble(placedCount);

    } catch (error) {
      console.error(
        "Failed to update order notification bubble:",
        error
      );

      renderOrderBubble(0);
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    updateOrderBubble();

    // Keep every admin page synchronized without refreshing the page.
    window.setInterval(updateOrderBubble, REFRESH_INTERVAL);
  });

  // Other admin scripts can force an immediate refresh
  // after a status change.
  window.updateOrderBubble = updateOrderBubble;

  window.addEventListener(
    "orderStatusUpdated",
    updateOrderBubble
  );
})();