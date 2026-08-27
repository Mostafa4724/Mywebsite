// =================================================================
// ADMIN ORDER BUBBLE
// Counts ONLY orders whose status is "placed"
// =================================================================

(function () {
  "use strict";
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
        API + "/orders",
        {
            method: "GET",
            headers: headers,
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



  function getLowStockBubble() {
    return document.getElementById("lowStockBubble");
  }

  function showLowStockBubble(count) {
    const bubble = getLowStockBubble();
    if (!bubble) return;
    if (count <= 0) {
      bubble.textContent = "";
      bubble.hidden = true;
      bubble.style.display = "none";
      return;
    }
    bubble.textContent = String(count);
    bubble.hidden = false;
    bubble.style.display = "";
  }

  async function updateLowStockBubble() {
    const bubble = getLowStockBubble();
    if (!bubble) return;
    try {
      const token = sessionStorage.getItem("token");
      const response = await fetch(API + "/products", {
        cache: "no-store",
        headers: token ? { Authorization: "Bearer " + token } : {}
      });
      const data = await response.json();
      if (!response.ok || !data.success || !Array.isArray(data.products)) throw new Error("Invalid products response");
      const count = data.products.filter(p => {
        const stock = Number(p.stock || 0);
        const threshold = Number(p.low_stock ?? 10);
        return stock > 0 && stock <= threshold;
      }).length;
      showLowStockBubble(count);
    } catch (error) {
      console.error("Low-stock bubble error:", error);
      showLowStockBubble(0);
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
    updateLowStockBubble();


    // Check every 3 seconds
    setInterval(
      updateOrderBubble,
      REFRESH_INTERVAL
    );
    setInterval(
      updateLowStockBubble,
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