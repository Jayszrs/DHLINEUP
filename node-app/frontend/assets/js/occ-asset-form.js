for (const form of document.querySelectorAll('[data-occ-asset-form]')) {
 const input = form.querySelector('[data-occ-photo-files]');
 const previews = form.querySelector('[data-occ-photo-previews]');
 const status = form.querySelector('[data-occ-photo-status]');
 const error = form.querySelector('[data-occ-photo-error]');
 const submit = form.querySelector('button[type=submit]');
 const codes = form.elements.asset_code;
 const pending = JSON.parse(form.elements.photo_tickets.value || '[]').map(ticket => ({ticket}));
 const photos = [...pending];
 let saving = false;

 function showError(message) {
  error.textContent = message;
  error.hidden = false;
 }

 function syncFiles() {
  const transfer = new DataTransfer();
  for (const photo of photos) if (photo.file) transfer.items.add(photo.file);
  input.files = transfer.files;
  form.elements.photo_tickets.value = JSON.stringify(photos.filter(photo => photo.ticket).map(photo => photo.ticket));
 }

 function render() {
  previews.replaceChildren();
  for (const photo of photos) {
   const figure = document.createElement('figure');
   figure.className = 'occ-upload-photo';
   if (photo.file) {
    const image = document.createElement('img');
    image.src = photo.url;
    image.alt = 'Preview ' + photo.file.name;
    image.width = 240;
    image.height = 180;
    figure.append(image);
   }
   const caption = document.createElement('figcaption');
   const name = document.createElement('span');
   name.textContent = photo.file?.name || photo.ticket.name;
   const remove = document.createElement('button');
   remove.type = 'button';
   remove.className = 'subtle-button small';
   remove.textContent = 'Batalkan foto';
   remove.setAttribute('aria-label', 'Batalkan foto ' + name.textContent);
   remove.disabled = saving;
   remove.addEventListener('click', () => {
    if (photo.url) URL.revokeObjectURL(photo.url);
    photos.splice(photos.indexOf(photo), 1);
    syncFiles();
    render();
   });
   caption.append(name, remove);
   figure.append(caption);
   previews.append(figure);
  }
  status.textContent = photos.length ? photos.length + ' foto baru siap disimpan.' : 'Foto disimpan bersama inventory.';
 }

 function countCodes() {
  const unique = new Set(codes.value.split(/[\r\n;,]+/).map(code => code.trim().toLocaleUpperCase('id-ID')).filter(Boolean));
  form.querySelector('[data-occ-code-count]').textContent = unique.size ? unique.size + ' kode aset' : '';
 }

 input.addEventListener('change', () => {
  error.hidden = true;
  const selected = [...input.files];
  try {
   if (selected.length + photos.length > 20) throw Error('Maksimal 20 foto baru sekali simpan.');
   for (const file of selected) {
    if (!/\.(png|jpe?g|webp)$/i.test(file.name)) throw Error('Gunakan foto JPG, PNG, atau WebP.');
    if (!file.size || file.size > 5 * 1024 * 1024) throw Error(file.name + ' melebihi batas 5 MB atau kosong.');
   }
   for (const file of selected) photos.push({file, url: URL.createObjectURL(file)});
  } catch (failure) {
   showError(failure.message);
  }
  syncFiles();
  render();
 });

 codes.addEventListener('input', countCodes);
 form.addEventListener('submit', async event => {
  event.preventDefault();
  if (saving) return;
  saving = true;
  error.hidden = true;
  submit.disabled = true;
  input.disabled = true;
  previews.querySelectorAll('button').forEach(button => { button.disabled = true; });
  const removals = [...form.querySelectorAll('[data-occ-remove-photo]:checked')].map(checkbox => checkbox.value);
  form.elements.remove_photos.value = JSON.stringify(removals);
  try {
   if (document.body.dataset.uploadMode === 'signed') {
    for (const [index, photo] of photos.entries()) {
     if (photo.ticket) continue;
     const file = photo.file;
     status.textContent = 'Mengunggah foto ' + (index + 1) + ' dari ' + photos.length + '…';
     const response = await fetch('/upload-ticket', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({csrf: form.elements.csrf.value, kind: 'occ_photo', extension: file.name.split('.').at(-1).toLowerCase(), size: file.size})
     });
     const ticket = await response.json();
     if (!response.ok) throw Error(ticket.error || 'Unggah foto belum dapat disiapkan.');
     const sent = await fetch(ticket.signedUrl, {method: 'PUT', headers: {'Content-Type': file.type || 'application/octet-stream', 'x-upsert': 'false'}, body: file});
     if (!sent.ok) throw Error('Foto ' + file.name + ' belum berhasil diunggah. Coba simpan lagi.');
     photo.ticket = {id: ticket.id, name: file.name.slice(0, 200)};
    }
    form.elements.photo_tickets.value = JSON.stringify(photos.map(photo => photo.ticket));
   } else {
    syncFiles();
    input.disabled = false;
   }
   status.textContent = 'Menyimpan inventory dan foto…';
   HTMLFormElement.prototype.submit.call(form);
  } catch (failure) {
   saving = false;
   submit.disabled = false;
   input.disabled = false;
   render();
   showError(failure.message);
  }
 });

 window.addEventListener('pageshow', () => {
  saving = false;
  submit.disabled = false;
  input.disabled = false;
  render();
 });
 window.addEventListener('pagehide', event => {
  if (!event.persisted) for (const photo of photos) if (photo.url) URL.revokeObjectURL(photo.url);
 });
 countCodes();
 render();
}
