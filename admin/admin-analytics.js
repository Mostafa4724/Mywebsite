// ============================================================
// ADMIN ANALYTICS - LIVE DATABASE VERSION
// ============================================================



// ============================================================
// State
// ============================================================

let currentPeriod = "30d";
let revenueChart = null;

let dashboardData = null;
let ordersData = [];


// ============================================================
// DOM HELPERS
// ============================================================

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);


// ============================================================
// TOAST
// ============================================================

function showToast(message, icon = "fa-circle-check") {
    const container = $("#toastContainer");

    if (!container) return;

    const toast = document.createElement("div");

    toast.className = "toast";

    toast.innerHTML = `
        <i class="fa-solid ${icon}"></i>
        <span>${escapeHtml(message)}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}


// ============================================================
// SECURITY / HTML ESCAPE
// ============================================================

function escapeHtml(value) {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// ============================================================
// NUMBER HELPERS
// ============================================================

function money(value) {
    const number = Number(value) || 0;

    return "$" + number.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}


function compactMoney(value) {
    const number = Number(value) || 0;

    if (number >= 1000000000) {
        return "$" + trimCompact(number / 1000000000) + "B";
    }
    if (number >= 1000000) {
        return "$" + trimCompact(number / 1000000) + "M";
    }
    if (number >= 1000) {
        return "$" + trimCompact(number / 1000) + "K";
    }
    return "$" + Math.round(number);

}

function trimCompact(value) {
    return Number(value.toFixed(1)).toString();
}


function number(value) {
    return (Number(value) || 0).toLocaleString();
}


// ============================================================
// AUTHENTICATION
// ============================================================

function getToken() {
    return sessionStorage.getItem("token");
}


// ============================================================
// FETCH HELPER
// ============================================================

async function apiFetch(url, options = {}) {

    const token = getToken();

    const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {}),
    };

    if (token) {
        headers["Authorization"] = "Bearer " + token;
    }

    const response = await fetch(url, {
        ...options,
        headers,
    });

    let data = null;

    try {
        data = await response.json();
    } catch (error) {
        data = null;
    }

    if (!response.ok) {

        const message =
            data?.message ||
            data?.error ||
            `Server error (${response.status})`;

        throw new Error(message);
    }

    return data;
}


// ============================================================
// SIDEBAR
// ============================================================

function initSidebar() {

    const menuToggle = $("#menuToggle");
    const sidebar = $("#adminSidebar");
    const overlay = $("#sidebarOverlay");

    if (menuToggle) {

        menuToggle.addEventListener("click", () => {

            sidebar?.classList.toggle("open");
            overlay?.classList.toggle("show");

        });

    }

    if (overlay) {

        overlay.addEventListener("click", () => {

            sidebar?.classList.remove("open");
            overlay?.classList.remove("show");

        });

    }
}


// ============================================================
// PERIOD TOGGLE
// ============================================================

function initPeriodToggle() {

    const periodToggle = $("#periodToggle");

    if (!periodToggle) return;

    periodToggle.addEventListener("click", async (event) => {

        const button = event.target.closest(".aa-period-btn");

        if (!button) return;

        currentPeriod = button.dataset.period;

        $$(".aa-period-btn").forEach((btn) => {
            btn.classList.remove("active");
        });

        button.classList.add("active");

        updateRevenueHint();

        renderKPIs();

        renderRevenueChart();

        renderStatusBars();

        renderDonutChart();

        renderWeeklyBars();

        renderProductTable();
    });
}


function updateRevenueHint() {

    const hint = $("#revenueHint");

    if (!hint) return;

    const map = {
        "7d": "Last 7 days",
        "30d": "Last 30 days",
        "90d": "Last 90 days",
        "12m": "Last 12 months",
    };

    hint.textContent = map[currentPeriod] || "This period";
}


// ============================================================
// DATE HELPERS
// ============================================================

function getOrderDate(order) {

    const value =
        order?.created_at ||
        order?.createdAt ||
        order?.date ||
        order?.order_date;

    if (!value) return null;

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return date;
}


function startOfDay(date) {

    const d = new Date(date);

    d.setHours(0, 0, 0, 0);

    return d;
}


function addDays(date, amount) {

    const d = new Date(date);

    d.setDate(d.getDate() + amount);

    return d;
}


function startOfMonth(date) {

    return new Date(
        date.getFullYear(),
        date.getMonth(),
        1
    );
}


function addMonths(date, amount) {

    return new Date(
        date.getFullYear(),
        date.getMonth() + amount,
        1
    );
}


// ============================================================
// PERIOD RANGE
// ============================================================

function getPeriodRange(period = currentPeriod) {

    const now = new Date();

    let start;

    if (period === "7d") {

        start = addDays(startOfDay(now), -6);

    } else if (period === "30d") {

        start = addDays(startOfDay(now), -29);

    } else if (period === "90d") {

        start = addDays(startOfDay(now), -89);

    } else {

        start = startOfMonth(
            addMonths(now, -11)
        );
    }

    return {
        start,
        end: now,
    };
}


// ============================================================
// VALID ORDER
// ============================================================

function isValidOrder(order) {

    const status =
        String(order?.status || "")
            .toLowerCase()
            .trim();

    return status === "delivered" && Boolean(order?.revenue_recognized_at);
}


// ============================================================
// ORDER TOTAL
// ============================================================

function getOrderTotal(order) {

    return Number(
        order?.total ??
        order?.grand_total ??
        order?.amount ??
        order?.total_amount ??
        0
    ) || 0;
}


// ============================================================
// FILTER ORDERS BY PERIOD
// ============================================================

function getOrdersForPeriod(period = currentPeriod) {

    const { start, end } = getPeriodRange(period);

    return ordersData.filter((order) => {

        const date = getOrderDate(order);

        if (!date) return false;

        return (
            date >= start &&
            date <= end
        );
    });
}


// ============================================================
// KPI DATA
// ============================================================

function calculateKPIs() {

    const orders = getOrdersForPeriod();

    const validOrders = orders.filter(isValidOrder);

    const revenue = validOrders.reduce(
        (total, order) => {
            return total + getOrderTotal(order);
        },
        0
    );

    const orderCount = orders.length;

    const averageOrder =
        validOrders.length > 0
            ? revenue / validOrders.length
            : 0;

    let customers = new Set();

    orders.forEach((order) => {

        const customer =
            order.user_id ??
            order.userId ??
            order.customer_email ??
            order.customerEmail ??
            order.email ??
            order.customer_name;

        if (customer !== undefined && customer !== null) {
            customers.add(String(customer));
        }
    });

    // If we cannot determine customers from orders,
    // use the dashboard's actual customer count.
    if (
        customers.size === 0 &&
        dashboardData?.stats?.customers !== undefined
    ) {
        customers = null;
    }

    return {
        revenue,
        orders: orderCount,
        customers:
            customers === null
                ? Number(dashboardData.stats.customers || 0)
                : customers.size,
        averageOrder,
    };
}


// ============================================================
// KPI PREVIOUS PERIOD
// ============================================================

function getPreviousPeriodRange() {

    const now = new Date();

    if (currentPeriod === "7d") {

        const end = addDays(startOfDay(now), -7);

        return {
            start: addDays(end, -6),
            end,
        };
    }

    if (currentPeriod === "30d") {

        const end = addDays(startOfDay(now), -30);

        return {
            start: addDays(end, -29),
            end,
        };
    }

    if (currentPeriod === "90d") {

        const end = addDays(startOfDay(now), -90);

        return {
            start: addDays(end, -89),
            end,
        };
    }

    const currentStart = startOfMonth(
        addMonths(now, -11)
    );

    const previousEnd = addDays(currentStart, -1);

    return {
        start: startOfMonth(
            addMonths(previousEnd, -11)
        ),
        end: previousEnd,
    };
}


function getPreviousPeriodOrders() {

    const range = getPreviousPeriodRange();

    return ordersData.filter((order) => {

        const date = getOrderDate(order);

        if (!date) return false;

        return (
            date >= range.start &&
            date <= range.end
        );
    });
}


function calculateChange(current, previous) {

    if (previous === 0) {

        if (current === 0) {
            return {
                value: "0.0%",
                direction: "up",
            };
        }

        return {
            value: "+100%",
            direction: "up",
        };
    }

    const percentage =
        ((current - previous) / previous) * 100;

    return {
        value:
            (percentage >= 0 ? "+" : "") +
            percentage.toFixed(1) +
            "%",
        direction:
            percentage >= 0
                ? "up"
                : "down",
    };
}


// ============================================================
// RENDER KPIs
// ============================================================

function renderKPIs() {

    const grid = $("#kpiGrid");

    if (!grid) return;

    const current = calculateKPIs();

    const previousOrders =
        getPreviousPeriodOrders();

    const previousValidOrders =
        previousOrders.filter(isValidOrder);

    const previousRevenue =
        previousValidOrders.reduce(
            (sum, order) =>
                sum + getOrderTotal(order),
            0
        );

    const previousAOV =
        previousValidOrders.length > 0
            ? previousRevenue /
              previousValidOrders.length
            : 0;

    const previousCustomers =
        new Set(
            previousOrders
                .map((order) =>
                    order.user_id ??
                    order.userId ??
                    order.customer_email ??
                    order.customerEmail ??
                    order.email
                )
                .filter(Boolean)
        ).size;

    const revenueChange =
        calculateChange(
            current.revenue,
            previousRevenue
        );

    const ordersChange =
        calculateChange(
            current.orders,
            previousOrders.length
        );

    const customersChange =
        calculateChange(
            current.customers,
            previousCustomers
        );

    const aovChange =
        calculateChange(
            current.averageOrder,
            previousAOV
        );

    const cards = [

        {
            label: "Revenue",
            value: money(current.revenue),
            change: revenueChange,
            icon: "fa-dollar-sign",
            cls: "revenue-icon",
        },

        {
            label: "Orders",
            value: number(current.orders),
            change: ordersChange,
            icon: "fa-bag-shopping",
            cls: "orders-icon",
        },

        {
            label: "Customers",
            value: number(current.customers),
            change: customersChange,
            icon: "fa-user-plus",
            cls: "customers-icon",
        },

        {
            label: "AOV",
            value: money(current.averageOrder),
            change: aovChange,
            icon: "fa-receipt",
            cls: "aov-icon",
        },

    ];

    let comparisonText;

    if (currentPeriod === "7d") {
        comparisonText = "vs previous 7 days";
    } else if (currentPeriod === "30d") {
        comparisonText = "vs previous 30 days";
    } else if (currentPeriod === "90d") {
        comparisonText = "vs previous 90 days";
    } else {
        comparisonText = "vs previous 12 months";
    }

    grid.innerHTML = cards.map((card) => {

        return `
            <div class="aa-kpi-card">

                <div class="aa-kpi-icon ${card.cls}">
                    <i class="fa-solid ${card.icon}"></i>
                </div>

                <div class="aa-kpi-body">

                    <span class="aa-kpi-label">
                        ${card.label}
                    </span>

                    <div class="aa-kpi-value-row">

                        <span class="aa-kpi-value">
                            ${escapeHtml(card.value)}
                        </span>

                        <span class="aa-kpi-change ${card.change.direction}">
                            ${escapeHtml(card.change.value)}
                        </span>

                    </div>

                    <span class="aa-kpi-vs">
                        ${comparisonText}
                    </span>

                </div>

            </div>
        `;

    }).join("");
}


// ============================================================
// REVENUE TREND DATA
// ============================================================

function getRevenueTrend() {

    const orders = ordersData.filter(isValidOrder);

    const now = new Date();

    // --------------------------------------------------------
    // 7 DAYS
    // --------------------------------------------------------

    if (currentPeriod === "7d") {

        const labels = [];
        const current = [];

        for (let i = 6; i >= 0; i--) {

            const date = addDays(
                startOfDay(now),
                -i
            );

            labels.push(
                date.toLocaleDateString(
                    undefined,
                    { weekday: "short" }
                )
            );

            const total = orders
                .filter((order) => {

                    const orderDate =
                        getOrderDate(order);

                    if (!orderDate) return false;

                    return (
                        orderDate >= date &&
                        orderDate < addDays(date, 1)
                    );
                })
                .reduce(
                    (sum, order) =>
                        sum + getOrderTotal(order),
                    0
                );

            current.push(total);
        }

        return {
            labels,
            current,
            previous: [],
        };
    }


    // --------------------------------------------------------
    // 30 DAYS
    // --------------------------------------------------------

    if (currentPeriod === "30d") {

        const labels = [];
        const current = [];

        for (let week = 3; week >= 0; week--) {

            const start = addDays(
                startOfDay(now),
                -(week * 7 + 6)
            );

            const end = addDays(
                start,
                7
            );

            labels.push(
                "W" + (4 - week)
            );

            const total = orders
                .filter((order) => {

                    const date =
                        getOrderDate(order);

                    return (
                        date &&
                        date >= start &&
                        date < end
                    );
                })
                .reduce(
                    (sum, order) =>
                        sum + getOrderTotal(order),
                    0
                );

            current.push(total);
        }

        return {
            labels,
            current,
            previous: [],
        };
    }


    // --------------------------------------------------------
    // 90 DAYS
    // --------------------------------------------------------

    if (currentPeriod === "90d") {

        const labels = [];
        const current = [];

        for (let month = 2; month >= 0; month--) {

            const date = new Date(
                now.getFullYear(),
                now.getMonth() - month,
                1
            );

            const end = new Date(
                date.getFullYear(),
                date.getMonth() + 1,
                1
            );

            labels.push(
                date.toLocaleDateString(
                    undefined,
                    { month: "short" }
                )
            );

            const total = orders
                .filter((order) => {

                    const orderDate =
                        getOrderDate(order);

                    return (
                        orderDate &&
                        orderDate >= date &&
                        orderDate < end
                    );
                })
                .reduce(
                    (sum, order) =>
                        sum + getOrderTotal(order),
                    0
                );

            current.push(total);
        }

        return {
            labels,
            current,
            previous: [],
        };
    }


    // --------------------------------------------------------
    // 12 MONTHS
    // --------------------------------------------------------

    const labels = [];
    const current = [];

    for (let month = 11; month >= 0; month--) {

        const start = new Date(
            now.getFullYear(),
            now.getMonth() - month,
            1
        );

        const end = new Date(
            start.getFullYear(),
            start.getMonth() + 1,
            1
        );

        labels.push(
            start.toLocaleDateString(
                undefined,
                { month: "short" }
            )
        );

        const total = orders
            .filter((order) => {

                const orderDate =
                    getOrderDate(order);

                return (
                    orderDate &&
                    orderDate >= start &&
                    orderDate < end
                );
            })
            .reduce(
                (sum, order) =>
                    sum + getOrderTotal(order),
                0
            );

        current.push(total);
    }

    return {
        labels,
        current,
        previous: [],
    };
}


// ============================================================
// REVENUE CHART
// ============================================================

function renderRevenueChart() {

    const canvas = $("#revenueChart");

    if (!canvas || typeof Chart === "undefined") {
        return;
    }

    const ctx = canvas.getContext("2d");

    const data = getRevenueTrend();

    if (revenueChart) {
        revenueChart.destroy();
    }

    const gradient =
        ctx.createLinearGradient(
            0,
            0,
            0,
            260
        );

    gradient.addColorStop(
        0,
        "rgba(37, 99, 235, 0.18)"
    );

    gradient.addColorStop(
        1,
        "rgba(37, 99, 235, 0)"
    );

    revenueChart = new Chart(ctx, {

        type: "line",

        data: {

            labels: data.labels,

            datasets: [

                {
                    label: "Revenue",

                    data: data.current,

                    borderColor: "#2563eb",

                    backgroundColor: gradient,

                    borderWidth: 2.5,

                    fill: true,

                    tension: 0.4,

                    pointRadius: 4,

                    pointBackgroundColor:
                        "#2563eb",

                    pointBorderColor: "#fff",

                    pointBorderWidth: 2,

                    pointHoverRadius: 7,
                },

            ],
        },

        options: {

            responsive: true,

            maintainAspectRatio: false,

            interaction: {
                mode: "index",
                intersect: false,
            },

            plugins: {

                legend: {
                    display: true,
                    position: "top",
                    align: "end",
                },

                tooltip: {

                    backgroundColor:
                        "#0f172a",

                    padding: 12,

                    cornerRadius: 10,

                    callbacks: {

                        label: (context) => {

                            return (
                                " Revenue: " +
                                money(context.parsed.y)
                            );
                        },

                    },
                },
            },

            scales: {

                x: {

                    grid: {
                        display: false,
                    },

                    ticks: {
                        font: {
                            size: 12,
                            weight: "600",
                        },

                        color: "#94a3b8",
                    },
                },

                y: {

                    beginAtZero: true,

                    grid: {
                        color: "#f1f5f9",
                    },

                    ticks: {

                        color: "#94a3b8",

                        callback: (value) =>
                            compactMoney(value),
                    },

                    border: {
                        display: false,
                    },
                },
            },
        },
    });
}


// ============================================================
// ORDER STATUS
// ============================================================

function renderStatusBars() {

    const container = $("#statusBars");

    if (!container) return;

    const orders =
        getOrdersForPeriod();

    const statusMap = {};

    orders.forEach((order) => {

        let status =
            String(
                order.status || "Processing"
            ).toLowerCase();

        if (
            status === "canceled"
        ) {
            status = "cancelled";
        }

        statusMap[status] =
            (statusMap[status] || 0) + 1;
    });

    const statusDefinitions = [

        {
            label: "Delivered",
            key: "delivered",
            cls: "delivered",
        },

        {
            label: "Shipped",
            key: "shipped",
            cls: "shipped",
        },

        {
            label: "Processing",
            key: "processing",
            cls: "processing",
        },

        {
            label: "Cancelled",
            key: "cancelled",
            cls: "cancelled",
        },

        {
            label: "Refunded",
            key: "refunded",
            cls: "refunded",
        },

    ];

    const total = orders.length;

    container.innerHTML =
        statusDefinitions
            .map((status) => {

                const count =
                    statusMap[status.key] || 0;

                const percentage =
                    total > 0
                        ? (count / total) * 100
                        : 0;

                return `

                    <div class="aa-status-bar-item">

                        <div class="aa-status-bar-label">

                            <span>
                                ${status.label}
                            </span>

                            <span class="aa-status-bar-count">
                                ${number(count)}
                                (${percentage.toFixed(1)}%)
                            </span>

                        </div>

                        <div class="aa-status-bar-track">

                            <div
                                class="aa-status-bar-fill ${status.cls}"
                                data-width="${percentage}"
                            ></div>

                        </div>

                    </div>

                `;

            })
            .join("");

    requestAnimationFrame(() => {

        container
            .querySelectorAll(
                ".aa-status-bar-fill"
            )
            .forEach((bar) => {

                bar.style.width =
                    bar.dataset.width + "%";

            });

    });

    // Update total in card heading
    const statusHint =
        document.querySelector(
            ".aa-charts-row .aa-card:nth-child(2) .aa-card-hint"
        );

    if (statusHint) {
        statusHint.textContent =
            number(total) + " total";
    }
}


// ============================================================
// CATEGORY REVENUE
// ============================================================

function getCategoryData() {

    if (
        dashboardData &&
        Array.isArray(
            dashboardData.categories
        )
    ) {

        return dashboardData.categories
            .map((category) => ({

                label:
                    category.name ||
                    "Other",

                value:
                    Number(
                        category.revenue
                    ) || 0,

                pct:
                    Number(
                        category.percent
                    ) || 0,

            }))
            .filter(
                (category) =>
                    category.value > 0
            );
    }

    return [];
}


// ============================================================
// DONUT CHART
// ============================================================

function renderDonutChart() {

    const canvas = $("#donutChart");

    if (!canvas) return;

    const ctx =
        canvas.getContext("2d");

    const categories =
        getCategoryData();

    const colors = [
        "#2563eb",
        "#16a34a",
        "#d97706",
        "#7c3aed",
        "#dc2626",
        "#94a3b8",
    ];

    const total =
        categories.reduce(
            (sum, category) =>
                sum + category.value,
            0
        );

    const size = 200;

    const dpr =
        window.devicePixelRatio || 1;

    canvas.width =
        size * dpr;

    canvas.height =
        size * dpr;

    canvas.style.width =
        size + "px";

    canvas.style.height =
        size + "px";

    ctx.setTransform(
        dpr,
        0,
        0,
        dpr,
        0,
        0
    );

    const center = size / 2;

    const outerRadius = 90;
    const innerRadius = 58;

    ctx.clearRect(
        0,
        0,
        size,
        size
    );

    if (total <= 0) {

        ctx.beginPath();

        ctx.arc(
            center,
            center,
            outerRadius,
            0,
            Math.PI * 2
        );

        ctx.arc(
            center,
            center,
            innerRadius,
            0,
            Math.PI * 2,
            true
        );

        ctx.closePath();

        ctx.fillStyle =
            "#e2e8f0";

        ctx.fill();

    } else {

        let angle =
            -Math.PI / 2;

        categories.forEach(
            (category, index) => {

                const percentage =
                    category.value /
                    total;

                const sweep =
                    percentage *
                    Math.PI *
                    2;

                ctx.beginPath();

                ctx.arc(
                    center,
                    center,
                    outerRadius,
                    angle,
                    angle + sweep
                );

                ctx.arc(
                    center,
                    center,
                    innerRadius,
                    angle + sweep,
                    angle,
                    true
                );

                ctx.closePath();

                ctx.fillStyle =
                    colors[
                        index %
                        colors.length
                    ];

                ctx.fill();

                angle += sweep;
            }
        );
    }

    // Center value
    ctx.fillStyle =
        "#0f1724";

    ctx.font =
        "800 20px -apple-system, sans-serif";

    ctx.textAlign =
        "center";

    ctx.textBaseline =
        "middle";

    ctx.fillText(
        compactMoney(total),
        center,
        center - 6
    );

    ctx.fillStyle =
        "#94a3b8";

    ctx.font =
        "600 11px -apple-system, sans-serif";

    ctx.fillText(
        "Total Revenue",
        center,
        center + 14
    );

    // Legend

    const legend =
        $("#donutLegend");

    if (!legend) return;

    legend.innerHTML =
        categories
            .map(
                (category, index) => {

                    const percentage =
                        total > 0
                            ? (
                                category.value /
                                total *
                                100
                            )
                            : 0;

                    return `

                        <div class="aa-legend-item">

                            <span
                                class="aa-legend-dot"
                                style="
                                    background:
                                    ${colors[
                                        index %
                                        colors.length
                                    ]}
                                "
                            ></span>

                            <span>
                                ${escapeHtml(
                                    category.label
                                )}
                            </span>

                            <span
                                class="aa-legend-pct"
                            >
                                ${percentage.toFixed(1)}%
                            </span>

                        </div>

                    `;

                }
            )
            .join("");
}


// ============================================================
// WEEKLY COMPARISON
// ============================================================

function getWeeklyData() {
    const today = startOfDay(new Date());
    const mondayOffset = (today.getDay() + 6) % 7;
    const currentStart = addDays(today, -mondayOffset);
    const previousStart = addDays(currentStart, -7);
    const current = [];
    const previous = [];

    for (let i = 0; i < 7; i++) {
        const currentDay = addDays(currentStart, i);
        const currentNext = addDays(currentDay, 1);
        const previousDay = addDays(previousStart, i);
        const previousNext = addDays(previousDay, 1);
        const sumForRange = (start, end) => ordersData.filter((order) => {
            const date = getOrderDate(order);
            return date && isValidOrder(order) && date >= start && date < end;
        }).reduce((sum, order) => sum + getOrderTotal(order), 0);
        current.push(sumForRange(currentDay, currentNext));
        previous.push(sumForRange(previousDay, previousNext));
    }
    return { current, previous };
}


let weeklyComparisonChart = null;

function renderWeeklyBars() {
    const canvas = $("#weeklyComparisonChart");
    if (!canvas || typeof Chart === "undefined") return;
    const data = getWeeklyData();
    const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    if (weeklyComparisonChart) weeklyComparisonChart.destroy();
    weeklyComparisonChart = new Chart(canvas.getContext("2d"), {
        type: "bar",
        data: {
            labels,
            datasets: [
                { label: "Current Week", data: data.current, borderWidth: 1 },
                { label: "Previous Week", data: data.previous, borderWidth: 1 },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            plugins: {
                legend: { display: true },
                tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${money(ctx.parsed.y)}` } },
            },
            scales: {
                y: { beginAtZero: true, ticks: { callback: (value) => compactMoney(value) } },
            },
        },
    });
}


