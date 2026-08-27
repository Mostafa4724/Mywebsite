(() => {
  "use strict";
const container = document.getElementById("ordersContainer");

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[ch]));
  }

  function money(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n.toFixed(2) : "0.00";
  }

  function formatDate(value) {
    if (!value) return "Date unavailable";
    const d = new Date(String(value).replace(" ", "T"));
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString(undefined, {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit"
    });
  }


  function statusClass(status) {
    const value = String(status || "placed").trim().toLowerCase();
    if (value === "confirmed") return "order-status--confirmed";
    if (value === "shipped") return "order-status--shipped";
    if (value === "processing") return "order-status--processing";
    if (value === "delivered") return "order-status--delivered";
    if (value === "cancelled" || value === "canceled") return "order-status--cancelled";
    return "order-status--placed";
  }

  function show(message) {
    container.innerHTML = message;
  }

  function renderOrders(orders) {
    if (!orders.length) {
      show(
        '<div class="orders-empty">' +
          "<h2>No orders yet</h2>" +
          "<p>Your completed orders will appear here.</p>" +
          '<a class="orders-action" href="home.html">Continue Shopping</a>' +
        "</div>"
      );
      return;
    }

    container.innerHTML = orders.map(order => {
      const itemCount = (order.items || []).reduce(
        (sum, item) => sum + (Number(item.quantity) || 0), 0
      );

      return (
        '<a class="order-card" href="order-confirmation.html" data-order-id="' +
          encodeURIComponent(order.id) + '">' +
          '<div class="order-card-top">' +
            "<div>" +
              '<p class="order-number">Order #' + escapeHtml(order.id) + "</p>" +
              '<p class="order-date">' + escapeHtml(formatDate(order.created_at)) + "</p>" +
            "</div>" +
            '<div class="order-total">' + money(order.total) + "</div>" +
          "</div>" +
          '<div class="order-card-bottom">' +
            '<span class="order-items">' +
              itemCount + (itemCount === 1 ? " item" : " items") +
            "</span>" +
            '<span class="order-status ' + statusClass(order.status) + '">' + escapeHtml(order.status || "placed") + "</span>" +
          "</div>" +
        "</a>"
      );
    }).join("");

    container.querySelectorAll(".order-card").forEach(card => {
      card.addEventListener("click", () => {
        const id = decodeURIComponent(card.dataset.orderId);
        sessionStorage.setItem("lastOrderId", id);
      });
    });
  }

  async function loadOrders() {
    const token = sessionStorage.getItem("token");

    if (!token) {
      show(
        '<div class="orders-error">' +
          "<h2>Please sign in</h2>" +
          "<p>You need to sign in to view your orders.</p>" +
          '<a class="orders-action" href="login.html">Sign In</a>' +
        "</div>"
      );
      return;
    }

    show('<div class="orders-loading">Loading your orders...</div>');

    try {
      const response = await fetch(API + "/orders", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + token
        }
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to load your orders.");
      }

      renderOrders(Array.isArray(data.orders) ? data.orders : []);
    } catch (error) {
      console.error("Failed to load orders:", error);
      show(
        '<div class="orders-error">' +
          "<h2>Unable to load orders</h2>" +
          "<p>" + escapeHtml(error.message || "Please try again.") + "</p>" +
          '<a class="orders-action" href="home.html">Continue Shopping</a>' +
        "</div>"
      );
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadOrders);
  } else {
    loadOrders();
  }
})();
