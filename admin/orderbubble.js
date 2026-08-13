(function () {
  "use strict";

  function isOrderPage() {
    var path = window.location.pathname.toLowerCase();

    return (
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

    if (count <= 0 || isOrderPage()) {
      hideOrderBubble();
      return;
    }

    bubble.textContent = String(count);
    bubble.hidden = false;
  }

  async function updateOrderBubble() {
    var bubble = getOrderBubble();

    if (!bubble) return;

    /*
     * The order page must NEVER show the bubble,
     * even while the API request is loading.
     */
    if (isOrderPage()) {
      hideOrderBubble();
      return;
    }

    try {
      var response = await fetch("/orders", {
        method: "GET",
        credentials: "include",
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error("Failed to load orders");
      }

      var data = await response.json();

      /*
       * Support the common API response formats:
       *
       * { orders: [...] }
       * or
       * [...]
       */
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
      console.error("Failed to update order notification bubble:", error);

      /*
       * Don't show a fake number if the API fails.
       */
      hideOrderBubble();
    }
  }

  /*
   * Run when the page loads.
   */
  document.addEventListener("DOMContentLoaded", function () {
    updateOrderBubble();
  });

  /*
   * Make the function available to other admin scripts.
   */
  window.updateOrderBubble = updateOrderBubble;

})();