// ============================================================
// TOP PRODUCTS
// ============================================================

function getTopProducts() {

    // Prefer real best sellers from your backend.
    if (
        dashboardData &&
        Array.isArray(
            dashboardData.best_sellers
        )
    ) {

        return dashboardData.best_sellers
            .map((product) => ({

                name:
                    product.name ||
                    product.product_name ||
                    "Unknown Product",

                category:
                    product.category ||
                    "Other",

                revenue:
                    Number(
                        product.revenue
                    ) || 0,

                units:
                    Number(
                        product.units
                    ) || 0,

                image:
                    product.image ||
                    product.image_url ||
                    "",

            }))
            .sort(
                (a, b) => (b.units - a.units) || (b.revenue - a.revenue)
            )
            .slice(0, 6);
    }

    return [];
}


// ============================================================
// PRODUCT IMAGE
// ============================================================

function getProductImage(image) {

    if (!image) {
        return "";
    }

    if (
        image.startsWith("http://") ||
        image.startsWith("https://") ||
        image.startsWith("data:")
    ) {
        return image;
    }

    if (image.startsWith("/")) {
        return API + image;
    }

    return (
        API +
        "/uploads/products/" +
        encodeURIComponent(image)
    );
}


// ============================================================
// PRODUCT TABLE
// ============================================================

