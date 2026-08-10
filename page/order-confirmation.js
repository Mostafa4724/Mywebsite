(function () {
  "use strict";

  var order = {
    id: "ORD-2025-0042",
    status: "processing",
    created_at: "2025-01-18T15:42:00",
    updated_at: "2025-01-19T09:00:00",
    customer_name: "John",
    customer_lastname: "Doe",
    customer_email: "john.doe@email.com",
    customer_phone: "+1 (555) 234-5678",
    customer_address: "742 Evergreen Terrace",
    customer_architecture: "Apt 4B",
    payment_method: "Visa ending in 4242",
    subtotal: 189.97,
    shipping: 15.0,
    tax: 14.24,
    discount: 4.3,
    total: 214.91,
    items: [
      {
        product_name: "Classic White Sneakers",
        unit_price: 64.99,
        quantity: 1,
        total: 64.99,
        image: "https://picsum.photos/seed/sneaker42/200/200.jpg",
      },
      {
        product_name: "Minimal Leather Watch",
        unit_price: 89.99,
        quantity: 1,
        total: 89.99,
        image: "https://picsum.photos/seed/watch77/200/200.jpg",
      },
      {
        product_name: "Cotton Crew Socks (3-Pack)",
        unit_price: 11.99,
        quantity: 3,
        total: 34.99,
        image: "https://picsum.photos/seed/socks12/200/200.jpg",
      },
    ],
  };

  var statuses = ["placed", "confirmed", "processing", "shipped", "delivered"];

  var labels = {
    placed: "Order Placed",
    confirmed: "Order Confirmed",
    processing: "Processing",
    shipped: "Shipped",
    delivered: "Delivered",
  };

  var headings = {
    placed: "Order Received!",
    confirmed: "Order Confirmed!",
    processing: "Processing Your Order",
    shipped: "Your Order Is On Its Way!",
    delivered: "Order Delivered!",
  };

  var messages = {
    placed:
      "Your order has been received and is being reviewed. We'll send you a confirmation email shortly with all the details.",
    confirmed:
      "Great news \u2014 your order has been confirmed and is now being prepared. We'll let you know as soon as it ships.",
    processing:
      "Your order is currently being prepared and packaged by our team. You'll receive a tracking number once it's shipped.",
    shipped:
      "Your package is on its way! Use the tracking details to follow your delivery in real time.",
    delivered:
      "Your order has been delivered successfully. We hope you love your purchase \u2014 thank you for shopping with us!",
  };

  var heroIcons = {
    placed:
      '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',
    confirmed:
      '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>',
    processing:
      '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    shipped:
      '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>',
    delivered:
      '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
  };

  var msgIcons = {
    placed:
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    confirmed:
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>',
    processing:
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    shipped:
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>',
    delivered:
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
  };

  var checkSvg =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

  var tlSteps = [
    { key: "placed", label: "Placed" },
    { key: "confirmed", label: "Confirmed" },
    { key: "processing", label: "Processing" },
    { key: "shipped", label: "Shipped" },
    { key: "delivered", label: "Delivered" },
  ];

  function esc(s) {
    var d = document.createElement("div");
    d.appendChild(document.createTextNode(s || ""));
    return d.innerHTML;
  }

  function money(v) {
    return "$" + (Number(v) || 0).toFixed(2);
  }

  function formatDate(raw) {
    var d = new Date(raw);
    return (
      d.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }) +
      " at " +
      d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
    );
  }

  function render() {
    var status = order.status;
    var idx = statuses.indexOf(status);
    if (idx < 0) idx = 0;
    var name = (order.customer_name + " " + order.customer_lastname).trim();
    var h = "";

    /* Hero */
    h += '<div class="oc-hero">';
    h +=
      '<div class="oc-hero-icon ' +
      status +
      '">' +
      heroIcons[status] +
      "</div>";
    h += "<h1>" + headings[status] + "</h1>";
    h +=
      '<p class="oc-sub">Order <strong>#' +
      esc(order.id) +
      "</strong> &middot; " +
      formatDate(order.created_at) +
      "</p>";
    h +=
      '<span class="oc-pill ' +
      status +
      '"><span class="dot"></span>' +
      labels[status] +
      "</span>";
    h += "</div>";

    /* Timeline */
    h += '<div class="oc-card">';
    h +=
      '<div class="oc-card-head"><h3>Order Status</h3><span>' +
      formatDate(order.updated_at) +
      "</span></div>";
    h += '<div class="oc-timeline">';

    tlSteps.forEach(function (step, i) {
      var done = i < idx;
      var active = i === idx;
      var cls =
        "oc-tl-step" +
        (done ? " completed" : "") +
        (active ? " active " + status : "");

      h += '<div class="' + cls + '">';
      h +=
        '<div class="oc-tl-dot">' +
        (done ? checkSvg : active ? '<span class="oc-tl-pulse"></span>' : "") +
        "</div>";
      h +=
        '<div class="oc-tl-info"><strong>' +
        step.label +
        "</strong><span>" +
        (done
          ? "Completed"
          : active
            ? "Current"
            : '<span class="oc-tl-pending">Pending</span>') +
        "</span></div>";
      h += "</div>";

      if (i < tlSteps.length - 1) {
        var lc =
          "oc-tl-line" +
          (done ? " completed" : "") +
          (active ? " active " + status : "");
        h += '<div class="' + lc + '"></div>';
      }
    });

    h += "</div>";
    h +=
      '<div class="oc-msg ' +
      status +
      '">' +
      msgIcons[status] +
      "<span>" +
      messages[status] +
      "</span></div>";
    h += "</div>";

    /* Items */
    h += '<div class="oc-card">';
    h +=
      '<div class="oc-card-head"><h3>Order Items</h3><span>' +
      order.items.length +
      " items</span></div>";
    h += '<div class="oc-items">';

    order.items.forEach(function (item) {
      h += '<div class="oc-item">';
      h +=
        '<div class="oc-item-img"><img src="' +
        item.image +
        '" alt="' +
        esc(item.product_name) +
        '" /></div>';
      h += '<div class="oc-item-info"><h4>' + esc(item.product_name) + "</h4>";
      h +=
        '<p class="oc-item-qty">Qty: ' +
        item.quantity +
        " &middot; " +
        money(item.unit_price) +
        " each</p></div>";
      h += '<div class="oc-item-price">' + money(item.total) + "</div>";
      h += "</div>";
    });

    h += "</div></div>";

    /* Details */
    h += '<div class="oc-card">';
    h += '<div class="oc-card-head"><h3>Order Details</h3></div>';
    h += '<div class="oc-info-rows">';

    var addr = [order.customer_address, order.customer_architecture].filter(
      Boolean,
    );
    h +=
      '<div class="oc-info-row"><span class="oc-info-label">Shipping To</span><span class="oc-info-value"><strong>' +
      esc(name) +
      "</strong><br>" +
      addr.map(esc).join("<br>") +
      "</span></div>";
    h +=
      '<div class="oc-info-row"><span class="oc-info-label">Payment</span><span class="oc-info-value"><span class="oc-pay-badge">' +
      esc(order.payment_method) +
      "</span></span></div>";
    h +=
      '<div class="oc-info-row"><span class="oc-info-label">Email</span><span class="oc-info-value">' +
      esc(order.customer_email) +
      "</span></div>";
    h +=
      '<div class="oc-info-row"><span class="oc-info-label">Phone</span><span class="oc-info-value">' +
      esc(order.customer_phone) +
      "</span></div>";

    h += "</div></div>";

    /* Summary */
    h += '<div class="oc-card">';
    h += '<div class="oc-card-head"><h3>Order Summary</h3></div>';
    h += '<div class="oc-summary">';
    h +=
      '<div class="oc-sum-row"><span>Subtotal</span><span>' +
      money(order.subtotal) +
      "</span></div>";
    h +=
      '<div class="oc-sum-row discount"><span>Discount</span><span>-' +
      money(order.discount) +
      "</span></div>";
    h +=
      '<div class="oc-sum-row"><span>Shipping</span><span>' +
      money(order.shipping) +
      "</span></div>";
    h +=
      '<div class="oc-sum-row"><span>Tax</span><span>' +
      money(order.tax) +
      "</span></div>";
    h +=
      '<div class="oc-sum-row total"><span>Total</span><span>' +
      money(order.total) +
      "</span></div>";
    h += "</div></div>";

    /* Actions */
    h += '<div class="oc-actions">';
    h +=
      '<a href="home.html" class="oc-btn oc-btn-primary"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>Continue Shopping</a>';
    h +=
      '<button type="button" class="oc-btn oc-btn-secondary" onclick="window.print()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>Print Receipt</button>';
    h += "</div>";

    document.getElementById("ocContainer").innerHTML = h;
  }

  render();
})();
