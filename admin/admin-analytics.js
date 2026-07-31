// ── Mock Data ──
const DATA = {
  kpi: {
    '7d': [
      { label: 'Revenue',   value: '$18,420',   change: '+12.4%', dir: 'up',   vs: 'vs prev 7 days',  icon: 'fa-dollar-sign', cls: 'revenue-icon' },
      { label: 'Orders',    value: '312',       change: '+8.1%',  dir: 'up',   vs: 'vs prev 7 days',  icon: 'fa-bag-shopping', cls: 'orders-icon' },
      { label: 'Customers', value: '198',       change: '+5.3%',  dir: 'up',   vs: 'vs prev 7 days',  icon: 'fa-user-plus',    cls: 'customers-icon' },
      { label: 'AOV',       value: '$59.04',    change: '-2.1%',  dir: 'down', vs: 'vs prev 7 days',  icon: 'fa-receipt',      cls: 'aov-icon' },
    ],
    '30d': [
      { label: 'Revenue',   value: '$84,310',   change: '+18.7%', dir: 'up',   vs: 'vs prev 30 days', icon: 'fa-dollar-sign', cls: 'revenue-icon' },
      { label: 'Orders',    value: '1,284',     change: '+14.2%', dir: 'up',   vs: 'vs prev 30 days', icon: 'fa-bag-shopping', cls: 'orders-icon' },
      { label: 'Customers', value: '847',       change: '+11.6%', dir: 'up',   vs: 'vs prev 30 days', icon: 'fa-user-plus',    cls: 'customers-icon' },
      { label: 'AOV',       value: '$65.67',    change: '+3.9%',  dir: 'up',   vs: 'vs prev 30 days', icon: 'fa-receipt',      cls: 'aov-icon' },
    ],
    '90d': [
      { label: 'Revenue',   value: '$247,890',  change: '+22.1%', dir: 'up',   vs: 'vs prev 90 days', icon: 'fa-dollar-sign', cls: 'revenue-icon' },
      { label: 'Orders',    value: '3,671',     change: '+16.8%', dir: 'up',   vs: 'vs prev 90 days', icon: 'fa-bag-shopping', cls: 'orders-icon' },
      { label: 'Customers', value: '2,134',     change: '+19.4%', dir: 'up',   vs: 'vs prev 90 days', icon: 'fa-user-plus',    cls: 'customers-icon' },
      { label: 'AOV',       value: '$67.53',    change: '+4.6%',  dir: 'up',   vs: 'vs prev 90 days', icon: 'fa-receipt',      cls: 'aov-icon' },
    ],
    '12m': [
      { label: 'Revenue',   value: '$1,124,500', change: '+31.2%', dir: 'up',  vs: 'vs prev 12 months', icon: 'fa-dollar-sign', cls: 'revenue-icon' },
      { label: 'Orders',    value: '16,840',    change: '+24.5%', dir: 'up',   vs: 'vs prev 12 months', icon: 'fa-bag-shopping', cls: 'orders-icon' },
      { label: 'Customers', value: '9,720',     change: '+28.3%', dir: 'up',   vs: 'vs prev 12 months', icon: 'fa-user-plus',    cls: 'customers-icon' },
      { label: 'AOV',       value: '$66.78',    change: '+5.4%',  dir: 'up',   vs: 'vs prev 12 months', icon: 'fa-receipt',      cls: 'aov-icon' },
    ],
  },
  revenue: {
    '7d':  { labels: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'], current: [2640,3120,2890,3410,2960,1780,1620], previous: [2340,2780,2510,2980,2670,1520,1380] },
    '30d': { labels: ['W1','W2','W3','W4'], current: [18200,21400,20800,23910], previous: [15400,17800,18100,19200] },
    '90d': { labels: ['Jan','Feb','Mar'], current: [74200,82400,91290], previous: [60100,68300,74800] },
    '12m': { labels: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'], current: [74200,82400,91290,88100,95400,102300,97800,104200,112400,108700,96300,71400], previous: [60100,68300,74800,71200,78900,84200,80100,86400,92100,88600,79200,58900] },
  },
  status: [
    { label: 'Delivered',  count: 684, cls: 'delivered',  pct: 53.3 },
    { label: 'Shipped',    count: 298, cls: 'shipped',    pct: 23.2 },
    { label: 'Processing', count: 184, cls: 'processing', pct: 14.3 },
    { label: 'Cancelled',  count: 72,  cls: 'cancelled',  pct: 5.6 },
    { label: 'Refunded',   count: 46,  cls: 'refunded',   pct: 3.6 },
  ],
  donut: [
    { label: 'Electronics',   value: 34200, color: '#2563eb', pct: 40.6 },
    { label: 'Clothing',      value: 21800, color: '#16a34a', pct: 25.9 },
    { label: 'Home & Garden', value: 14200, color: '#d97706', pct: 16.8 },
    { label: 'Sports',        value: 8900,  color: '#7c3aed', pct: 10.6 },
    { label: 'Other',         value: 5210,  color: '#94a3b8', pct: 6.1 },
  ],
  weekly: [
    { day: 'Mon', current: 4200, previous: 3600 },
    { day: 'Tue', current: 5100, previous: 4500 },
    { day: 'Wed', current: 4800, previous: 4100 },
    { day: 'Thu', current: 5600, previous: 4900 },
    { day: 'Fri', current: 4900, previous: 4300 },
    { day: 'Sat', current: 3200, previous: 2800 },
    { day: 'Sun', current: 2900, previous: 2500 },
  ],
  products: [
    { name: 'Wireless Noise-Cancel Headphones', cat: 'Electronics',   img: 'https://picsum.photos/seed/headph/88/88.jpg',  revenue: '$12,480', units: 186, conv: 8.4, convGood: true },
    { name: 'Premium Cotton Crew Neck Tee',     cat: 'Clothing',      img: 'https://picsum.photos/seed/tshirt/88/88.jpg',  revenue: '$8,920',  units: 412, conv: 6.2, convGood: true },
    { name: 'Smart LED Desk Lamp',              cat: 'Home & Garden', img: 'https://picsum.photos/seed/lamp22/88/88.jpg',  revenue: '$6,340',  units: 142, conv: 5.1, convGood: true },
    { name: 'Carbon Fiber Running Shoes',       cat: 'Sports',        img: 'https://picsum.photos/seed/shoes9/88/88.jpg',  revenue: '$5,870',  units: 94,  conv: 3.8, convGood: false },
    { name: 'Organic Matcha Powder 200g',       cat: 'Food & Drink',  img: 'https://picsum.photos/seed/matcha/88/88.jpg',  revenue: '$4,210',  units: 328, conv: 7.1, convGood: true },
    { name: 'Minimalist Leather Wallet',        cat: 'Accessories',   img: 'https://picsum.photos/seed/wallet/88/88.jpg',  revenue: '$3,760',  units: 156, conv: 4.5, convGood: true },
  ],
};

// ── State ──
let currentPeriod = '30d';
let revenueChart = null;

// ── Utilities ──
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function showToast(msg, icon = 'fa-circle-check') {
  const c = $('#toastContainer');
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `<i class="fa-solid ${icon}"></i> ${msg}`;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

// ── Sidebar toggle (mobile) ──
 $('#menuToggle').addEventListener('click', () => {
  $('#adminSidebar').classList.toggle('open');
  $('#sidebarOverlay').classList.toggle('show');
});
 $('#sidebarOverlay').addEventListener('click', () => {
  $('#adminSidebar').classList.remove('open');
  $('#sidebarOverlay').classList.remove('show');
});

// ── Period Toggle ──
 $('#periodToggle').addEventListener('click', (e) => {
  const btn = e.target.closest('.aa-period-btn');
  if (!btn) return;
  $$('.aa-period-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentPeriod = btn.dataset.period;
  renderKPIs();
  renderRevenueChart();
  const hintMap = { '7d': 'Last 7 days', '30d': 'Last 30 days', '90d': 'Last 90 days', '12m': 'Last 12 months' };
  $('#revenueHint').textContent = hintMap[currentPeriod];
});

// ── Render KPIs ──
function renderKPIs() {
  const grid = $('#kpiGrid');
  grid.innerHTML = DATA.kpi[currentPeriod].map(k => `
    <div class="aa-kpi-card">
      <div class="aa-kpi-icon ${k.cls}"><i class="fa-solid ${k.icon}"></i></div>
      <div class="aa-kpi-body">
        <span class="aa-kpi-label">${k.label}</span>
        <div class="aa-kpi-value-row">
          <span class="aa-kpi-value">${k.value}</span>
          <span class="aa-kpi-change ${k.dir}">${k.change}</span>
        </div>
        <span class="aa-kpi-vs">${k.vs}</span>
      </div>
    </div>
  `).join('');
}

// ── Render Revenue Chart (Chart.js) ──
function renderRevenueChart() {
  const ctx = $('#revenueChart').getContext('2d');
  const d = DATA.revenue[currentPeriod];

  if (revenueChart) revenueChart.destroy();

  const grad = ctx.createLinearGradient(0, 0, 0, 260);
  grad.addColorStop(0, 'rgba(37, 99, 235, 0.18)');
  grad.addColorStop(1, 'rgba(37, 99, 235, 0.0)');

  revenueChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: d.labels,
      datasets: [
        {
          label: 'Current',
          data: d.current,
          borderColor: '#2563eb',
          backgroundColor: grad,
          borderWidth: 2.5,
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: '#2563eb',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointHoverRadius: 7,
        },
        {
          label: 'Previous',
          data: d.previous,
          borderColor: '#cbd5e1',
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderDash: [6, 4],
          fill: false,
          tension: 0.4,
          pointRadius: 3,
          pointBackgroundColor: '#cbd5e1',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointHoverRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          align: 'end',
          labels: { boxWidth: 12, boxHeight: 3, borderRadius: 2, useBorderRadius: true, padding: 16, font: { size: 12, weight: '600' }, color: '#64748b' }
        },
        tooltip: {
          backgroundColor: '#0f172a',
          titleFont: { size: 12, weight: '600' },
          bodyFont: { size: 12 },
          padding: 12,
          cornerRadius: 10,
          displayColors: true,
          boxWidth: 8,
          boxHeight: 8,
          boxPadding: 4,
          callbacks: {
            label: (ctx) => ` ${ctx.dataset.label}: $${ctx.parsed.y.toLocaleString()}`
          }
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 12, weight: '600' }, color: '#94a3b8' } },
        y: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 11 }, color: '#94a3b8', callback: (v) => '$' + (v / 1000).toFixed(0) + 'k' }, border: { display: false } },
      },
    },
  });
}

