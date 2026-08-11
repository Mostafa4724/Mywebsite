const sidebar = document.getElementById('adminSidebar');
const overlay = document.getElementById('sidebarOverlay');
const toggle = document.getElementById('menuToggle');

function openSidebar() {
  sidebar.classList.add('open');
  overlay.classList.add('visible');
  document.body.style.overflow = 'hidden';
}

function closeSidebar() {
  sidebar.classList.remove('open');
  overlay.classList.remove('visible');
  document.body.style.overflow = '';
}

toggle.addEventListener('click', () => {
  sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
});

overlay.addEventListener('click', closeSidebar);

/* Stagger bar chart entrance animation */
const bars = document.querySelectorAll('.chart-bar');
bars.forEach((bar, i) => {
  bar.style.animationDelay = `${0.4 + i * 0.1}s`;
});