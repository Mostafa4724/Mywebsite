// =================================================================
// Admin order notification bubble
// Shows the number of orders whose status is exactly "placed".
// Hidden on orders.html (and order.html for compatibility).
// =================================================================
(function () {
  "use strict";

  var API_BASE = "http://127.0.0.1:5000";

  function isOrdersPage() {
    var path = window.location.pathname.toLowerCase();

    return (
      path.endsWith("/orders.html") ||
      path === "/orders.html" ||
      path.endsWith("orders.html") ||
      path.endsWith("/order.html") ||
      path === "/order.html" ||
      path.endsWith("order.html")
    );
  }

  function getOrderBubble() {
    return document.getElementById("orderBubble");
  }

  function hideOrderBubble() {
    var bubble = getOrderBubble();

    if (!bubble) return;

    bubble.hidden = true;
    bubble.textContent = "";
  }

  function showOrderBubble(count) {
    var bubble = getOrderBubble();

    if (!bubble) return;

    if (count <= 0 || isOrdersPage()) {
      hideOrderBubble();
      return;
    }

    bubble.textContent = String(count);
    bubble.hidden = false;
  }

  async function updateOrderBubble() {
    var bubble = getOrderBubble();

    if (!bubble) return;

    // The Orders page must never show its own notification bubble.
    if (isOrdersPage()) {
      hideOrderBubble();
      return;
    }

    try {
      var token = sessionStorage.getItem("token");

      var headers = {};
      if (token) {
        headers.Authorization = "Bearer " + token;
      }

      var response = await fetch(
        API_BASE + "/orders",
        {
          method: "GET",
          headers: headers,
          credentials: "include",
          cache: "no-store"
        }
      );

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

      showOrderBubble(placedCount);
    } catch (error) {
      console.error(
        "Failed to update order notification bubble:",
        error
      );

      // Never display a fake/stale number when the API fails.
      hideOrderBubble();
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    updateOrderBubble();
  });

  // Useful after an order status is changed without a full page reload.
  window.updateOrderBubble = updateOrderBubble;
})();
