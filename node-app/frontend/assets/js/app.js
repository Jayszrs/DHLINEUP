'use strict';

const autoFilters=document.querySelector('form[data-auto-filter]');
if(autoFilters) {
  let filterTimer;
  const announce=document.createElement('span');announce.className='sr-only';announce.setAttribute('role','status');autoFilters.append(announce);
  for(const input of autoFilters.querySelectorAll('select[name="site"],input[name="work_date"],select[name="shift"],select[name="type_category"]')) {
    input.addEventListener('change',()=>{
      clearTimeout(filterTimer);
      filterTimer=setTimeout(()=>{if(autoFilters.checkValidity()) autoFilters.requestSubmit(autoFilters.querySelector('.show-button'));},180);
    });
  }
  autoFilters.addEventListener('submit',event=>{
    clearTimeout(filterTimer);
    if(autoFilters.dataset.filterSubmitting==='true') {event.preventDefault();return;}
    autoFilters.dataset.filterSubmitting='true';autoFilters.setAttribute('aria-busy','true');announce.textContent='Memuat hasil filter...';
  });
  window.addEventListener('pageshow',()=>{autoFilters.dataset.filterSubmitting='false';autoFilters.removeAttribute('aria-busy');announce.textContent='';});
}

const retryNotice = document.querySelector('[data-retry-after]');
if (retryNotice) {
  const deadline = Date.now() + Number(retryNotice.dataset.retryAfter) * 1000;
  const submit = document.querySelector('.auth-form button[type="submit"]');
  if (submit) submit.disabled = true;
  const timer = setInterval(() => {
    const seconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    if (seconds) retryNotice.querySelector('[data-retry-count]').textContent = String(seconds);
    else {
      clearInterval(timer);
      retryNotice.textContent = 'Silakan coba lagi sekarang.';
      retryNotice.setAttribute('role', 'status');
      if (submit) submit.disabled = false;
    }
  }, 1000);
}

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
document.addEventListener('click', (event) => {
    const link = event.target.closest('a[data-lightbox]');
    if (!link) return;
    event.preventDefault();
    const image = new Image();
    image.id = 'image-full';
    image.src = link.href;
    image.alt = link.querySelector('img')?.alt || link.textContent.trim();
    document.querySelector('#image-slot').replaceChildren(image);
    document.querySelector('#image-title').textContent = image.alt;
    dialog.showModal();
});
document.querySelector('#image-close')?.addEventListener('click', () => dialog.close());
dialog?.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
dialog?.addEventListener('close', () => { document.querySelector('#image-slot').replaceChildren(); });

document.querySelectorAll('[data-evidence-upload]').forEach((field) => {
  const input = field.querySelector('[data-evidence-file]'), preview = field.querySelector('[data-evidence-preview]');
  const status = field.querySelector('[data-evidence-status]'), clear = field.querySelector('[data-evidence-clear]');
  const remove = field.querySelector('[data-evidence-remove]'), label = field.dataset.label;
  const noun=field.dataset.noun||'Bukti',maxBytes=Number(field.dataset.maxBytes)||5*1024*1024;
  let objectUrl = '';
  const release = () => { if (objectUrl) URL.revokeObjectURL(objectUrl);objectUrl = ''; };
  const showImage = (source, pending) => {
    const link = document.createElement('a'), image = new Image();
    link.href = source;link.dataset.lightbox = '';link.setAttribute('aria-label', `Perbesar ${label}`);
    image.alt = `Preview ${label}${pending ? ' yang akan diunggah' : ' yang tersimpan'}`;
    if (pending) {
      image.onload = () => { image.dataset.previewReady = 'true'; };
      image.onerror = () => { if (objectUrl === source) rejectFile('Gambar tidak dapat dibaca. Pilih PNG, JPG, atau WebP yang valid.'); };
    }
    image.src = source;link.append(image);preview.replaceChildren(link);preview.hidden = false;
  };
  const savedState = () => {
    const existing = field.dataset.currentUrl;
    if (existing && !remove?.checked) showImage(existing, false);
    else { preview.replaceChildren();preview.hidden = true; }
    status.classList.remove('error');
    status.textContent = remove?.checked ? `${noun} tersimpan akan dihapus ketika perubahan disimpan.` : existing ? `${noun} tersimpan. Pilih gambar baru untuk menggantinya.` : 'Pilih gambar untuk melihat preview sebelum disimpan.';
  };
  const rejectFile = (message) => {
    release();input.value = '';savedState();input.setCustomValidity(message);
    status.textContent = message;status.classList.add('error');clear.hidden = false;
  };
  input.addEventListener('change', () => {
    release();input.setCustomValidity('');
    const file = input.files[0];
    if (!file) { savedState();clear.hidden = true;return; }
    if (file.size > maxBytes) { rejectFile(`Ukuran gambar maksimal ${maxBytes/1024/1024} MB. Pilih gambar lain atau batalkan pilihan.`);return; }
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) && !(file.type === '' && /\.(png|jpe?g|webp)$/i.test(file.name))) {
      rejectFile('Gunakan gambar PNG, JPG, atau WebP. Pilih file lain atau batalkan pilihan.');return;
    }
    if (remove) remove.checked = false;
    objectUrl = URL.createObjectURL(file);showImage(objectUrl, true);
    status.classList.remove('error');status.textContent = `${file.name} · ${Math.max(1, Math.round(file.size / 1024))} KB · Belum disimpan`;
    clear.hidden = false;
  });
  clear.addEventListener('click', () => {
    if (input.form.dataset.submitting === 'true') return;
    release();input.value = '';input.setCustomValidity('');clear.hidden = true;savedState();
  });
  remove?.addEventListener('change', () => {
    release();input.value = '';input.setCustomValidity('');clear.hidden = true;savedState();
  });
  window.addEventListener('pagehide', (event) => { if (!event.persisted) release(); });
});