function renderProductTable() {

    const tbody =
        $("#productTableBody");

    if (!tbody) return;

    const products =
        getTopProducts();

    if (products.length === 0) {

        tbody.innerHTML = `

            <tr>

                <td
                    colspan="4"
                    style="
                        text-align:center;
                        padding:30px;
                        color:#94a3b8;
                    "
                >
                    No product sales data available
                </td>

            </tr>

        `;

        return;
    }

    const totalUnits = products.reduce((sum, product) => sum + product.units, 0);

    tbody.innerHTML =
        products
            .map((product) => {

                const conversion =
                    totalUnits > 0
                        ? (product.units / totalUnits) * 100
                        : 0;

                const good =
                    conversion >= 5;

                const image =
                    getProductImage(
                        product.image
                    );

                const imageHtml =
                    image
                        ? `
                            <img
                                src="${escapeHtml(image)}"
                                alt="${escapeHtml(
                                    product.name
                                )}"
                                loading="lazy"
                                onerror="
                                    this.style.display='none'
                                "
                            >
                          `
                        : `
                            <div
                                style="
                                    width:100%;
                                    height:100%;
                                    display:flex;
                                    align-items:center;
                                    justify-content:center;
                                    color:#94a3b8;
                                "
                            >
                                <i class="fa-solid fa-box"></i>
                            </div>
                          `;

                return `

                    <tr>

                        <td>

                            <div class="aa-product-cell">

                                <div class="aa-product-thumb">
                                    ${imageHtml}
                                </div>

                                <div>

                                    <div class="aa-product-name">
                                        ${escapeHtml(
                                            product.name
                                        )}
                                    </div>

                                    <span class="aa-product-cat">
                                        ${escapeHtml(
                                            product.category
                                        )}
                                    </span>

                                </div>

                            </div>

                        </td>

                        <td class="num">
                            ${money(
                                product.revenue
                            )}
                        </td>

                        <td class="num">
                            ${number(
                                product.units
                            )}
                        </td>

                        <td>

                            <span
                                class="
                                    aa-conv-rate
                                    ${good
                                        ? "good"
                                        : "low"}
                                "
                            >

                                ${conversion.toFixed(1)}%

                                <span
                                    class="conv-bar"
                                >

                                    <span
                                        class="
                                            conv-bar-fill
                                            ${good
                                                ? ""
                                                : "low"}
                                        "
                                        data-w="${Math.min(
                                            conversion * 10,
                                            100
                                        )}"
                                    ></span>

                                </span>

                            </span>

                        </td>

                    </tr>

                `;

            })
            .join("");

    requestAnimationFrame(() => {

        setTimeout(() => {

            tbody
                .querySelectorAll(
                    ".conv-bar-fill"
                )
                .forEach((bar) => {

                    bar.style.width =
                        bar.dataset.w +
                        "%";

                });

        }, 300);

    });
}


