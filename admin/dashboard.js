// Admin dashboard — live data from the Flask API.
(() => {
  "use strict";

  const API_BASE = "http://127.0.0.1:5000";

  const sidebar = document.getElementById("adminSidebar");
  const overlay = document.getElementById("sidebarOverlay");
  const toggle = document.getElementById("menuToggle");

  function openSidebar() {
    sidebar?.classList.add("open");
    overlay?.classList.add("visible");
    document.body.style.overflow = "hidden";
  }

  function closeSidebar() {
    sidebar?.classList.remove("open");
    overlay?.classList.remove("visible");
    document.body.style.overflow = "";
  }

  toggle?.addEventListener("click", () => {
    sidebar?.classList.contains("open") ? closeSidebar() : openSidebar();
  });
  overlay?.addEventListener("click", closeSidebar);

  const money = value =>
    "$" + (Number(value) || 0).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

  const compactMoney = value => {
    const n = Number(value) || 0;
    if (n >= 1e9) return "$" + (n / 1e9).toFixed(1).replace(/\.0$/, "") + "B";
    if (n >= 1e6) return "$" + (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
    if (n >= 1e3) return "$" + (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
    return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const compactNumber = value => {
    const n = Number(value) || 0;
    if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, "") + "B";
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
    return n.toLocaleString("en-US");
  };

  const number = value =>
    (Number(value) || 0).toLocaleString("en-US");

  const escapeHtml = value => {
    const div = document.createElement("div");
    div.textContent = value ?? "";
    return div.innerHTML;
  };

  function getCategoryColor(percent) {
    if (percent >= 70) return "#16a34a";
    if (percent >= 50) return "#2563eb";
    if (percent >= 30) return "#7c3aed";
    if (percent >= 15) return "#d97706";
    return "#ec4899";
  }

  function showError(message) {
    const el = document.getElementById("dashboardError");
    if (!el) return;
    el.textContent = message;
    el.style.display = "block";
  }

  function renderCategories(categories) {
    const container = document.getElementById("categorySales");
    if (!container) return;

    if (!categories.length) {
      container.innerHTML = '<div style="color:#94a3b8">No sales yet.</div>';
      return;
    }

    container.innerHTML = categories.map((item, index) => {
      const width = Math.max(2, Math.min(100, Number(item.percent) || 0));
      const color = getCategoryColor(width);
      return `
        <div class="traffic-row">
          <div class="traffic-label">
            <span class="traffic-dot" style="background: ${color}"></span>
            <strong>${escapeHtml(item.name)}</strong>
          </div>
          <div class="traffic-bar-bg">
            <div class="traffic-bar-fill" style="--w:${width}%; background: ${color}"></div>
          </div>
          <span class="traffic-pct">${width}%</span>
        </div>
      `;
    }).join("");
  }

  function renderBestSellers(products) {
    const container = document.getElementById("bestSellers");
    if (!container) return;

    if (!products.length) {
      container.innerHTML = '<div style="color:#94a3b8">No products have been sold yet.</div>';
      return;
    }

    container.innerHTML = products.map((item, index) => `
      <div class="top-page-row">
        <span class="top-page-rank">${index + 1}</span>
        <div class="top-page-info">
          <strong>${escapeHtml(item.name)}</strong>
          <span>${escapeHtml(item.category || "Other")}</span>
        </div>
        <span class="top-page-views">${compactNumber(item.units)} units</span>
      </div>
    `).join("");
  }

  function renderMonthly(months) {
    const container = document.getElementById("monthlySales");
    if (!container) return;

    if (!months.length) {
      container.innerHTML = '<div style="color:#94a3b8">No sales data yet.</div>';
      return;
    }

    const max = Math.max(...months.map(m => Number(m.revenue) || 0), 1);

    container.innerHTML = months.map((month, index) => {
      const revenue = Number(month.revenue) || 0;
      const height = revenue ? Math.max(4, (revenue / max) * 100) : 2;
      return `
        <div class="chart-bar-group">
          <div
            class="chart-bar ${index === months.length - 1 ? "active" : ""}"
            style="--h:${height}%"
            data-value="${compactMoney(revenue)}"
            title="${escapeHtml(month.label)}: ${compactMoney(revenue)}"
          ></div>
          <span>${escapeHtml(month.label)}</span>
        </div>
      `;
    }).join("");

    container.querySelectorAll(".chart-bar").forEach((bar, i) => {
      bar.style.animationDelay = `${0.2 + i * 0.08}s`;
    });
  }

  async function loadDashboard() {
    const token = sessionStorage.getItem("token");

    if (!token) {
      showError("You are not logged in. Please log in as an administrator.");
      setTimeout(() => {
        window.location.href = "login.html";
      }, 1200);
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/admin/dashboard`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await response.json().catch(() => ({}));

      if (response.status === 401 || response.status === 403) {
        sessionStorage.removeItem("token");
        sessionStorage.removeItem("user");
        showError(data.message || "Admin access is required.");
        setTimeout(() => {
          window.location.href = "login.html";
        }, 1200);
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Could not load dashboard data.");
      }

      document.getElementById("statRevenue").textContent = compactMoney(data.stats.revenue);
      document.getElementById("statOrders").textContent = compactNumber(data.stats.orders);
      document.getElementById("statAverage").textContent = compactMoney(data.stats.average_order);
      document.getElementById("statCustomers").textContent = compactNumber(data.stats.customers);

      const badge = document.getElementById("orderBadge");
      if (badge) badge.textContent = `${number(data.stats.low_stock)} low stock`;

      renderCategories(data.categories || []);
      renderBestSellers(data.best_sellers || []);
      renderMonthly(data.monthly_sales || []);
    } catch (error) {
      console.error("Dashboard load failed:", error);
      showError(error.message || "Unable to load dashboard data. Is the backend running?");
    }
  }

  document.getElementById("adminLogout")?.addEventListener("click", () => {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
  });

  loadDashboard();
})();