document.querySelectorAll('[data-dismiss]').forEach((button) => button.addEventListener('click', () => button.closest('.alert').remove()));
document.querySelectorAll('[data-back]').forEach((button) => button.addEventListener('click', () => { window.history.length > 1 ? window.history.back() : window.location.assign('/lineup'); }));
document.querySelectorAll('form[data-confirm]').forEach((form) => {
  form.addEventListener('submit', (event) => { if (!window.confirm(form.dataset.confirm)) event.preventDefault(); });
});
document.querySelectorAll('form[data-saving]').forEach((form) => {
  form.addEventListener('submit', async (event) => {
    if (form.dataset.submitting === 'true') {
      event.preventDefault();
      return;
    }
    form.dataset.submitting = 'true';
    form.querySelectorAll('button[type="submit"]').forEach((button) => { button.disabled = true; });
    document.querySelector('#loading-status').hidden = false;
    const inputs = [...form.querySelectorAll('input[type="file"]')].filter(input => input.files.length);
    if (document.body.dataset.uploadMode === 'signed' && inputs.length) {
      event.preventDefault();
      form.querySelectorAll('[data-evidence-remove]:checked').forEach(input => {
        const field = document.createElement('input');field.type = 'hidden';field.name = input.name;field.value = input.value;field.dataset.uploadTicket = 'true';form.append(field);
      });
      form.querySelectorAll('input[type="file"], [data-evidence-control]').forEach(input => { input.disabled = true; });
      const loading = document.querySelector('#loading-status');
      try {
        for (const input of inputs) {
          const file = input.files[0];
          loading.textContent = `Mengunggah ${file.name}. Mohon tunggu...`;
          const response = await fetch('/upload-ticket', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ csrf: form.elements.csrf.value, kind: input.name, extension: file.name.split('.').pop().toLowerCase(), size: file.size }),
          });
          const ticket = await response.json();
          if (!response.ok) throw new Error(ticket.error || 'Unggahan belum dapat disiapkan.');
          const uploaded = await fetch(ticket.signedUrl, { method: 'PUT', headers: { 'Content-Type': file.type || 'application/octet-stream', 'x-upsert': 'false' }, body: file });
          if (!uploaded.ok) throw new Error('Unggah file gagal. Periksa koneksi dan coba lagi.');
          const field = document.createElement('input');
          field.type = 'hidden'; field.name = input.name + '_ticket'; field.value = ticket.id; field.dataset.uploadTicket = 'true';
          form.append(field); input.disabled = true;
        }
        loading.textContent = 'Menyimpan perubahan. Mohon tunggu...';
        HTMLFormElement.prototype.submit.call(form);
      } catch (error) {
        form.dataset.submitting = 'false';
        form.querySelectorAll('button[type="submit"], input[type="file"], [data-evidence-control]').forEach(input => { input.disabled = false; });
        form.querySelectorAll('[data-upload-ticket]').forEach(input => input.remove());
        loading.hidden = true;
        const alert = document.createElement('div'); alert.className = 'alert error'; alert.setAttribute('role', 'alert'); alert.textContent = error.message;
        form.prepend(alert); alert.scrollIntoView({ block: 'center' });
      }
    }
  });
});
window.addEventListener('pageshow', () => {
  document.querySelector('#loading-status').hidden = true;
  document.querySelectorAll('form[data-saving]').forEach((form) => {
    form.dataset.submitting = 'false';
    form.querySelectorAll('button[type="submit"]').forEach((button) => { button.disabled = false; });
    form.querySelectorAll('input[type="file"]').forEach(input => { input.disabled = false; });
    form.querySelectorAll('[data-evidence-control]').forEach(input => { input.disabled = false; });
    form.querySelectorAll('[data-upload-ticket]').forEach(input => input.remove());
  });
});