// ============================================================
// LOAD DASHBOARD DATA
// ============================================================

async function loadDashboardData() {

    const data =
        await apiFetch(
            API +
            "/admin/dashboard"
        );

    if (!data.success) {

        throw new Error(
            data.message ||
            "Could not load dashboard data"
        );
    }

    dashboardData = data;

    console.log(
        "Analytics dashboard data:",
        dashboardData
    );
}


// ============================================================
// LOAD ORDERS
// ============================================================

async function loadOrders() {

    /*
     * Your orders blueprint may return the data
     * under different property names.
     *
     * This function supports the common structures.
     */

    try {

        const data =
            await apiFetch(
                API +
                "/orders"
            );

        console.log(
            "Analytics orders response:",
            data
        );

        if (Array.isArray(data)) {

            ordersData = data;

        } else if (
            Array.isArray(data.orders)
        ) {

            ordersData = data.orders;

        } else if (
            Array.isArray(data.data)
        ) {

            ordersData = data.data;

        } else if (
            data.success &&
            Array.isArray(data.orders)
        ) {

            ordersData = data.orders;

        } else {

            ordersData = [];
        }

    } catch (error) {

        console.warn(
            "Could not load /orders:",
            error
        );

        ordersData = [];

    }
}


// ============================================================
// FALLBACK ORDERS FROM DASHBOARD
// ============================================================

