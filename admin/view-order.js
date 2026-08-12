(function () {
  "use strict";

  const API_BASE = "http://127.0.0.1:5000";

  const orderId =
    new URLSearchParams(
      window.location.search
    ).get("id");

  var orderData = null;


  // ===========================================================
  // EXACT ORDER FLOW
  // ===========================================================

  var statusFlow = [
    "placed",
    "confirmed",
    "processing",
    "shipped",
    "delivered"
  ];


  var statusConfig = {

    pending: {
      label: "Placed",
      iconClass: "placed-icon",
      desc: "Order has been placed by the customer"
    },

    placed: {
      label: "Order Placed",
      iconClass: "placed-icon",
      desc: "Order has been placed by the customer"
    },

    confirmed: {
      label: "Order Confirmed",
      iconClass: "confirmed-icon",
      desc: "Order has been confirmed"
    },

    processing: {
      label: "Processing",
      iconClass: "processing-icon",
      desc: "Order is being prepared for shipment"
    },

    shipped: {
      label: "Shipped",
      iconClass: "shipped-icon",
      desc: "Order has been dispatched to the carrier"
    },

    delivered: {
      label: "Delivered",
      iconClass: "delivered-icon",
      desc: "Order has been delivered to the customer"
    },

    cancelled: {
      label: "Cancelled",
      iconClass: "processing-icon",
      desc: "Order has been cancelled"
    }

  };


  var statusIcons = {

    placed:
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',

    confirmed:
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>',

    processing:
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0-1-1.51V3a2 2 0 0 0 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',

    shipped:
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>',

    delivered:
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'

  };


  var elms = {};

  var pendingStatus = null;


  function $(id) {
    return document.getElementById(id);
  }


  function escapeHtml(str) {

    if (
      str === null ||
      str === undefined
    ) {
      return "";
    }

    var div =
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

    var n =
      Number(value) || 0;

    return "$" +
      n.toFixed(2);
  }


  function formatDate(raw) {

    if (!raw) {
      return "—";
    }

    var d =
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
          year: "numeric",
          month: "short",
          day: "numeric"
        }
      )
      +
      " at "
      +
      d.toLocaleTimeString(
        "en-US",
        {
          hour: "2-digit",
          minute: "2-digit"
        }
      )
    );
  }


  function fullName() {

    return (
      (
        orderData.customer_name ||
        ""
      )
      +
      " "
      +
      (
        orderData.customer_lastname ||
        ""
      )
    ).trim();
  }


  function loadElms() {

    elms.sidebar =
      $("adminSidebar");

    elms.menuToggle =
      $("menuToggle");

    elms.statusBadge =
      $("currentStatusBadge");

    elms.orderTimeline =
      $("orderTimeline");

    elms.orderItemsEl =
      $("orderItems");

    elms.orderSummaryEl =
      $("orderSummary");

    elms.statusControl =
      $("statusControl");

    elms.lockedNotice =
      $("lockedNotice");

    elms.toast =
      $("voToast");

    elms.toastMsg =
      $("voToastMsg");

    elms.toastBackdrop =
      $("voToastBackdrop");

    elms.statusModal =
      $("statusModal");

    elms.statusModalTitle =
      $("statusModalTitle");

    elms.statusModalDesc =
      $("statusModalDesc");

    elms.statusModalWarning =
      $("statusModalWarning");

    elms.statusModalCancel =
      $("statusModalCancel");

    elms.statusModalConfirm =
      $("statusModalConfirm");

    elms.refundModal =
      $("refundModal");

    elms.refundModalCancel =
      $("refundModalCancel");

    elms.refundModalConfirm =
      $("refundModalConfirm");

    elms.refundBtn =
      $("refundBtn");

    elms.printBtn =
      $("printBtn");

    elms.breadcrumb =
      $("voBreadcrumbSpan");
  }


  function initUI() {

    loadElms();


    if (
      elms.menuToggle &&
      elms.sidebar
    ) {

      elms.menuToggle.addEventListener(
        "click",
        function () {

          elms.sidebar.classList.toggle(
            "open"
          );

        }
      );


      document.addEventListener(
        "click",
        function (e) {

          if (
            window.innerWidth <= 768 &&
            elms.sidebar.classList.contains(
              "open"
            ) &&
            !elms.sidebar.contains(
              e.target
            ) &&
            !elms.menuToggle.contains(
              e.target
            )
          ) {

            elms.sidebar.classList.remove(
              "open"
            );
          }

        }
      );
    }


    if (
      elms.statusModalCancel
    ) {

      elms.statusModalCancel.addEventListener(
        "click",
        function () {

          elms.statusModal.classList.remove(
            "show"
          );

          pendingStatus = null;
        }
      );
    }


    if (
      elms.statusModalConfirm
    ) {

      elms.statusModalConfirm.addEventListener(
        "click",
        function () {

          if (!pendingStatus) {
            return;
          }

          updateStatus(
            pendingStatus
          );
        }
      );
    }


    if (elms.refundBtn) {

      elms.refundBtn.addEventListener(
        "click",
        function () {

          elms.refundModal.classList.add(
            "show"
          );

        }
      );
    }


    if (
      elms.refundModalCancel
    ) {

      elms.refundModalCancel.addEventListener(
        "click",
        function () {

          elms.refundModal.classList.remove(
            "show"
          );

        }
      );
    }


    if (
      elms.refundModalConfirm
    ) {

      elms.refundModalConfirm.addEventListener(
        "click",
        function () {

          elms.refundModal.classList.remove(
            "show"
          );

          showToast(
            "Refund of $" +
            (
              orderData
                ? Number(
                    orderData.total
                  ).toFixed(2)
                : "0.00"
            ) +
            " processed",
            "success"
          );

        }
      );
    }


    if (elms.printBtn) {

      elms.printBtn.addEventListener(
        "click",
        function () {

          window.print();

        }
      );
    }


    [
      elms.statusModal,
      elms.refundModal
    ].forEach(
      function (modal) {

        if (!modal) {
          return;
        }

        modal.addEventListener(
          "click",
          function (e) {

            if (
              e.target === modal
            ) {

              modal.classList.remove(
                "show"
              );

              pendingStatus = null;
            }

          }
        );

      }
    );


    document.addEventListener(
      "keydown",
      function (e) {

        if (e.key === "Escape") {

          if (elms.statusModal) {
            elms.statusModal.classList.remove(
              "show"
            );
          }

          if (elms.refundModal) {
            elms.refundModal.classList.remove(
              "show"
            );
          }

          pendingStatus = null;
        }

      }
    );
  }


  function renderItems() {

    if (!elms.orderItemsEl) {
      return;
    }

    elms.orderItemsEl.innerHTML = "";


    var items =
      orderData.items || [];


    var countEl =
      document.querySelector(
        ".vo-card-count"
      );


    if (countEl) {

      countEl.textContent =
        items.length +
        " items";
    }


    if (items.length === 0) {

      elms.orderItemsEl.innerHTML =
        '<p style="color:#94a3b8;padding:20px;">No items.</p>';

      return;
    }


    items.forEach(
      function (item) {

        var div =
          document.createElement(
            "div"
          );

        div.className =
          "vo-item";


        var image =
          item.image &&
          item.image !== ""
            ? API_BASE +
              "/uploads/products/" +
              item.image
            : "https://picsum.photos/seed/ord" +
              (
                item.product_id ||
                item.id
              ) +
              "/200/200.jpg";


        var unitPrice =
          Number(
            item.unit_price
          ) || 0;


        var qty =
          Number(
            item.quantity
          ) || 1;


        div.innerHTML =
          '<div class="vo-item-img">' +
          '<img src="' +
          image +
          '" alt="' +
          escapeHtml(
            item.product_name
          ) +
          '" /></div>' +

          '<div class="vo-item-info">' +
          '<h4>' +
          escapeHtml(
            item.product_name ||
            "Product"
          ) +
          "</h4>" +

          '<p class="vo-item-qty">' +
          "Qty: " +
          qty +
          "</p>" +

          (
            item.original_price &&
            item.original_price >
              unitPrice

              ? '<p class="vo-item-variant">Was ' +
                money(
                  item.original_price
                ) +
                " each</p>"

              : ""
          ) +

          "</div>" +

          '<div class="vo-item-price">' +
          money(
            item.total != null
              ? item.total
              : unitPrice * qty
          ) +
          "</div>";


        elms.orderItemsEl.appendChild(
          div
        );
      }
    );
  }


  function renderSummary() {

    if (!elms.orderSummaryEl) {
      return;
    }


    var subtotal =
      Number(
        orderData.subtotal
      ) || 0;


    var shipping =
      Number(
        orderData.shipping
      ) || 0;


    var tax =
      Number(
        orderData.tax
      ) || 0;


    var discount =
      Number(
        orderData.discount
      ) || 0;


    var total =
      orderData.total != null
        ? Number(
            orderData.total
          )
        : (
            subtotal +
            shipping +
            tax
          );


    var html =
      '<div class="vo-summary-row">' +
      "<span>Subtotal</span>" +
      "<span>" +
      money(subtotal) +
      "</span></div>" +

      '<div class="vo-summary-row">' +
      "<span>Shipping</span>" +
      "<span>" +
      money(shipping) +
      "</span></div>" +

      '<div class="vo-summary-row">' +
      "<span>Tax</span>" +
      "<span>" +
      money(tax) +
      "</span></div>";


    if (discount > 0) {

      html +=
        '<div class="vo-summary-row discount">' +
        "<span>Discount</span>" +
        "<span>-$" +
        discount.toFixed(2) +
        "</span></div>";
    }


    html +=
      '<div class="vo-summary-row total">' +
      "<span>Total</span>" +
      "<span>" +
      money(total) +
      "</span></div>";


    elms.orderSummaryEl.innerHTML =
      html;
  }


  function renderStatusBadge() {

    if (!elms.statusBadge) {
      return;
    }


    var status =
      (
        orderData.status ||
        "placed"
      ).toLowerCase();


    if (status === "pending") {
      status = "placed";
    }


    var cfg =
      statusConfig[status] ||
      statusConfig.placed;


    elms.statusBadge.className =
      "vo-status-badge " +
      status;


    elms.statusBadge.innerHTML =
      '<span class="vo-status-dot"></span>' +
      '<span class="vo-status-text">' +
      cfg.label +
      "</span>";
  }


  function renderTimeline() {

    if (!elms.orderTimeline) {
      return;
    }


    var steps =
      elms.orderTimeline.querySelectorAll(
        ".vo-tl-step"
      );


    var lines =
      elms.orderTimeline.querySelectorAll(
        ".vo-tl-line"
      );


    var status =
      (
        orderData.status ||
        "placed"
      ).toLowerCase();


    if (status === "pending") {
      status = "placed";
    }


    var flow = [
      "placed",
      "confirmed",
      "processing",
      "shipped",
      "delivered"
    ];


    var currentIdx =
      flow.indexOf(status);


    if (currentIdx < 0) {
      currentIdx = 0;
    }


    for (
      var i = 0;
      i < steps.length;
      i++
    ) {

      var step =
        steps[i];


      var stepStatus =
        step.getAttribute(
          "data-step"
        );


      var stepIdx =
        flow.indexOf(
          stepStatus
        );


      var isCompleted =
        stepIdx <
        currentIdx;


      var isActive =
        stepIdx ===
        currentIdx &&
        status !== "cancelled";


      step.className =
        "vo-tl-step";


      if (isCompleted) {

        step.classList.add(
          "completed"
        );

      } else if (isActive) {

        step.classList.add(
          "active"
        );
      }


      var dot =
        step.querySelector(
          ".vo-tl-dot"
        );


      if (dot) {

        dot.innerHTML =
          isCompleted

            ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg>'

            : (
                isActive
                  ? '<span class="vo-tl-pulse"></span>'
                  : ""
              );
      }


      var info =
        step.querySelector(
          ".vo-tl-info"
        );


      if (info) {

        var dateSpan =
          info.querySelector(
            "span"
          );


        if (dateSpan) {

          dateSpan.className =
            "";


          if (isCompleted) {

            dateSpan.textContent =
              "Completed";

          } else if (isActive) {

            dateSpan.textContent =
              "Current";

          } else {

            dateSpan.className =
              "vo-tl-pending";

            dateSpan.textContent =
              "Pending";
          }
        }
      }


      var line =
        lines[i];


      if (line) {

        line.className =
          "vo-tl-line";


        if (
          stepIdx <
          currentIdx
        ) {

          line.classList.add(
            "completed"
          );

        } else if (isActive) {

          line.classList.add(
            "active"
          );
        }
      }
    }
  }


  function renderStatusControl() {

    if (!elms.statusControl) {
      return;
    }


    elms.statusControl.innerHTML =
      "";


    var status =
      (
        orderData.status ||
        "placed"
      ).toLowerCase();


    if (status === "pending") {
      status = "placed";
    }


    // ---------------------------------------------------------
    // CANCELLED
    // ---------------------------------------------------------

    if (status === "cancelled") {

      var cancelledBtn =
        document.createElement(
          "div"
        );


      cancelledBtn.className =
        "vo-status-btn past";


      cancelledBtn.innerHTML =
        '<div class="vo-status-btn-icon processing-icon">' +
        statusIcons.processing +
        "</div>" +

        '<div class="vo-status-btn-text">' +
        "<strong>Cancelled</strong>" +
        "<span>Order has been cancelled</span>" +
        "</div>" +

        '<span class="vo-status-btn-tag tag-done">Done</span>';


      elms.statusControl.appendChild(
        cancelledBtn
      );


      if (elms.lockedNotice) {

        elms.lockedNotice.style.display =
          "flex";
      }


      return;
    }


    if (elms.lockedNotice) {

      elms.lockedNotice.style.display =
        "none";
    }


    var currentIdx =
      statusFlow.indexOf(
        status
      );


    if (currentIdx < 0) {
      currentIdx = 0;
    }


    statusFlow.forEach(
      function (s, idx) {

        var cfg =
          statusConfig[s];


        var isPast =
          idx < currentIdx;


        var isCurrent =
          idx === currentIdx;


        var isNext =
          idx ===
          currentIdx + 1;


        var isLocked =
          idx >
          currentIdx + 1;


        var btn =
          document.createElement(
            "button"
          );


        btn.type =
          "button";


        btn.className =
          "vo-status-btn";


        if (isPast) {

          btn.classList.add(
            "past"
          );

        } else if (isCurrent) {

          btn.classList.add(
            "current"
          );

        } else if (isNext) {

          btn.classList.add(
            "available"
          );

        } else {

          btn.classList.add(
            "locked"
          );
        }


        var tagHtml = "";


        if (isPast) {

          tagHtml =
            '<span class="vo-status-btn-tag tag-done">Done</span>';

        } else if (isCurrent) {

          tagHtml =
            '<span class="vo-status-btn-tag tag-current">Current</span>';

        } else if (isNext) {

          tagHtml =
            '<span class="vo-status-btn-tag tag-click">Click to Update</span>';

        } else if (isLocked) {

          tagHtml =
            '<span class="vo-status-btn-tag tag-locked">Locked</span>';
        }


        var arrowHtml =
          isNext

            ? '<svg class="vo-status-btn-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6" /></svg>'

            : "";


        btn.innerHTML =
          '<div class="vo-status-btn-icon ' +
          cfg.iconClass +
          '">' +
          statusIcons[s] +
          "</div>" +

          '<div class="vo-status-btn-text">' +
          "<strong>" +
          cfg.label +
          "</strong>" +
          "<span>" +
          cfg.desc +
          "</span>" +
          "</div>" +

          tagHtml +

          arrowHtml;


        if (isNext) {

          (function (
            targetStatus
          ) {

            btn.addEventListener(
              "click",
              function () {

                openStatusModal(
                  targetStatus
                );

              }
            );

          })(s);
        }


        elms.statusControl.appendChild(
          btn
        );

      }
    );
  }


  function openStatusModal(
    newStatus
  ) {

    pendingStatus =
      newStatus;


    var cfg =
      statusConfig[
        newStatus
      ];


    elms.statusModalTitle.textContent =
      "Mark as " +
      cfg.label +
      "?";


    elms.statusModalDesc.innerHTML =
      "Change order <strong>#" +
      orderData.id +
      "</strong> to <strong>" +
      cfg.label +
      "</strong>?";


    elms.statusModalWarning.style.display =
      "block";


    elms.statusModal.classList.add(
      "show"
    );
  }


  async function updateStatus(
    newStatus
  ) {

    elms.statusModal.classList.remove(
      "show"
    );


    try {

      const token =
        sessionStorage.getItem(
          "token"
        );


      const response =
        await fetch(
          API_BASE +
          "/orders/" +
          orderData.id +
          "/status",
          {
            method: "PUT",

            headers: {
              "Content-Type":
                "application/json",

              "Authorization":
                "Bearer " +
                token
            },

            body:
              JSON.stringify({
                status:
                  newStatus
              })
          }
        );


      const data =
        await response.json();


      if (data.success) {

        // IMPORTANT:
        // Replace local state with the backend response.

        orderData =
          data.order;


        window.__orderData =
          orderData;


        renderStatusBadge();

        renderTimeline();

        renderStatusControl();


        showToast(
          "Order marked as " +
          (
            statusConfig[
              newStatus
            ] || {
              label: newStatus
            }
          ).label,
          "success"
        );

      } else {

        showToast(
          data.message ||
          "Failed to update status",
          "warn"
        );
      }

    } catch (err) {

      console.error(
        "Failed to update status",
        err
      );

      showToast(
        "Failed to update status.",
        "warn"
      );
    }


    pendingStatus = null;
  }


  var toastTimer = null;


  function showToast(
    message,
    type
  ) {

    if (
      !elms.toast ||
      !elms.toastMsg
    ) {
      return;
    }


    clearTimeout(
      toastTimer
    );


    elms.toastMsg.textContent =
      message;


    var icon =
      elms.toast.querySelector(
        "svg"
      );


    if (type === "warn") {

      icon.style.color =
        "#f59e0b";

      icon.innerHTML =
        '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>';

    } else {

      icon.style.color =
        "#22c55e";

      icon.innerHTML =
        '<path d="M20 6L9 17l-5-5"/>';
    }


    elms.toast.classList.add(
      "show"
    );


    if (
      elms.toastBackdrop
    ) {

      elms.toastBackdrop.classList.add(
        "show"
      );
    }


    toastTimer =
      setTimeout(
        function () {

          elms.toast.classList.remove(
            "show"
          );

          if (
            elms.toastBackdrop
          ) {

            elms.toastBackdrop.classList.remove(
              "show"
            );
          }

        },
        3000
      );
  }


  function renderCustomer() {

    var fullNameStr =
      fullName();


    var email =
      orderData.customer_email ||
      "";


    var buyerName =
      document.querySelector(
        ".vo-customer-top strong"
      );


    var buyerEmail =
      document.querySelector(
        ".vo-customer-top div span"
      );


    var buyerAvatar =
      document.querySelector(
        ".vo-customer-avatar"
      );


    if (buyerName) {

      buyerName.textContent =
        fullNameStr ||
        "Anonymous";
    }


    if (buyerEmail) {

      buyerEmail.textContent =
        email ||
        "—";
    }


    if (buyerAvatar) {

      buyerAvatar.textContent =
        (
          fullNameStr ||
          "A"
        )
          .split(" ")
          .map(
            function (w) {
              return w[0] || "";
            }
          )
          .join("")
          .toUpperCase()
          .slice(0, 2);
    }


    var detailRows =
      document.querySelectorAll(
        ".vo-customer-details .vo-detail-row"
      );


    if (detailRows[0]) {

      var spans =
        detailRows[0].querySelectorAll(
          "span"
        );


      if (spans[0]) {

        spans[0].textContent =
          orderData.customer_phone ||
          "—";
      }
    }


    if (detailRows[1]) {

      var spans2 =
        detailRows[1].querySelectorAll(
          "span"
        );


      if (spans2[0]) {

        spans2[0].textContent =
          "Order #" +
          orderData.id;
      }
    }


    var addressBlocks =
      document.querySelectorAll(
        ".vo-address-block"
      );


    var addressParts = [

      fullNameStr ||
      "Anonymous",

      orderData.customer_address,

      orderData.customer_architecture,

      orderData.customer_floor
        ? "Floor: " +
          orderData.customer_floor
        : ""

    ].filter(
      function (p) {

        return (
          p &&
          String(p).trim()
        );

      }
    );


    addressBlocks.forEach(
      function (block) {

        var ps =
          block.querySelectorAll(
            "p"
          );


        if (ps[0]) {

          ps[0].textContent =
            addressParts[0] ||
            "—";
        }


        for (
          var i = 1;
          i < ps.length;
          i++
        ) {

          ps[i].textContent =
            addressParts[i] ||
            "";

          ps[i].style.display =
            addressParts[i]
              ? ""
              : "none";
        }

      }
    );


    var paymentRows =
      document.querySelectorAll(
        ".vo-payment-row"
      );


    if (paymentRows[0]) {

      var methodSpan =
        paymentRows[0].querySelector(
          ".vo-payment-method span"
        );


      if (methodSpan) {

        methodSpan.textContent =
          orderData.payment_method ||
          "—";
      }
    }


    if (paymentRows[1]) {

      var statusSpan =
        paymentRows[1].querySelectorAll(
          "span"
        )[1];


      if (statusSpan) {

        var pm =
          (
            orderData.payment_method ||
            "card"
          ).toLowerCase();


        statusSpan.textContent =
          pm === "cod"
            ? "Cash on Delivery"
            : "Paid";
      }
    }
  }


  function renderHeader() {

    var orderIdEl =
      document.querySelector(
        ".vo-order-id h1"
      );


    var dateEl =
      document.querySelector(
        ".vo-order-date"
      );


    var crumb =
      document.querySelector(
        ".vo-breadcrumb span"
      );


    if (orderIdEl) {

      orderIdEl.textContent =
        "#" +
        orderData.id;
    }


    if (dateEl) {

      dateEl.textContent =
        "Placed on " +
        formatDate(
          orderData.created_at
        );
    }


    if (crumb) {

      crumb.textContent =
        "Order #" +
        orderData.id;
    }
  }


  async function loadOrder() {

    initUI();


    if (!orderId) {

      document.querySelector(
        ".admin-content"
      ).innerHTML =
        '<div class="vo-card" style="padding:40px;text-align:center;color:#ef4444;">No order selected. <a href="orders.html">Back to Orders</a></div>';

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
          "/orders/" +
          orderId,
          {
            headers: {
              "Authorization":
                "Bearer " +
                token
            }
          }
        );


      const data =
        await response.json();


      if (!data.success) {

        document.querySelector(
          ".admin-content"
        ).innerHTML =
          '<div class="vo-card" style="padding:40px;text-align:center;color:#ef4444;">' +
          (
            data.message ||
            "Order not found"
          ) +
          ' <a href="orders.html">Back to Orders</a></div>';

        return;
      }


      orderData =
        data.order;


      window.__orderData =
        orderData;


      window.dispatchEvent(
        new CustomEvent(
          "order-loaded",
          {
            detail:
              orderData
          }
        )
      );


      renderHeader();

      renderCustomer();

      renderItems();

      renderSummary();

      renderStatusBadge();

      renderTimeline();

      renderStatusControl();


    } catch (err) {

      console.error(
        "Failed to load order",
        err
      );


      document.querySelector(
        ".admin-content"
      ).innerHTML =
        '<div class="vo-card" style="padding:40px;text-align:center;color:#ef4444;">Failed to load order. Is the server running?</div>';
    }
  }


  loadOrder();

})();