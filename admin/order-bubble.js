// =================================================================
// ADMIN ORDER BUBBLE
// Counts ONLY orders whose status is "placed"
// =================================================================

(function () {
  "use strict";

  const API_BASE = "http://127.0.0.1:5000";
  const REFRESH_INTERVAL = 3000;


  // ================================================================
  // Get the bubble
  // ================================================================

  function getOrderBubble() {
    return document.getElementById("orderBubble");
  }


  // ================================================================
  // Hide bubble
  // ================================================================

  function hideOrderBubble() {
    const bubble = getOrderBubble();

    if (!bubble) {
      return;
    }

    bubble.textContent = "";
    bubble.hidden = true;
    bubble.style.display = "none";
  }


  // ================================================================
  // Show bubble
  // ================================================================

  function showOrderBubble(count) {
    const bubble = getOrderBubble();

    if (!bubble) {
      console.warn("orderBubble element was not found.");
      return;
    }

    if (count <= 0) {
      hideOrderBubble();
      return;
    }

    bubble.textContent = String(count);
    bubble.hidden = false;
    bubble.style.display = "";
  }


  // ================================================================
  // Read orders from backend
  // ================================================================

  async function updateOrderBubble() {

    const bubble = getOrderBubble();

    if (!bubble) {
      console.warn(
        "Order bubble: #orderBubble does not exist on this page."
      );
      return;
    }

    try {

      const token = sessionStorage.getItem("token");

      const headers = {
        "Accept": "application/json"
      };

      if (token) {
        headers["Authorization"] =
          "Bearer " + token;
      }


      console.log(
        "Order bubble: requesting orders..."
      );


      const response = await fetch(
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
          "HTTP " + response.status
        );
      }


      const data = await response.json();


      console.log(
        "Order bubble: orders response:",
        data
      );


      if (
        !data ||
        data.success !== true ||
        !Array.isArray(data.orders)
      ) {

        throw new Error(
          "Invalid /orders response."
        );

      }


      // ============================================================
      // COUNT ONLY "placed"
      // ============================================================

      const placedCount =
        data.orders.filter(function (order) {

          return String(
            order.status || ""
          )
            .trim()
            .toLowerCase() === "placed";

        }).length;


      console.log(
        "Order bubble: placed orders =",
        placedCount
      );


      showOrderBubble(placedCount);


    } catch (error) {

      console.error(
        "Order bubble error:",
        error
      );

      hideOrderBubble();

    }

  }


  // ================================================================
  // Start
  // ================================================================

  function startOrderBubble() {

    console.log(
      "Order bubble script loaded."
    );


    // First check
    updateOrderBubble();


    // Check every 3 seconds
    setInterval(
      updateOrderBubble,
      REFRESH_INTERVAL
    );


    // Make it available to other scripts
    window.updateOrderBubble =
      updateOrderBubble;

  }


  // ================================================================
  // Wait for HTML
  // ================================================================

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