// ── Render Status Bars ──
function renderStatusBars() {
  const container = $('#statusBars');
  container.innerHTML = DATA.status.map(s => `
    <div class="aa-status-bar-item">
      <div class="aa-status-bar-label">
        <span>${s.label}</span>
        <span class="aa-status-bar-count">${s.count} (${s.pct}%)</span>
      </div>
      <div class="aa-status-bar-track">
        <div class="aa-status-bar-fill ${s.cls}" data-width="${s.pct}"></div>
      </div>
    </div>
  `).join('');

  requestAnimationFrame(() => {
    container.querySelectorAll('.aa-status-bar-fill').forEach(bar => {
      bar.style.width = bar.dataset.width + '%';
    });
  });
}

// ── Render Donut Chart (custom canvas) ──
function renderDonutChart() {
  const canvas = $('#donutChart');
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const size = 200;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = size + 'px';
  canvas.style.height = size + 'px';
  ctx.scale(dpr, dpr);

  const cx = size / 2;
  const cy = size / 2;
  const outerR = 90;
  const innerR = 58;
  const total = DATA.donut.reduce((s, d) => s + d.value, 0);

  let progress = 0;
  function drawFrame() {
    progress = Math.min(progress + 0.03, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    ctx.clearRect(0, 0, size, size);

    let angle = -Math.PI / 2;
    DATA.donut.forEach(seg => {
      const sweep = (seg.value / total) * Math.PI * 2 * eased;
      ctx.beginPath();
      ctx.arc(cx, cy, outerR, angle, angle + sweep);
      ctx.arc(cx, cy, innerR, angle + sweep, angle, true);
      ctx.closePath();
      ctx.fillStyle = seg.color;
      ctx.fill();
      angle += sweep;
    });

    ctx.fillStyle = '#0f1724';
    ctx.font = '800 22px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$' + Math.round(total * eased).toLocaleString(), cx, cy - 6);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 11px -apple-system, sans-serif';
    ctx.fillText('Total Revenue', cx, cy + 14);

    if (progress < 1) requestAnimationFrame(drawFrame);
  }
  drawFrame();

  const legend = $('#donutLegend');
  legend.innerHTML = DATA.donut.map(d => `
    <div class="aa-legend-item">
      <span class="aa-legend-dot" style="background:${d.color}"></span>
      <span>${d.label}</span>
      <span class="aa-legend-pct">${d.pct}%</span>
    </div>
  `).join('');
}

