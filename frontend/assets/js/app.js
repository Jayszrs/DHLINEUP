'use strict';

const sidebar = document.querySelector('#sidebar');
const navToggle = document.querySelector('#nav-toggle');
const navBackdrop = document.querySelector('#nav-backdrop');
const mobileLayout = window.matchMedia('(max-width: 850px)');
function syncNavAccessibility() {
  if (sidebar) sidebar.inert = mobileLayout.matches && !sidebar.classList.contains('open');
}
function closeNav() {
  sidebar?.classList.remove('open');
  navToggle?.setAttribute('aria-expanded', 'false');
  if (navBackdrop) navBackdrop.hidden = true;
  syncNavAccessibility();
}
navToggle?.addEventListener('click', () => {
  const open = sidebar.classList.toggle('open');
  navToggle.setAttribute('aria-expanded', String(open));
  navBackdrop.hidden = !open;
  syncNavAccessibility();
  if (open) sidebar.querySelector('nav a')?.focus();
});
navBackdrop?.addEventListener('click', closeNav);
mobileLayout.addEventListener('change', closeNav);
syncNavAccessibility();
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && sidebar?.classList.contains('open')) {
    closeNav();
    navToggle?.focus();
  }
});

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
