// =================================================================
// Admin Orders page — loads real orders from the backend/database.
// =================================================================
(function () {
  "use strict";

  const API_BASE = "http://127.0.0.1:5000";

  const ordersTableBody =
    document.getElementById(
      "ordersTableBody"
    );

  const orderSearch =
    document.getElementById(
      "orderSearch"
    );

  const statusFilter =
    document.getElementById(
      "statusFilter"
    );

  const dateFilter =
    document.getElementById(
      "dateFilter"
    );

  const pageInfo =
    document.querySelector(
      ".page-info"
    );

  const badge =
    document.querySelector(
      ".sidebar-badge"
    );

  const STATUS_LABELS = {
    placed: "Placed",
    confirmed: "Confirmed",
    pending: "Placed",
    processing: "Processing",
    shipped: "Shipped",
    delivered: "Delivered",
    cancelled: "Cancelled",
  };

  let allOrders = [];

  function escapeHtml(str) {
    if (
      str === null ||
      str === undefined
    ) {
      return "";
    }

    const div =
      document.createElement(
        "div"
      );

    div.appendChild(
      document.createTextNode(
        String(str)
      )
    );

    return div.innerHTML;
  }

  function money(value) {
    const n =
      Number(value) || 0;

    return "$" +
      n.toFixed(2);
  }

  function formatDate(raw) {
    if (!raw) return "—";

    const d =
      new Date(raw);

    if (
      Number.isNaN(
        d.getTime()
      )
    ) {
      return raw;
    }

    return (
      d.toLocaleDateString(
        "en-US",
        {
          month: "short",
          day: "numeric",
          year: "numeric",
        }
      ) +
      " " +
      d.toLocaleTimeString(
        "en-US",
        {
          hour: "2-digit",
          minute: "2-digit",
        }
      )
    );
  }

  function buyerName(order) {
    // The account username is the name shown in the admin Orders list.
    // Fall back to the older customer-name fields for legacy orders.
    return (
      order.username ||
      (
        (order.customer_name || "") +
        " " +
        (order.customer_lastname || "")
      ).trim() ||
      order.customer_email ||
      "Anonymous"
    );
  }

  function itemsLabel(order) {
    const items =
      order.items || [];

    const count =
      items.reduce(
        (
          sum,
          it
        ) =>
          sum +
          (
            Number(
              it.quantity
            ) || 0
          ),
        0
      );

    const first =
      items[0];

    let label = "";

    if (first) {
      label =
        first.product_name +
        (
          items.length > 1
            ? " +" +
              (
                items.length -
                1
              )
            : ""
        );
    }

    if (
      count > 1 &&
      first
    ) {
      label +=
        " x" +
        (
          first.quantity ||
          1
        );
    }

    return (
      label || "—"
    );
  }

  function statusClass(status) {
    const s =
      (
        status ||
        "pending"
      ).toLowerCase();

    return s === "pending"
      ? "processing"
      : s;
  }

  function render() {
    if (!ordersTableBody) {
      return;
    }

    const search =
      (
        orderSearch
          ? orderSearch.value
          : ""
      ).toLowerCase();

    const status =
      statusFilter
        ? statusFilter.value
        : "all";

    const date =
      dateFilter
        ? dateFilter.value
        : "all";

    const now =
      new Date();

    const filtered =
      allOrders.filter(
        (order) => {
          const rowText =
            (
              "#" +
              order.id +
              " " +
              buyerName(
                order
              ) +
              " " +
              itemsLabel(
                order
              )
            ).toLowerCase();

          const matchSearch =
            !search ||
            rowText.includes(
              search
            );

          const matchStatus =
            status === "all" ||
            (
              order.status ||
              ""
            ).toLowerCase() ===
              status;

          let matchDate =
            true;

          if (
            date &&
            date !== "all" &&
            order.created_at
          ) {
            const d =
              new Date(
                order.created_at
              );

            if (
              date === "today"
            ) {
              matchDate =
                d.toDateString() ===
                now.toDateString();

            } else if (
              date === "week"
            ) {
              const weekAgo =
                new Date();

              weekAgo.setDate(
                now.getDate() -
                  7
              );

              matchDate =
                d >= weekAgo;

            } else if (
              date === "month"
            ) {
              const monthAgo =
                new Date();

              monthAgo.setMonth(
                now.getMonth() -
                  1
              );

              matchDate =
                d >= monthAgo;
            }
          }

          return (
            matchSearch &&
            matchStatus &&
            matchDate
          );
        }
      );

    if (
      filtered.length === 0
    ) {
      ordersTableBody.innerHTML =
        '<tr><td colspan="7" style="text-align:center;padding:40px;color:#94a3b8;">No orders found.</td></tr>';

    } else {
      ordersTableBody.innerHTML =
        filtered
          .map(
            (order) => {
              const statusLabel =
                STATUS_LABELS[
                  (
                    order.status ||
                    ""
                  ).toLowerCase()
                ] ||
                order.status ||
                "Pending";

              const cls =
                statusClass(
                  order.status
                );

              return (
                '<tr data-status="' +
                escapeHtml(
                  (
                    order.status ||
                    "pending"
                  ).toLowerCase()
                ) +
                '">' +

                "<td><strong>#" +
                order.id +
                "</strong></td>" +

                "<td>" +
                escapeHtml(
                  buyerName(
                    order
                  )
                ) +
                "</td>" +

                "<td>" +
                escapeHtml(
                  itemsLabel(
                    order
                  )
                ) +
                "</td>" +

                "<td>" +
                formatDate(
                  order.created_at
                ) +
                "</td>" +

                '<td class="table-amount">' +
                money(
                  order.total
                ) +
                "</td>" +

                "<td><span class='dash-order-status " +
                cls +
                "'>" +
                escapeHtml(
                  statusLabel
                ) +
                "</span></td>" +

                '<td class="table-actions">' +
                '<a class="btn-text" href="view-order.html?id=' +
                order.id +
                '">View</a>' +
                "</td>" +

                "</tr>"
              );
            }
          )
          .join("");
    }

    if (pageInfo) {
      pageInfo.textContent =
        "Showing 1-" +
        filtered.length +
        " of " +
        allOrders.length +
        " orders";
    }

    if (badge) {
      badge.textContent =
        String(
          allOrders.length
        );
    }
  }

  async function loadOrders() {
    if (!ordersTableBody) {
      return;
    }

    try {
      const token =
        sessionStorage.getItem(
          "token"
        );

      const response =
        await fetch(
          API_BASE +
            "/orders",
          {
            headers: {
              "Authorization":
                `Bearer ${token}`
            }
          }
        );

      const data =
        await response.json();

      if (data.success) {
        allOrders =
          data.orders || [];
      }

    } catch (err) {
      console.error(
        "Failed to load orders",
        err
      );

      ordersTableBody.innerHTML =
        '<tr><td colspan="7" style="text-align:center;padding:40px;color:#ef4444;">Failed to load orders. Is the server running at ' +
        API_BASE +
        "?</td></tr>";
    }

    render();
  }

  if (orderSearch) {
    orderSearch.addEventListener(
      "input",
      render
    );
  }

  if (statusFilter) {
    statusFilter.addEventListener(
      "change",
      render
    );
  }

  if (dateFilter) {
    dateFilter.addEventListener(
      "change",
      render
    );
  }

  loadOrders();
})();