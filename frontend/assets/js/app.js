'use strict';

const sidebar = document.querySelector('#sidebar');
const navToggle = document.querySelector('#nav-toggle');
const navBackdrop = document.querySelector('#nav-backdrop');
const mobileLayout = window.matchMedia('(max-width: 850px)');
function syncNavAccessibility() {
  const open = mobileLayout.matches ? sidebar?.classList.contains('open') : !document.documentElement.classList.contains('nav-collapsed');
  if (sidebar) sidebar.inert = !open;
  navToggle?.setAttribute('aria-expanded', String(Boolean(open)));
  navToggle?.setAttribute('aria-label', open ? 'Tutup navigasi' : 'Buka navigasi');
  if (navBackdrop) navBackdrop.hidden = !(mobileLayout.matches && open);
}
function closeNav() {
  sidebar?.classList.remove('open');
  syncNavAccessibility();
}
navToggle?.addEventListener('click', () => {
  if (mobileLayout.matches) {
    sidebar?.classList.toggle('open');
    syncNavAccessibility();
    if (sidebar?.classList.contains('open')) document.querySelector('#nav-close')?.focus();
  } else {
    const collapsed = document.documentElement.classList.toggle('nav-collapsed');
    try { localStorage.setItem('fleet-nav-collapsed', String(collapsed)); } catch (_) {}
    syncNavAccessibility();
  }
});
navBackdrop?.addEventListener('click', closeNav);
document.querySelector('#nav-close')?.addEventListener('click', () => { closeNav(); navToggle?.focus(); });
mobileLayout.addEventListener('change', closeNav);
syncNavAccessibility();
const profileMenu = document.querySelector('.profile-menu');
document.addEventListener('click', (event) => { if (profileMenu && !profileMenu.contains(event.target)) profileMenu.open = false; });
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (sidebar?.classList.contains('open')) { closeNav(); navToggle?.focus(); }
    if (profileMenu?.open) { profileMenu.open = false; profileMenu.querySelector('summary').focus(); }
  }
  if (event.key === 'Tab' && mobileLayout.matches && sidebar?.classList.contains('open')) {
    const items = [...sidebar.querySelectorAll('a, button')];
    const first = items[0], last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
});
const themeToggle = document.querySelector('#theme-toggle');
function syncThemeLabel() {
  themeToggle?.setAttribute('aria-label', document.documentElement.dataset.theme === 'dark' ? 'Aktifkan mode terang' : 'Aktifkan mode gelap');
}
themeToggle?.addEventListener('click', () => {
  const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem('fleet-theme', theme); } catch (_) {}
  syncThemeLabel();
});
syncThemeLabel();

const dialog = document.querySelector('#image-dialog');
document.querySelectorAll('[data-lightbox]').forEach((link) => {
  link.addEventListener('click', (event) => {
    event.preventDefault();
    const image = document.querySelector('#image-full');
    image.src = link.href;
    image.alt = link.querySelector('img')?.alt || link.textContent.trim();
    document.querySelector('#image-title').textContent = image.alt;
    dialog.showModal();
  });
});
document.querySelector('#image-close')?.addEventListener('click', () => dialog.close());
dialog?.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
dialog?.addEventListener('close', () => { document.querySelector('#image-full').removeAttribute('src'); });

document.querySelectorAll('[data-dismiss]').forEach((button) => button.addEventListener('click', () => button.closest('.alert').remove()));
document.querySelectorAll('[data-back]').forEach((button) => button.addEventListener('click', () => { window.history.length > 1 ? window.history.back() : window.location.assign('index.php'); }));
document.querySelectorAll('form[data-confirm]').forEach((form) => {
  form.addEventListener('submit', (event) => { if (!window.confirm(form.dataset.confirm)) event.preventDefault(); });
});
document.querySelectorAll('form[data-saving]').forEach((form) => {
  form.addEventListener('submit', (event) => {
    if (form.dataset.submitting === 'true') {
      event.preventDefault();
      return;
    }
    form.dataset.submitting = 'true';
    form.querySelectorAll('button[type="submit"]').forEach((button) => { button.disabled = true; });
    document.querySelector('#loading-status').hidden = false;
  });
});
window.addEventListener('pageshow', () => {
  document.querySelector('#loading-status').hidden = true;
  document.querySelectorAll('form[data-saving]').forEach((form) => {
    form.dataset.submitting = 'false';
    form.querySelectorAll('button[type="submit"]').forEach((button) => { button.disabled = false; });
  });
});
