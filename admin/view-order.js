(function () {
  "use strict";

  var orderData = {
    id: "ORD-2025-0042",
    status: "processing",
    items: [
      { name: "Premium Running Shoes", variant: "Size: M / Color: Black", qty: 1, price: 129.99, image: "https://picsum.photos/seed/ordshoe1/200/200.jpg" },
      { name: "Athletic Performance Socks", variant: "Size: L / Color: White", qty: 3, price: 14.99, image: "https://picsum.photos/seed/ordsock/200/200.jpg" },
      { name: "Sport Water Bottle 750ml", variant: "Color: Navy Blue", qty: 1, price: 24.99, image: "https://picsum.photos/seed/ordbottle/200/200.jpg" }
    ],
    subtotal: 199.96,
    shipping: 12.99,
    tax: 16.96,
    discount: -15.0,
    total: 214.91,
    timeline: [
      { step: "placed", label: "Order Placed", date: "Jan 18, 2025 — 3:42 PM", completed: true },
      { step: "confirmed", label: "Order Confirmed", date: "Jan 18, 2025 — 3:45 PM", completed: true },
      { step: "processing", label: "Processing", date: "Jan 19, 2025 — 9:00 AM", completed: false, active: true },
      { step: "shipped", label: "Shipped", date: null, completed: false },
      { step: "delivered", label: "Delivered", date: null, completed: false }
    ]
  };

  var statusFlow = ["processing", "shipped", "delivered"];

  var statusConfig = {
    processing: { label: "Processing", iconClass: "processing-icon", desc: "Order is being prepared for shipment" },
    shipped: { label: "Shipped", iconClass: "shipped-icon", desc: "Order has been dispatched to the carrier" },
    delivered: { label: "Delivered", iconClass: "delivered-icon", desc: "Order has been delivered to the customer" }
  };

  var statusIcons = {
    processing: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    shipped: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>',
    delivered: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
  };

  var sidebar = document.getElementById("adminSidebar");
  var menuToggle = document.getElementById("menuToggle");
  var statusBadge = document.getElementById("currentStatusBadge");
  var orderTimeline = document.getElementById("orderTimeline");
  var orderItemsEl = document.getElementById("orderItems");
  var orderSummaryEl = document.getElementById("orderSummary");
  var statusControl = document.getElementById("statusControl");
  var lockedNotice = document.getElementById("lockedNotice");
  var toast = document.getElementById("voToast");
  var toastMsg = document.getElementById("voToastMsg");
  var statusModal = document.getElementById("statusModal");
  var statusModalTitle = document.getElementById("statusModalTitle");
  var statusModalDesc = document.getElementById("statusModalDesc");
  var statusModalWarning = document.getElementById("statusModalWarning");
  var statusModalCancel = document.getElementById("statusModalCancel");
  var statusModalConfirm = document.getElementById("statusModalConfirm");
  var refundModal = document.getElementById("refundModal");
  var refundModalCancel = document.getElementById("refundModalCancel");
  var refundModalConfirm = document.getElementById("refundModalConfirm");
  var refundBtn = document.getElementById("refundBtn");
  var printBtn = document.getElementById("printBtn");

  var pendingStatus = null;

  menuToggle.addEventListener("click", function () {
    sidebar.classList.toggle("open");
  });

  document.addEventListener("click", function (e) {
    if (window.innerWidth <= 768 && sidebar.classList.contains("open") && !sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
      sidebar.classList.remove("open");
    }
  });

  function renderItems() {
    orderItemsEl.innerHTML = "";
    orderData.items.forEach(function (item) {
      var div = document.createElement("div");
      div.className = "vo-item";
      div.innerHTML = '<div class="vo-item-img"><img src="' + item.image + '" alt="' + escapeHtml(item.name) + '" /></div><div class="vo-item-info"><h4>' + escapeHtml(item.name) + '</h4><p class="vo-item-variant">' + escapeHtml(item.variant) + '</p><p class="vo-item-qty">Qty: ' + item.qty + '</p></div><div class="vo-item-price">$' + (item.price * item.qty).toFixed(2) + "</div>";
      orderItemsEl.appendChild(div);
    });
  }

  function renderSummary() {
    orderSummaryEl.innerHTML = '<div class="vo-summary-row"><span>Subtotal</span><span>$' + orderData.subtotal.toFixed(2) + '</span></div><div class="vo-summary-row"><span>Shipping</span><span>$' + orderData.shipping.toFixed(2) + '</span></div><div class="vo-summary-row"><span>Tax</span><span>$' + orderData.tax.toFixed(2) + '</span></div>' + (orderData.discount < 0 ? '<div class="vo-summary-row discount"><span>Discount</span><span>-$' + Math.abs(orderData.discount).toFixed(2) + '</span></div>' : "") + '<div class="vo-summary-row total"><span>Total</span><span>$' + orderData.total.toFixed(2) + "</span></div>";
  }

  function renderStatusBadge() {
    var cfg = statusConfig[orderData.status];
    statusBadge.className = "vo-status-badge " + orderData.status;
    statusBadge.innerHTML = '<span class="vo-status-dot"></span><span class="vo-status-text">' + cfg.label + "</span>";
  }

  function renderTimeline() {
    var steps = orderTimeline.querySelectorAll(".vo-tl-step");
    var lines = orderTimeline.querySelectorAll(".vo-tl-line");

    orderData.timeline.forEach(function (tl, i) {
      var step = steps[i];
      if (!step) return;
      var line = lines[i];

      step.className = "vo-tl-step";
      if (tl.completed) step.classList.add("completed");
      else if (tl.active) step.classList.add("active");

      var dot = step.querySelector(".vo-tl-dot");
      if (tl.completed) {
        dot.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg>';
      } else if (tl.active) {
        dot.innerHTML = '<span class="vo-tl-pulse"></span>';
      } else {
        dot.innerHTML = "";
      }

      var info = step.querySelector(".vo-tl-info");
      var dateSpan = info.querySelector("span");
      if (tl.date) {
        dateSpan.className = "";
        dateSpan.textContent = tl.date;
      } else {
        dateSpan.className = "vo-tl-pending";
        dateSpan.textContent = "Pending";
      }

      if (line) {
        line.className = "vo-tl-line";
        if (tl.completed) line.classList.add("completed");
        else if (tl.active) line.classList.add("active");
      }
    });
  }

  function renderStatusControl() {
    statusControl.innerHTML = "";
    var currentIdx = statusFlow.indexOf(orderData.status);
    var isFinal = orderData.status === "delivered";

    statusFlow.forEach(function (status, idx) {
      var cfg = statusConfig[status];
      var isCurrent = idx === currentIdx;
      var isPast = idx < currentIdx;
      var isNext = idx === currentIdx + 1;
      var isLocked = idx > currentIdx + 1;

      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "vo-status-btn";

      if (isPast) btn.classList.add("past");
      else if (isCurrent) btn.classList.add("current");
      else if (isNext && !isFinal) btn.classList.add("available");
      else btn.classList.add("locked");

      var tagHtml = "";
      if (isPast) {
        tagHtml = '<span class="vo-status-btn-tag tag-done"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:middle;margin-right:3px"><polyline points="20 6 9 17 4 12" /></svg>Done</span>';
      } else if (isCurrent) {
        tagHtml = '<span class="vo-status-btn-tag tag-current">Current</span>';
      } else if (isNext && !isFinal) {
        tagHtml = '<span class="vo-status-btn-tag tag-click">Click to Update</span>';
      } else {
        tagHtml = '<span class="vo-status-btn-tag tag-locked"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:middle;margin-right:3px"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>Locked</span>';
      }

      var arrowHtml = "";
      if (isNext && !isFinal) {
        arrowHtml = '<svg class="vo-status-btn-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6" /></svg>';
      }

      btn.innerHTML = '<div class="vo-status-btn-icon ' + cfg.iconClass + '">' + statusIcons[status] + "</div>" + '<div class="vo-status-btn-text"><strong>' + cfg.label + "</strong><span>" + cfg.desc + "</span></div>" + tagHtml + arrowHtml;

      if (isNext && !isFinal) {
        btn.addEventListener("click", function () {
          openStatusModal(status);
        });
      }

      statusControl.appendChild(btn);
    });

    if (isFinal) {
      lockedNotice.style.display = "flex";
    } else {
      lockedNotice.style.display = "none";
    }
  }

  function openStatusModal(newStatus) {
    pendingStatus = newStatus;
    var cfg = statusConfig[newStatus];
    statusModalTitle.textContent = "Mark as " + cfg.label + "?";
    statusModalDesc.innerHTML = "Change order <strong>#" + orderData.id + "</strong> to <strong>" + cfg.label + "</strong>?";
    statusModalWarning.style.display = "block";
    statusModal.classList.add("show");
  }

  statusModalCancel.addEventListener("click", function () {
    statusModal.classList.remove("show");
    pendingStatus = null;
  });

  statusModalConfirm.addEventListener("click", function () {
    if (!pendingStatus) return;
    var newStatus = pendingStatus;

    for (var i = 0; i < orderData.timeline.length; i++) {
      var tl = orderData.timeline[i];
      if (tl.step === orderData.status) {
        tl.completed = true;
        tl.active = false;
      }
      if (tl.step === newStatus) {
        tl.active = true;
        var now = new Date();
        tl.date = now.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
      }
    }

    orderData.status = newStatus;
    statusModal.classList.remove("show");
    renderStatusBadge();
    renderTimeline();
    renderStatusControl();
    showToast("Order marked as " + statusConfig[newStatus].label, "success");
    pendingStatus = null;
  });

  refundBtn.addEventListener("click", function () { refundModal.classList.add("show"); });
  refundModalCancel.addEventListener("click", function () { refundModal.classList.remove("show"); });
  refundModalConfirm.addEventListener("click", function () {
    refundModal.classList.remove("show");
    showToast("Refund of $" + orderData.total.toFixed(2) + " processed", "success");
  });

  printBtn.addEventListener("click", function () { window.print(); });

  [statusModal, refundModal].forEach(function (modal) {
    modal.addEventListener("click", function (e) {
      if (e.target === modal) {
        modal.classList.remove("show");
        pendingStatus = null;
      }
    });
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      statusModal.classList.remove("show");
      refundModal.classList.remove("show");
      pendingStatus = null;
    }
  });

  var toastTimer = null;
  function showToast(message, type) {
    clearTimeout(toastTimer);
    toastMsg.textContent = message;
    var icon = toast.querySelector("svg");
    if (type === "warn") {
      icon.style.color = "#f59e0b";
      icon.innerHTML = '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>';
    } else {
      icon.style.color = "#22c55e";
      icon.innerHTML = '<path d="M20 6L9 17l-5-5"/>';
    }
    toast.classList.add("show");
    toastTimer = setTimeout(function () { toast.classList.remove("show"); }, 3000);
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  renderItems();
  renderSummary();
  renderStatusBadge();
  renderTimeline();
  renderStatusControl();
})();