// ── Render Weekly Bars ──
function renderWeeklyBars() {
  const container = $('#weeklyBars');
  const maxVal = Math.max(...DATA.weekly.map(w => Math.max(w.current, w.previous)));

  container.innerHTML = DATA.weekly.map(w => {
    const curH = (w.current / maxVal) * 100;
    const prevH = (w.previous / maxVal) * 100;
    return `
      <div class="aa-weekly-col">
        <div class="aa-weekly-amount">$${(w.current / 1000).toFixed(1)}k</div>
        <div class="aa-weekly-bar-track">
          <div class="aa-weekly-bar-pair">
            <div class="aa-weekly-fill current" data-h="${curH}"></div>
            <div class="aa-weekly-fill previous" data-h="${prevH}"></div>
          </div>
        </div>
        <div class="aa-weekly-label">${w.day}</div>
      </div>
    `;
  }).join('');

  requestAnimationFrame(() => {
    setTimeout(() => {
      container.querySelectorAll('.aa-weekly-fill').forEach(bar => {
        bar.style.height = bar.dataset.h + '%';
      });
    }, 100);
  });
}

// ── Render Product Table ──
function renderProductTable() {
  const tbody = $('#productTableBody');
  tbody.innerHTML = DATA.products.map(p => {
    const convCls = p.convGood ? 'good' : 'low';
    const fillCls = p.convGood ? '' : 'low';
    return `
      <tr>
        <td>
          <div class="aa-product-cell">
            <div class="aa-product-thumb"><img src="${p.img}" alt="${p.name}" loading="lazy"></div>
            <div>
              <div class="aa-product-name">${p.name}</div>
              <span class="aa-product-cat">${p.cat}</span>
            </div>
          </div>
        </td>
        <td class="num">${p.revenue}</td>
        <td class="num">${p.units}</td>
        <td>
          <span class="aa-conv-rate ${convCls}">
            ${p.conv}%
            <span class="conv-bar"><span class="conv-bar-fill ${fillCls}" data-w="${p.conv * 10}"></span></span>
          </span>
        </td>
      </tr>
    `;
  }).join('');

  requestAnimationFrame(() => {
    setTimeout(() => {
      tbody.querySelectorAll('.conv-bar-fill').forEach(bar => {
        bar.style.width = bar.dataset.w + '%';
      });
    }, 300);
  });
}

// ── Init ──
function init() {
  renderKPIs();
  renderRevenueChart();
  renderStatusBars();
  renderDonutChart();
  renderWeeklyBars();
  renderProductTable();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}