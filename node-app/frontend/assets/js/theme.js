'use strict';
try {
  document.documentElement.dataset.theme = localStorage.getItem('fleet-theme') === 'dark' ? 'dark' : 'light';
  if (localStorage.getItem('fleet-nav-collapsed') === 'true') document.documentElement.classList.add('nav-collapsed');
} catch (_) {}