function createFallbackOrders() {

    if (
        ordersData.length > 0 ||
        !dashboardData
    ) {
        return;
    }

    /*
     * The dashboard endpoint gives us totals and
     * monthly revenue but not individual orders.
     *
     * Therefore, keep orders empty rather than
     * inventing order information.
     */

    ordersData = [];
}


// ============================================================
// LOADING STATE
// ============================================================

function showLoading() {

    const grid =
        $("#kpiGrid");

    if (grid) {

        grid.innerHTML = `

            <div
                class="aa-kpi-card"
                style="
                    grid-column:1/-1;
                    justify-content:center;
                "
            >

                <div class="aa-kpi-body">

                    <span
                        class="aa-kpi-label"
                        style="
                            text-align:center;
                        "
                    >
                        Loading analytics...
                    </span>

                </div>

            </div>

        `;
    }
}


// ============================================================
// ERROR STATE
// ============================================================

function showError(error) {

    console.error(
        "Analytics error:",
        error
    );

    const grid =
        $("#kpiGrid");

    if (grid) {

        grid.innerHTML = `

            <div
                class="aa-kpi-card"
                style="
                    grid-column:1/-1;
                    border-color:#fecaca;
                "
            >

                <div
                    class="aa-kpi-icon"
                    style="
                        background:#fee2e2;
                        color:#dc2626;
                    "
                >

                    <i
                        class="fa-solid fa-triangle-exclamation"
                    ></i>

                </div>

                <div class="aa-kpi-body">

                    <span
                        class="aa-kpi-label"
                        style="color:#dc2626"
                    >
                        Analytics Error
                    </span>

                    <div
                        style="
                            color:#475569;
                            margin-top:8px;
                        "
                    >
                        ${escapeHtml(
                            error?.message ||
                            "Unable to load analytics"
                        )}
                    </div>

                </div>

            </div>

        `;
    }

    showToast(
        error?.message ||
        "Could not load analytics",
        "fa-triangle-exclamation"
    );
}


// ============================================================
// RENDER EVERYTHING
// ============================================================

function renderAll() {

    renderKPIs();

    renderRevenueChart();

    renderStatusBars();

    renderDonutChart();

    renderWeeklyBars();

    renderProductTable();

    updateRevenueHint();
}


// ============================================================
// INITIALIZE
// ============================================================

async function initAnalytics() {

    showLoading();

    initSidebar();

    initPeriodToggle();

    try {

        const token =
            getToken();

        if (!token) {

            throw new Error(
                "Admin login session not found. Please log in again."
            );
        }

        // Load both sources.
        await Promise.all([
            loadDashboardData(),
            loadOrders(),
        ]);

        createFallbackOrders();

        renderAll();

        console.log(
            "Analytics loaded successfully."
        );

    } catch (error) {

        showError(error);

    }
}


// ============================================================
// START
// ============================================================

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initAnalytics
    );

} else {

    initAnalytics();

}