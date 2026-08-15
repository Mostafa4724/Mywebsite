(function () {
  "use strict";

  const API_BASE = "http://127.0.0.1:5000";
  const REFRESH_INTERVAL = 3000;

  function updateOrderBubble() {
    const bubble = document.getElementById("orderBubble");

    if (!bubble) {
      return;
    }

    const token = sessionStorage.getItem("token");

    const headers = {
      "Accept": "application/json"
    };

    if (token) {
      headers["Authorization"] = "Bearer " + token;
    }

    fetch(API_BASE + "/orders", {
      method: "GET",
      headers: headers,
      credentials: "include",
      cache: "no-store"
    })
      .then(function (response) {
        if (!response.ok) {
          throw new Error(
            "Failed to load orders: " + response.status
          );
        }

        return response.json();
      })

      .then(function (data) {

        if (
          !data ||
          data.success !== true ||
          !Array.isArray(data.orders)
        ) {
          throw new Error("Invalid orders response");
        }

        // COUNT ONLY ORDERS THAT ARE STILL "placed"
        const placedOrders = data.orders.filter(function (order) {

          return String(order.status || "")
            .trim()
            .toLowerCase() === "placed";

        });

        const count = placedOrders.length;

        if (count > 0) {

          bubble.textContent = count;
          bubble.hidden = false;

        } else {

          bubble.textContent = "";
          bubble.hidden = true;

        }

      })

      .catch(function (error) {

        console.error(
          "Order bubble error:",
          error
        );

      });
  }


  document.addEventListener(
    "DOMContentLoaded",
    function () {

      // First check
      updateOrderBubble();

      // Check again every 3 seconds
      setInterval(
        updateOrderBubble,
        REFRESH_INTERVAL
      );

    }
  );

})();