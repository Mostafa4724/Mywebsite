// ============================================================================
// ADMIN ORDERS PAGE
// ============================================================================
// - Loads real orders from the backend
// - Shows the correct order count
// - Orders bubble shows ONLY unread/new orders
// - Opening this page marks the currently existing orders as read
// - New orders created afterward will appear in the bubble
// ============================================================================

(function () {
  "use strict";

  const API_BASE = "http://127.0.0.1:5000";

  // IMPORTANT:
  // This key MUST be the same key used by script.js.
  const SEEN_KEY = "admin_orders_seen_max_id";

  const ordersTableBody = document.getElementById("ordersTableBody");
  const orderSearch = document.getElementById("orderSearch");
  const statusFilter = document.getElementById("statusFilter");
  const dateFilter = document.getElementById("dateFilter");
  const pageInfo = document.querySelector(".page-info");

  const STATUS_LABELS = {
    placed: "Placed",
    pending: "Placed",
    confirmed: "Confirmed",
    processing: "Processing",
    shipped: "Shipped",
    delivered: "Delivered",
    cancelled: "Cancelled",
  };

  let allOrders = [];

  // ==========================================================================
  // SECURITY / HELPERS
  // ==========================================================================

  function escapeHtml(value) {
    if (value === null || value === undefined) {
      return "";
    }

    const div = document.createElement("div");
    div.textContent = String(value);
    return div.innerHTML;
  }

  function money(value) {
    const number = Number(value) || 0;
    return "$" + number.toFixed(2);
  }

  function formatDate(raw) {
    if (!raw) {
      return "—";
    }

    const date = new Date(raw);

    if (Number.isNaN(date.getTime())) {
      return raw;
    }

    return (
      date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }) +
      " " +
      date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      })
    );
  }

  function buyerName(order) {
    const first = order.customer_name || "";
    const last = order.customer_lastname || "";

    const name = `${first} ${last}`.trim();

    return (
      name ||
      order.customer_email ||
      "Anonymous"
    );
  }

  function itemsLabel(order) {
    const items = Array.isArray(order.items)
      ? order.items
      : [];

    if (items.length === 0) {
      return "—";
    }

    const totalQuantity = items.reduce(
      (sum, item) =>
        sum + (Number(item.quantity) || 0),
      0
    );

    const first = items[0];

    let label =
      first.product_name ||
      "Product";

    if (items.length > 1) {
      label += ` +${items.length - 1}`;
    }

    if (totalQuantity > 1) {
      label += ` x${first.quantity || 1}`;
    }

    return label;
  }

  function normalizeStatus(status) {
    const value = String(status || "placed").toLowerCase();

    if (value === "pending") {
      return "placed";
    }

    return value;
  }

  function statusClass(status) {
    return normalizeStatus(status);
  }

  // ==========================================================================
  // ORDER BUBBLE
  // ==========================================================================

  function getOrdersBadge() {
    return document.querySelector(".sidebar-badge");
  }

  function getSeenOrderId() {
    const value = Number(
      localStorage.getItem(SEEN_KEY)
    );

    if (
      Number.isFinite(value) &&
      value >= 0
    ) {
      return value;
    }

    return null;
  }

  function setOrdersBadge(count) {
    const badge = getOrdersBadge();

    if (!badge) {
      return;
    }

    const safeCount = Math.max(
      0,
      Number(count) || 0
    );

    if (safeCount > 0) {
      badge.textContent = String(safeCount);
      badge.style.display = "flex";

      badge.setAttribute(
        "aria-label",
        `${safeCount} unread order${
          safeCount === 1 ? "" : "s"
        }`
      );
    } else {
      badge.textContent = "";
      badge.style.display = "none";
      badge.removeAttribute("aria-label");
    }
  }

  // ==========================================================================
  // CALCULATE UNREAD ORDERS
  // ==========================================================================

  function updateOrdersBadge(
    orders,
    options = {}
  ) {
    const list = Array.isArray(orders)
      ? orders
      : [];

    const ids = list
      .map(order => Number(order.id))
      .filter(id => Number.isFinite(id));

    // No orders at all.
    if (ids.length === 0) {
      localStorage.setItem(SEEN_KEY, "0");
      setOrdersBadge(0);
      return;
    }

    const newestId = Math.max(...ids);

    let seenId = getSeenOrderId();

    // First time the notification system runs.
    //
    // Do NOT show all old orders as unread.
    if (seenId === null) {
      localStorage.setItem(
        SEEN_KEY,
        String(newestId)
      );

      setOrdersBadge(0);
      return;
    }

    // When the Orders page is opened:
    // mark everything currently in the database as read.
    if (options.markCurrentAsRead === true) {
      localStorage.setItem(
        SEEN_KEY,
        String(newestId)
      );

      setOrdersBadge(0);
      return;
    }

    const unreadCount = ids.filter(
      id => id > seenId
    ).length;

    setOrdersBadge(unreadCount);
  }

  // Make this available to script.js if needed.
  window.updateOrdersBadge = updateOrdersBadge;

  // ==========================================================================
  // RENDER ORDERS
  // ==========================================================================

  function render() {
    if (!ordersTableBody) {
      return;
    }

    const search = (
      orderSearch
        ? orderSearch.value
        : ""
    )
      .trim()
      .toLowerCase();

    const selectedStatus =
      statusFilter
        ? statusFilter.value
        : "all";

    const selectedDate =
      dateFilter
        ? dateFilter.value
        : "all";

    const now = new Date();

    const filtered = allOrders.filter(
      order => {

        // --------------------------------------------------------------
        // SEARCH
        // --------------------------------------------------------------

        const searchText = (
          "#" +
          order.id +
          " " +
          buyerName(order) +
          " " +
          itemsLabel(order)
        ).toLowerCase();

        const matchesSearch =
          !search ||
          searchText.includes(search);

        // --------------------------------------------------------------
        // STATUS
        // --------------------------------------------------------------

        const normalizedStatus =
          normalizeStatus(order.status);

        const matchesStatus =
          selectedStatus === "all" ||
          normalizedStatus === selectedStatus;

        // --------------------------------------------------------------
        // DATE
        // --------------------------------------------------------------

        let matchesDate = true;

        if (
          selectedDate &&
          selectedDate !== "all" &&
          order.created_at
        ) {
          const orderDate =
            new Date(order.created_at);

          if (
            selectedDate === "today"
          ) {
            matchesDate =
              orderDate.toDateString() ===
              now.toDateString();
          }

          else if (
            selectedDate === "week"
          ) {
            const weekAgo =
              new Date();

            weekAgo.setDate(
              now.getDate() - 7
            );

            matchesDate =
              orderDate >= weekAgo;
          }

          else if (
            selectedDate === "month"
          ) {
            const monthAgo =
              new Date();

            monthAgo.setMonth(
              now.getMonth() - 1
            );

            matchesDate =
              orderDate >= monthAgo;
          }
        }

        return (
          matchesSearch &&
          matchesStatus &&
          matchesDate
        );
      }
    );

    // =========================================================================
    // EMPTY
    // =========================================================================

    if (filtered.length === 0) {
      ordersTableBody.innerHTML = `
        <tr>
          <td
            colspan="7"
            style="
              text-align:center;
              padding:40px;
              color:#94a3b8;
            "
          >
            No orders found.
          </td>
        </tr>
      `;
    }

    // =========================================================================
    // ORDERS
    // =========================================================================

    else {
      ordersTableBody.innerHTML =
        filtered
          .map(order => {

            const normalizedStatus =
              normalizeStatus(order.status);

            const statusLabel =
              STATUS_LABELS[
                normalizedStatus
              ] ||
              normalizedStatus;

            const className =
              statusClass(
                normalizedStatus
              );

            return `
              <tr
                data-status="${escapeHtml(
                  normalizedStatus
                )}"
              >

                <td>
                  <strong>
                    #${escapeHtml(order.id)}
                  </strong>
                </td>

                <td>
                  ${escapeHtml(
                    buyerName(order)
                  )}
                </td>

                <td>
                  ${escapeHtml(
                    itemsLabel(order)
                  )}
                </td>

                <td>
                  ${formatDate(
                    order.created_at
                  )}
                </td>

                <td class="table-amount">
                  ${money(order.total)}
                </td>

                <td>
                  <span
                    class="dash-order-status ${escapeHtml(
                      className
                    )}"
                  >
                    ${escapeHtml(
                      statusLabel
                    )}
                  </span>
                </td>

                <td class="table-actions">
                  <a
                    class="btn-text"
                    href="view-order.html?id=${encodeURIComponent(
                      order.id
                    )}"
                  >
                    View
                  </a>
                </td>

              </tr>
            `;
          })
          .join("");
    }

    // =========================================================================
    // PAGE INFO
    // =========================================================================

    if (pageInfo) {
      pageInfo.textContent =
        `Showing ${
          filtered.length > 0
            ? "1-" + filtered.length
            : "0"
        } of ${
          allOrders.length
        } orders`;
    }

    // IMPORTANT:
    // DO NOT DO THIS:
    //
    // badge.textContent = allOrders.length;
    //
    // That was the bug.
    //
    // The bubble is controlled ONLY by updateOrdersBadge().
  }

  // ==========================================================================
  // LOAD ORDERS
  // ==========================================================================

  async function loadOrders() {

    if (!ordersTableBody) {
      return;
    }

    const token =
      sessionStorage.getItem("token");

    if (!token) {
      ordersTableBody.innerHTML = `
        <tr>
          <td
            colspan="7"
            style="
              text-align:center;
              padding:40px;
              color:#ef4444;
            "
          >
            You are not logged in.
          </td>
        </tr>
      `;

      setOrdersBadge(0);
      return;
    }

    try {

      const response =
        await fetch(
          `${API_BASE}/orders`,
          {
            method: "GET",

            headers: {
              Authorization:
                `Bearer ${token}`,

              "Cache-Control":
                "no-cache",

              Pragma:
                "no-cache",
            },

            cache: "no-store",
          }
        );

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}`
        );
      }

      const data =
        await response.json();

      if (
        !data ||
        data.success !== true ||
        !Array.isArray(data.orders)
      ) {
        throw new Error(
          data?.message ||
          "Invalid orders response."
        );
      }

      allOrders =
        data.orders;

      // ================================================================
      // THIS IS THE IMPORTANT PART
      // ================================================================
      //
      // The admin has now opened the Orders page.
      //
      // Therefore:
      //
      // old orders  → read
      // current orders → read
      // future orders → unread
      //
      updateOrdersBadge(
        allOrders,
        {
          markCurrentAsRead: true,
        }
      );

      render();

    }

    catch (error) {

      console.error(
        "Failed to load orders:",
        error
      );

      ordersTableBody.innerHTML = `
        <tr>
          <td
            colspan="7"
            style="
              text-align:center;
              padding:40px;
              color:#ef4444;
            "
          >
            Failed to load orders.
            Is the server running at
            ${escapeHtml(API_BASE)}?
          </td>
        </tr>
      `;

      // Don't display a fake number when
      // the API request failed.
      setOrdersBadge(0);
    }
  }

  // ==========================================================================
  // SEARCH
  // ==========================================================================

  if (orderSearch) {
    orderSearch.addEventListener(
      "input",
      render
    );
  }

  // ==========================================================================
  // STATUS FILTER
  // ==========================================================================

  if (statusFilter) {
    statusFilter.addEventListener(
      "change",
      render
    );
  }

  // ==========================================================================
  // DATE FILTER
  // ==========================================================================

  if (dateFilter) {
    dateFilter.addEventListener(
      "change",
      render
    );
  }

  // ==========================================================================
  // INITIALIZE
  // ==========================================================================

  document.addEventListener(
    "DOMContentLoaded",
    () => {
      loadOrders();
    }
  );

})();