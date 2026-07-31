(function () {
  "use strict";

  /* ============================
     Data Sets by Period
     ============================ */
  var analyticsData = {
    "7d": {
      kpi: {
        revenue: 12340,
        orders: 98,
        customers: 34,
        aov: 125.92,
        revenueChange: 8.3,
        ordersChange: 5.1,
        customersChange: -1.2,
        aovChange: 3.0,
      },
      revenue: [1680, 1920, 1450, 2100, 1780, 1540, 1870],
      orders: [12, 15, 11, 16, 14, 13, 17],
      status: { delivered: 62, shipped: 18, processing: 12, cancelled: 6 },
      traffic: { direct: 42, organic: 30, social: 16, referral: 10 },
      ordersTrend: [12, 15, 11, 16, 14, 13, 17],
      topProducts: [
        {
          name: "Premium Running Shoes",
          cat: "Footwear",
          sold: 24,
          revenue: 3119.76,
          views: 312,
          rate: 7.7,
        },
        {
          name: "Athletic Socks 3-Pack",
          cat: "Apparel",
          sold: 31,
          revenue: 464.69,
          views: 201,
          rate: 15.4,
        },
        {
          name: "Sport Water Bottle",
          cat: "Sports",
          sold: 18,
          revenue: 449.82,
          views: 156,
          rate: 11.5,
        },
        {
          name: "Yoga Mat Pro",
          cat: "Sports",
          sold: 12,
          revenue: 599.88,
          views: 189,
          rate: 6.3,
        },
        {
          name: "Training Gloves",
          cat: "Sports",
          sold: 13,
          revenue: 254.87,
          views: 98,
          rate: 13.3,
        },
      ],
      categories: {
        Footwear: 3119.76,
        Apparel: 464.69,
        Sports: 1049.7,
        Electronics: 580.24,
        Home: 2800,
        Accessories: 326.61,
      },
      weekly: [
        { day: "Mon", current: 1520, previous: 1380 },
        { day: "Tue", current: 1890, previous: 1620 },
        { day: "Wed", current: 1340, previous: 1790 },
        { day: "Thu", current: 2100, previous: 1560 },
        { day: "Fri", current: 1780, previous: 1920 },
        { day: "Sat", current: 2240, previous: 1850 },
        { day: "Sun", current: 1470, previous: 1100 },
      ],
      labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      revenueLabels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    },
    "30d": {
      kpi: {
        revenue: 48392,
        orders: 384,
        customers: 127,
        aov: 126.02,
        revenueChange: 12.5,
        ordersChange: 8.2,
        customersChange: -3.1,
        aovChange: 4.8,
      },
      revenue: [
        3200, 3800, 4100, 3600, 4500, 4200, 3800, 5100, 4800, 3900, 5200, 5300,
        4600, 4900, 5400, 5100, 5800, 6200, 5600, 4900, 5300, 5700, 6100, 5800,
        5200, 5500, 5900, 6400, 6100, 5700, 6200, 6500, 6300, 6800,
      ],
      orders: [
        26, 31, 33, 29, 36, 34, 31, 41, 39, 32, 43, 44, 38, 40, 44, 42, 47, 50,
        45, 39, 42, 46, 49, 51, 48, 44, 47, 50, 53, 51, 49, 52, 55, 54,
      ],
      status: { delivered: 245, shipped: 72, processing: 48, cancelled: 19 },
      traffic: { direct: 168, organic: 124, social: 67, referral: 42 },
      ordersTrend: [
        26, 31, 33, 29, 36, 34, 31, 41, 39, 32, 43, 44, 38, 40, 44, 42, 47, 50,
        45, 39, 42, 46, 49, 51, 48, 44, 47, 50, 53, 51, 49, 52, 55, 54,
      ],
      topProducts: [
        {
          name: "Premium Running Shoes",
          cat: "Footwear",
          sold: 92,
          revenue: 11959.08,
          views: 1240,
          rate: 7.4,
        },
        {
          name: "Athletic Socks 3-Pack",
          cat: "Apparel",
          sold: 118,
          revenue: 1768.82,
          views: 823,
          rate: 14.3,
        },
        {
          name: "Sport Water Bottle",
          cat: "Sports",
          sold: 67,
          revenue: 1674.33,
          views: 612,
          rate: 10.9,
        },
        {
          name: "Yoga Mat Pro",
          cat: "Sports",
          sold: 45,
          revenue: 2249.55,
          views: 780,
          rate: 5.8,
        },
        {
          name: "Training Gloves",
          cat: "Sports",
          sold: 38,
          revenue: 744.62,
          views: 423,
          rate: 9.0,
        },
        {
          name: "Casual Sneakers",
          cat: "Footwear",
          sold: 34,
          revenue: 3391.66,
          views: 945,
          rate: 3.6,
        },
        {
          name: "Linen Shirt",
          cat: "Apparel",
          sold: 28,
          revenue: 699.72,
          views: 534,
          rate: 5.2,
        },
        {
          name: "Gym Duffle Bag",
          cat: "Sports",
          sold: 22,
          revenue: 767.78,
          views: 312,
          rate: 7.1,
        },
      ],
      categories: {
        Footwear: 15350.74,
        Apparel: 2468.54,
        Sports: 4691.66,
        Electronics: 4230.24,
        Home: 12600,
        Accessories: 767.78,
      },
      weekly: [
        { day: "Mon", current: 1520, previous: 1380 },
        { day: "Tue", current: 1890, previous: 1620 },
        { day: "Wed", current: 1340, previous: 1790 },
        { day: "Thu", current: 2100, previous: 1560 },
        { day: "Fri", current: 1780, previous: 1920 },
        { day: "Sat", current: 2240, previous: 1850 },
        { day: "Sun", current: 1470, previous: 1100 },
      ],
      labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      revenueLabels: ["Week 1", "", "", "", "", "Week 2", "", ""],
    },
    "90d": {
      kpi: {
        revenue: 142850,
        orders: 1132,
        customers: 389,
        aov: 126.2,
        revenueChange: 18.7,
        ordersChange: 14.1,
        customersChange: 11.6,
        aov: -3.5,
      },
      revenue: [
        3800, 4200, 4600, 5100, 5500, 5200, 5800, 6200, 5600, 6400, 6800, 7200,
        6900, 6500, 7100, 7500, 7800, 7200, 6800, 7400, 7800, 8200, 8500, 7900,
        7400, 8000, 8400, 8800, 9100, 8600, 8200, 8600, 9000, 9400, 9200, 8800,
      ],
      orders: [
        29, 32, 35, 39, 42, 40, 44, 47, 43, 49, 52, 55, 52, 49, 53, 57, 60, 55,
        51, 54, 58, 61, 64, 60, 56, 59, 63, 66, 68, 65, 61, 64, 68, 71, 73, 70,
        66, 69, 73, 76,
      ],
      status: { delivered: 712, shipping: 215, processing: 142, cancelled: 63 },
      traffic: { direct: 498, organic: 372, social: 198, referral: 124 },
      ordersTrend: [
        29, 32, 35, 39, 42, 40, 44, 47, 43, 49, 52, 55, 52, 49, 53, 57, 60, 55,
        51, 54, 58, 61, 64, 60, 56, 59, 63, 66, 68, 65, 61, 64, 68, 71, 73, 70,
        66, 69, 73, 76,
      ],
      topProducts: [
        {
          name: "Premium Running Shoes",
          cat: "Footwear",
          sold: 278,
          revenue: 36122.22,
          views: 3640,
          rate: 7.6,
        },
        {
          name: "Athletic Socks 3-Pack",
          cat: "Apparel",
          sold: 354,
          revenue: 5303.46,
          views: 2410,
          rate: 14.7,
        },
        {
          name: "Sport Water Bottle",
          cat: "Sports",
          sold: 201,
          revenue: 5020.99,
          views: 1820,
          rate: 11.0,
        },
        {
          name: "Yoga Mat Pro",
          cat: "Sports",
          sold: 134,
          revenue: 6699.66,
          views: 2340,
          rate: 5.7,
        },
        {
          name: "Training Gloves",
          cat: "Sports",
          sold: 112,
          revenue: 2195.84,
          views: 1256,
          rate: 8.9,
        },
        {
          name: "Casual Sneakers",
          cat: "Footwear",
          sold: 98,
          revenue: 9779.02,
          views: 2780,
          rate: 3.5,
        },
        {
          name: "Linen Shirt",
          cat: "Apparel",
          sold: 87,
          revenue: 2176.13,
          views: 1580,
          rate: 5.5,
        },
        {
          name: "Gym Duffle Bag",
          cat: "Sports",
          sold: 65,
          revenue: 2270.35,
          views: 945,
          rate: 6.9,
        },
      ],
      categories: {
        Footwear: 45901.24,
        Apparel: 7479.59,
        Sports: 14095.0,
        Electronics: 12680.24,
        Home: 37200,
        Accessories: 2270.35,
      },
      weekly: [
        { day: "Mon", current: 3800, previous: 3200 },
        { day: "Tue", current: 4200, previous: 3800 },
        { day: "Wed", current: 3900, previous: 4100 },
        { day: "Thu", current: 5100, previous: 4600 },
        { day: "Fri", current: 4800, previous: 5200 },
        { day: "Sat", current: 5900, previous: 5400 },
        { day: "Sun", current: 4800, previous: 4700 },
      ],
      labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      revenueLabels: ["Jan", "", "", "Feb", "", "Mar", "", ""],
    },
    "1y": {
      kpi: {
        revenue: 582400,
        orders: 4628,
        customers: 1843,
        aov: 125.85,
        revenueChange: 24.3,
        ordersChange: 19.6,
        customersChange: 22.8,
        aov: 5.2,
      },
      revenue: [
        32000, 35000, 38000, 41000, 44000, 42000, 45000, 48000, 52000, 50000,
        46000, 48000, 52000, 55000, 53000, 58000, 60000, 57000, 54000, 58000,
        62000, 65000, 63000, 60000, 58000, 62000, 66000, 68000, 70000, 72000,
        74000, 71000, 68000, 72000, 75000, 78000, 80000, 82000, 85000, 88000,
        90000,
      ],
      orders: [
        245, 268, 291, 314, 336, 321, 343, 366, 389, 374, 396, 419, 441, 424,
        446, 469, 490, 475, 497, 520, 543, 528, 550, 572, 595, 617, 602, 624,
        646, 671, 693, 689, 711, 734, 757,
      ],
      status: {
        delivered: 2890,
        shipping: 698,
        processing: 486,
        cancelled: 554,
      },
      traffic: { direct: 1820, organic: 1340, social: 712, referral: 445 },
      ordersTrend: [
        245, 268, 291, 314, 336, 321, 343, 366, 389, 374, 396, 419, 441, 424,
        446, 469, 490, 475, 497, 520, 543, 528, 550, 572, 595, 617, 602, 624,
        646, 671, 693, 689, 711, 734, 757,
      ],
      topProducts: [
        {
          name: "Premium Running Shoes",
          cat: "Footwear",
          sold: 1142,
          revenue: 148448.58,
          views: 14520,
          rate: 7.9,
        },
        {
          name: "Athletic Socks 3-Pack",
          cat: "Apparel",
          sold: 1432,
          revenue: 21456.68,
          views: 9680,
          rate: 14.8,
        },
        {
          name: "Sport Water Bottle",
          cat: "Sports",
          sold: 812,
          revenue: 20319.88,
          views: 7240,
          rate: 11.2,
        },
        {
          name: "Yoga Mat Pro",
          cat: "Sports",
          sold: 534,
          revenue: 26722.66,
          views: 9240,
          rate: 5.8,
        },
        {
          name: "Training Gloves",
          cat: "Sports",
          sold: 445,
          revenue: 8720.55,
          views: 4980,
          rate: 8.9,
        },
        {
          name: "Casual Sneakers",
          cat: "Footwear",
          sold: 398,
          revenue: 39680.02,
          views: 11120,
          rate: 3.6,
        },
        {
          name: "Linen Shirt",
          cat: "Apparel",
          sold: 356,
          revenue: 8893.44,
          views: 6320,
          rate: 5.6,
        },
        {
          name: "Gym Duffle Bag",
          cat: "Sports",
          sold: 267,
          revenue: 9322.23,
          views: 3780,
          rate: 7.1,
        },
      ],
      categories: {
        Footwear: 188128.6,
        Apparel: 30350.12,
        Sports: 54755.09,
        Electronics: 48120.24,
        Home: 142800,
        Accessories: 9322.23,
      },
      weekly: [
        { day: "Mon", current: 3800, previous: 3200 },
        { day: "Tue", current: 4200, previous: 3800 },
        { day: "Wed", current: 3900, previous: 4100 },
        { day: "Thu", current: 5100, previous: 4600 },
        { day: "Fri", current: 4800, previous: 5200 },
        { day: "Sat", current: 5900, previous: 5400 },
        { day: "Sun", current: 4800, previous: 4700 },
      ],
      labels: [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ],
      revenueLabels: ["Jan", "", "", "Apr", "", "Jul", "", ""],
    },
  };

  var currentPeriod = "30d";
  var d = analyticsData[currentPeriod];

  /* ============================
     Sidebar Toggle
     ============================ */
  var sidebar = document.getElementById("adminSidebar");
  var menuToggle = document.getElementById("menuToggle");

  menuToggle.addEventListener("click", function () {
    sidebar.classList.toggle("open");
  });

  document.addEventListener("click", function (e) {
    if (
      window.innerWidth <= 768 &&
      sidebar.classList.contains("open") &&
      !sidebar.contains(e.target) &&
      !menuToggle.contains(e.target)
    ) {
      sidebar.classList.remove("open");
    }
  });

  /* ============================
     Period Toggle
     ============================ */
  document.querySelectorAll(".aa-period-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll(".aa-period-btn").forEach(function (b) {
        b.classList.remove("active");
      });
      this.classList.add("active");
      currentPeriod = this.getAttribute("data-period");
      d = analyticsData[currentPeriod];
      renderAll();
    });
  });

  /* ============================
     KPI Cards
     ============================ */
  function renderKPI() {
    document.getElementById("kpiRevenue").textContent =
      "$" + d.kpi.revenue.toLocaleString();
    document.getElementById("kpiOrders").textContent =
      d.kpi.orders.toLocaleString();
    document.getElementById("kpiCustomers").textContent =
      d.kpi.customers.toLocaleString();
    document.getElementById("kpiAov").textContent = "$" + d.kpi.aov.toFixed(2);

    setChange("kpiRevenueChange", d.kpi.revenueChange);
    setChange("kpiOrdersChange", d.kpi.ordersChange);
    setChange("kpiCustomersChange", d.kpi.customersChange);
    setChange("kpiAovChange", d.kpi.aovChange);
  }

  function setChange(id, val) {
    var el = document.getElementById(id);
    if (!el) return;
    var isUp = val >= 0;
    el.textContent = (isUp ? "+" : "") + val.toFixed(1) + "%";
    el.className = "aa-kpi-change " + (isUp ? "up" : "down");
  }

  /* ============================
     Revenue Chart (Canvas)
     ============================ */
  function drawRevenueChart() {
    var canvas = document.getElementById("revenueChart");
    var ctx = canvas.getContext("2d");
    var dpr = window.devicePixelRatio || 1;
    var rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = 280 * dpr;
    canvas.style.height = "280px";
    ctx.scale(dpr, dpr);

    var w = rect.width;
    var h = 280;
    var padL = 56;
    var padR = 16;
    var padT = 16;
    var padB = 40;
    var chartW = w - padL - padR;
    var chartH = h - padT - padB;

    var data = d.revenue;
    var maxVal = Math.max.apply(null, data) * 1.1;
    if (maxVal === 0) maxVal = 1;

    var stepX = chartW / (data.length - 1);

    ctx.clearRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = "#f1f5f9";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    var gridCount = 5;
    for (var g = 0; g <= gridCount; g++) {
      var gy = padT + (chartH / gridCount) * g;
      ctx.beginPath();
      ctx.moveTo(padL, gy);
      ctx.lineTo(w - padR, gy);
      ctx.stroke();

      var label =
        "$" + Math.round(maxVal - (maxVal / gridCount) * g).toLocaleString();
      ctx.fillStyle = "#94a3b8";
      ctx.font = "11px -apple-system, sans-serif";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(label, padL - 10, gy);
    }

    ctx.setLineDash([]);

    // Area fill
    ctx.beginPath();
    ctx.moveTo(padL, padT + chartH);
    for (var i = 0; i < data.length; i++) {
      var x = padL + i * stepX;
      var y = padT + chartH - (data[i] / maxVal) * chartH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.lineTo(padL + (data.length - 1) * stepX, padT + chartH);
    ctx.closePath();
    var grad = ctx.createLinearGradient(0, padT, 0, padT + chartH);
    grad.addColorStop(0, "rgba(37, 99, 235, 0.18)");
    grad.addColorStop(1, "rgba(37, 99, 235, 0)");
    ctx.fillStyle = grad;
    ctx.fill();

    // Line
    ctx.beginPath();
    for (var j = 0; j < data.length; j++) {
      var lx = padL + j * stepX;
      var ly = padT + chartH - (data[j] / maxVal) * chartH;
      if (j === 0) ctx.moveTo(lx, ly);
      else ctx.lineTo(lx, ly);
    }
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 2.5;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();

    // Dots
    for (var k = 0; k < data.length; k++) {
      var dx = padL + k * stepX;
      var dy = padT + chartH - (data[k] / maxVal) * chartH;
      ctx.beginPath();
      ctx.arc(dx, dy, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = "#2563eb";
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // X labels
    var labelInterval = Math.ceil(data.length / 7);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (var l = 0; l < data.length; l += labelInterval) {
      var lx2 = padL + l * stepX;
      ctx.fillText(d.revenueLabels[l] || "", lx2, h - padB + 16);
    }
  }

  /* ============================
     Orders Chart (Canvas)
     ============================ */
  function drawOrdersChart() {
    var canvas = document.getElementById("ordersChart");
    var ctx = canvas.getContext("2d");
    var dpr = window.devicePixelRatio || 1;
    var rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = 280 * dpr;
    canvas.style.height = "280px";
    ctx.scale(dpr, dpr);

    var w = rect.width;
    var h = 280;
    var padL = 56;
    var padR = 16;
    var padT = 16;
    var padB = 40;
    var chartW = w - padL - padR;
    var chartH = h - padT - padB;

    var data = d.ordersTrend;
    var maxVal = Math.max.apply(null, data) * 1.15;
    if (maxVal === 0) maxVal = 1;
    var stepX = chartW / (data.length - 1);

    ctx.clearRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = "#f1f5f9";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    var gridCount = 5;
    for (var g = 0; g <= gridCount; g++) {
      var gy = padT + (chartH / gridCount) * g;
      ctx.beginPath();
      ctx.moveTo(padL, gy);
      ctx.lineTo(w - padR, gy);
      ctx.stroke();
      ctx.fillStyle = "#94a3b8";
      ctx.font = "11px -apple-system, sans-serif";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(
        Math.round(maxVal - (maxVal / gridCount) * g),
        padL - 10,
        gy,
      );
    }

    ctx.setLineDash([]);

    // Bars
    var barW = Math.max(1, stepX * 0.6);
    for (var i = 0; i < data.length; i++) {
      var x = padL + i * stepX;
      var barH = Math.max(1, (data[i] / maxVal) * chartH);
      var y = padT + chartH - barH;

      ctx.beginPath();
      ctx.roundRect(x - barW / 2, y, barW, barH, [4, 4, 0, 0]);
      var grad = ctx.createLinearGradient(0, y, 0, padT + chartH);
      grad.addColorStop(0, "#3b82f6");
      grad.addColorStop(1, "#60a5fa");
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // X labels
    var labelInterval = Math.ceil(data.length / 7);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (var l = 0; l < data.length; l += labelInterval) {
      var lx2 = padL + l * stepX;
      ctx.fillText(d.labels[l] || "", lx2, h - padB + 16);
    }
  }

  /* ============================
     Category Chart (Horizontal Bars)
     ============================ */
  function drawCategoryChart() {
    var canvas = document.getElementById("categoryChart");
    var ctx = canvas.getContext("2d");
    var dpr = window.devicePixelRatio || 1;
    var rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = 260 * dpr;
    canvas.style.height = "260px";
    ctx.scale(dpr, dpr);

    var w = rect.width;
    var h = 260;
    var padL = 120;
    var padR = 40;
    var chartW = w - padL - padR;

    var cats = Object.entries(d.categories).sort(function (a, b) {
      return b[1] - a[1];
    });
    var maxVal = cats[0][1] * 1.1;
    if (maxVal === 0) maxVal = 1;

    ctx.clearRect(0, 0, w, h);

    var barH = 28;
    var gap = (h - cats.length * barH) / (cats.length + 1);

    cats.forEach(function (cat, i) {
      var y = gap + i * (barH + gap);
      var barW = Math.max(1, (cat[1] / maxVal) * chartW);

      ctx.beginPath();
      ctx.roundRect(padL, y, barW, barH, [6, 6, 0, 0]);
      ctx.fillStyle = "#2563eb";
      ctx.fill();

      ctx.fillStyle = "#475569";
      ctx.font = "12px -apple-system, sans-serif";
      ctx.textBaseline = "middle";
      ctx.textAlign = "right";
      ctx.fillText(cat[0], padL - 10, y + barH / 2);

      ctx.fillStyle = "#0f1724";
      ctx.font = "600 11px -apple-system, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(
        "$" + cat[1].toLocaleString(),
        padL + barW + 10,
        y + barH / 2,
      );
    });
  }

  /* ============================
     Donut Chart (Canvas)
     ============================ */
  function drawDonut() {
    var canvas = document.getElementById("trafficChart");
    var ctx = canvas.getContext("2d");
    var dpr = window.devicePixelRatio || 1;
    canvas.width = 200 * dpr;
    canvas.height = 200 * dpr;
    canvas.style.width = "200px";
    canvas.style.height = "200px";
    ctx.scale(dpr, dpr);

    var cx = 100;
    var cy = 100;
    var outerR = 80;
    var innerR = 50;
    var total = 0;
    var colors = ["#2563eb", "#7c3aed", "#ec4899", "#f59e0b"];
    var entries = Object.entries(d.traffic);
    entries.forEach(function (e) {
      total += e[1];
    });

    var startAngle = -Math.PI / 2;
    entries.forEach(function (entry, i) {
      var sliceAngle = (entry[1] / total) * Math.PI * 2;
      var endAngle = startAngle + sliceAngle;

      ctx.beginPath();
      ctx.arc(cx, cy, outerR, outerR, startAngle, endAngle);
      ctx.arc(cx, cy, innerR, innerR, endAngle, startAngle, true);
      ctx.closePath();
      ctx.fillStyle = colors[i % colors.length];
      ctx.fill();

      startAngle = endAngle;
    });

    // Inner circle for donut hole
    ctx.beginPath();
    ctx.arc(cx, cy, innerR - 1, innerR - 1, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();

    // Legend
    var legend = document.getElementById("trafficLegend");
    legend.innerHTML = "";
    entries.forEach(function (entry, i) {
      var pct = Math.round((entry[1] / total) * 100);
      legend.innerHTML +=
        '<div class="aa-legend-item">' +
        '<span class="aa-legend-dot" style="background:' +
        colors[i % colors.length] +
        '"></span>' +
        "<span>" +
        entry[0] +
        "</span>" +
        '<span class="aa-legend-pct">' +
        pct +
        "%</span>" +
        "</div>";
    });
  }

  /* ============================
     Status Bars (CSS)
     ============================ */
  function renderStatusBars() {
    var container = document.getElementById("statusBars");
    container.innerHTML = "";
    var total = 0;
    var statusOrder = [
      "delivered",
      "shipped",
      "processing",
      "cancelled",
      "refunded",
    ];
    statusOrder.forEach(function (key) {
      total += d.status[key] || 0;
    });
    if (total === 0) total = 1;

    statusOrder.forEach(function (key) {
      var val = d.status[key] || 0;
      var pct = Math.round((val / total) * 100);
      var label = key.charAt(0).toUpperCase() + key.slice(1);

      container.innerHTML +=
        '<div class="aa-status-bar-item">' +
        '<div class="aa-status-bar-label"><span>' +
        label +
        '</span><span class="aa-status-bar-count">' +
        val +
        "</span></div>" +
        '<div class="aa-status-bar-track"><div class="aa-status-bar-fill ' +
        key +
        '" data-width="' +
        pct +
        '"></div></div>' +
        "</div>";
    });

    // Animate bars
    setTimeout(function () {
      document.querySelectorAll(".aa-status-bar-fill").forEach(function (bar) {
        bar.style.width = bar.getAttribute("data-width") + "%";
      });
    }, 50);
  }

  /* ============================
     Top Products Table
     ============================ */
  function renderTopProducts() {
    var tbody = document.getElementById("topProductsBody");
    tbody.innerHTML = "";

    d.topProducts.forEach(function (p) {
      var rate = p.rate;
      var rateClass = rate >= 8 ? "good" : "low";
      var rateWidth = Math.min(rate * 10, 100);

      tbody.innerHTML +=
        "<tr>" +
        "<td>" +
        '<div class="aa-product-cell">' +
        '<div class="aa-product-thumb"><img src="https://picsum.photos/seed/' +
        p.name.replace(/\s/g, "") +
        '/80/80.jpg" alt="" /></div>' +
        '<div><span class="aa-product-name">' +
        escapeHtml(p.name) +
        '</span><span class="aa-product-cat">' +
        escapeHtml(p.cat) +
        "</span></div>" +
        "</div>" +
        "</td>" +
        '<td class="num">' +
        p.sold +
        "</td>" +
        '<td class="num">$' +
        p.revenue.toFixed(2) +
        "</td>" +
        '<td class="num">' +
        p.views.toLocaleString() +
        "</td>" +
        "<td>" +
        '<div class="aa-conv-rate ' +
        rateClass +
        '">' +
        "<span>" +
        rate +
        "%</span>" +
        '<div class="conv-bar"><div class="conv-bar-fill" data-width="' +
        rateWidth +
        '"></div></div>' +
        "</div>" +
        "</td>" +
        "</tr>";
    });

    // Animate conv bars
    setTimeout(function () {
      document.querySelectorAll(".conv-bar-fill").forEach(function (bar) {
        bar.style.width = bar.getAttribute("data-width") + "%";
      });
    }, 50);
  }

  /* ============================
     Weekly Comparison Bars (CSS)
     ============================ */
  function renderWeeklyBars() {
    var container = document.getElementById("weeklyBars");
    container.innerHTML = "";
    var maxVal = 0;
    d.weekly.forEach(function (w) {
      maxVal = Math.max(maxVal, w.current, w.previous);
    });
    if (maxVal === 0) maxVal = 1;

    d.weekly.forEach(function (w) {
      var currentH = Math.max(2, (w.current / maxVal) * 160);
      var prevH = Math.max(2, (w.previous / maxVal) * 160);

      container.innerHTML +=
        '<div class="aa-weekly-col">' +
        '<div class="aa-weekly-bar-track">' +
        '<div class="aa-weekly-bar-pair">' +
        '<div class="aa-weekly-fill previous" data-height="' +
        prevH +
        '"></div>' +
        '<div class="aa-weekly-fill current" data-height="' +
        currentH +
        '"></div>' +
        "</div>" +
        "</div>" +
        '<span class="aa-weekly-amount">$' +
        w.current.toLocaleString() +
        "</span>" +
        '<span class="aa-weekly-label">' +
        w.day +
        "</span>" +
        "</div>";
    });

    // Animate
    setTimeout(function () {
      document.querySelectorAll(".aa-weekly-fill").forEach(function (bar) {
        bar.style.height = bar.getAttribute("data-height") + "px";
      });
    }, 50);
  }

  /* ============================
     Draw All Charts
     ============================ */
  function drawAll() {
    renderKPI();
    drawRevenueChart();
    drawOrdersChart();
    drawCategoryChart();
    drawDonut();
    renderStatusBars();
    renderTopProducts();
    renderWeeklyBars();
  }

  /* ============================
     Init
     ============================ */
  drawAll();

  // Redraw on resize
  var resizeTimer = null;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      drawRevenueChart();
      drawOrdersChart();
      drawCategoryChart();
    }, 200);
  });

  /* ============================
     Utility
     ============================ */
  function escapeHtml(str) {
    var div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }
})();
