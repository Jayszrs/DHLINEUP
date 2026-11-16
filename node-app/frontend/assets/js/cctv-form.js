import {cameraNames, cameraKey, cameraMetrics} from './cctv-math.js';

for (const form of document.querySelectorAll('[data-cctv-form]')) {
 const initial = JSON.parse(form.querySelector('[data-cctv-existing]').textContent);
 const names = form.elements.camera_names;
 const total = form.elements.total_count;
 const site = form.elements.site;
 const date = form.elements.work_date;
 const remarks = form.elements.remarks;
 const rows = form.querySelector('[data-cctv-rows]');
 const known = form.querySelector('[data-cctv-known]');
 const error = form.querySelector('[data-cctv-error]');
 const progress = form.querySelector('[data-cctv-progress]');
 const context = form.querySelector('[data-cctv-context]');
 const submit = form.querySelector('[type=submit]');
 const drafts = new Map();
 let loaded = initial.row;
 let registry = initial.registry;
 let sourceLabel = initial.sourceLabel;
 let state = new Map();
 let existing = new Map((loaded.incidents || []).map(incident => [cameraKey(incident.name), incident]));
 let dirty = false;
 let saving = false;
 let loading = false;
 let requestNumber = 0;
 let pending = Promise.resolve(true);

 const keyOf = row => row.site + ':' + row.work_date;
 const selectedKey = () => site.value + ':' + date.value;
 const selectedDateLabel = () => new Intl.DateTimeFormat('id-ID', {day:'numeric',month:'long',year:'numeric'}).format(new Date(date.value + 'T12:00:00+07:00'));

 function options() {
  known.replaceChildren(new Option('Pilih CCTV', ''));
  for (const name of registry[site.value] || []) known.add(new Option(name, name));
 }

 function mediaUrl(media) {
  return '/cctv-media?' + new URLSearchParams({site:loaded.site,work_date:loaded.work_date,id:media.id});
 }

 function entry(name, index, carry) {
  const key = cameraKey(name);
  let value = state.get(key);
  if (value) {
   value.file.name = 'media_' + index;
   return value;
  }
  const old = existing.get(key);
  const root = document.createElement('div');
  root.className = 'cctv-entry';
  const title = document.createElement('span');
  title.className = 'entry-title';
  title.textContent = name;
  root.append(title);
  const numberInput = (labelText, max, number) => {
   const label = document.createElement('label');
   const field = document.createElement('input');
   label.append(document.createTextNode(labelText), field);
   field.type = 'number';
   field.min = 0;
   field.max = max;
   field.value = number;
   root.append(label);
   return field;
  };
  const hours = numberInput('Jam offline', 24, carry?.hours.value ?? (old?.duration_minutes == null ? '' : Math.floor(old.duration_minutes / 60)));
  const minutes = numberInput('Menit', 59, carry?.minutes.value ?? (old?.duration_minutes == null ? '' : old.duration_minutes % 60));
  const label = document.createElement('label');
  label.className = 'file-field';
  label.textContent = 'Bukti gambar / video';
  const file = document.createElement('input');
  file.type = 'file';
  file.multiple = true;
  file.accept = 'image/png,image/jpeg,image/webp,video/mp4,video/webm';
  file.name = 'media_' + index;
  if (carry) {
   const transfer = new DataTransfer();
   for (const selected of carry.file.files) transfer.items.add(selected);
   file.files = transfer.files;
  }
  label.append(file);
  root.append(label);
  const previews = document.createElement('div');
  previews.className = 'existing-media cctv-media';
  root.append(previews);
  const removed = [];
  for (const media of old?.media || []) {
   const label = document.createElement('label');
   const link = document.createElement('a');
   const check = document.createElement('input');
   link.href = mediaUrl(media);
   link.target = '_blank';
   link.rel = 'noopener';
   link.textContent = media.name || 'Bukti tersimpan';
   check.type = 'checkbox';
   check.addEventListener('change', () => {
    if (check.checked) removed.push(media.id);
    else removed.splice(removed.indexOf(media.id), 1);
   });
   label.append(link, document.createTextNode(' Hapus saat disimpan '), check);
   previews.append(label);
  }
  value = {key,name,root,hours,minutes,file,removed,tickets:[],uploaded:carry?.uploaded || new Map()};
  state.set(key, value);
  return value;
 }

 function render() {
  const unique = cameraNames(names.value);
  const metrics = cameraMetrics(Number(total.value), unique);
  rows.replaceChildren(...unique.map((name,index) => entry(name,index).root));
  form.querySelector('[data-live-total]').textContent = total.value || '—';
  form.querySelector('[data-live-down]').textContent = metrics.down;
  form.querySelector('[data-live-online]').textContent = metrics.online >= 0 ? metrics.online : '—';
  form.querySelector('[data-live-availability]').textContent = metrics.availability === null ? '—' : new Intl.NumberFormat('id-ID',{maximumFractionDigits:1}).format(metrics.availability) + '%';
  names.setCustomValidity(metrics.down > Number(total.value) ? 'Jumlah CCTV down melebihi total CCTV.' : '');
 }

 function setLoading(value) {
  loading = value;
  form.setAttribute('aria-busy', String(value));
  for (const control of form.querySelectorAll('input:not([type=hidden]), textarea, select')) {
   if (control !== site && control !== date) control.disabled = value;
  }
  submit.disabled = value || saving;
 }

 function capture() {
  return {loaded,sourceLabel,state,existing,dirty,names:names.value,total:total.value,remarks:remarks.value,recalculate:form.elements.confirm_recalculate.checked};
 }

 function applyDraft(draft) {
  loaded = draft.loaded;
  sourceLabel = draft.sourceLabel;
  state = draft.state;
  existing = draft.existing;
  dirty = draft.dirty;
  names.value = draft.names;
  total.value = draft.total;
  remarks.value = draft.remarks;
  form.elements.confirm_recalculate.checked = draft.recalculate;
  form.elements.original_site.value = loaded.site;
  form.elements.original_work_date.value = loaded.work_date;
  form.elements.version.value = loaded.version || 0;
  form.querySelector('[data-cctv-source]').hidden = loaded.source !== 'sheet';
  form.querySelector('[data-cctv-source-count]').textContent = (loaded.down_count || 0) + ' down · ' + sourceLabel;
  options();
  render();
 }

 async function loadSelection() {
  if (!date.checkValidity()) return false;
  const target = {site:site.value,work_date:date.value};
  if (keyOf(target) === keyOf(loaded) && !loading) return true;
  const current = capture();
  drafts.set(keyOf(loaded), current);
  const number = ++requestNumber;
  setLoading(true);
  error.hidden = true;
  context.textContent = 'Memuat laporan ' + selectedDateLabel() + '…';
  try {
   const response = await fetch('/cctv-report-data?' + new URLSearchParams(target), {headers:{Accept:'application/json'}});
   if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw Error('Laporan belum dapat dimuat. Periksa koneksi lalu klik Simpan untuk mencoba lagi.');
   const data = await response.json();
   if (number !== requestNumber) return false;
   registry = data.registry;
   let draft = drafts.get(keyOf(target));
   if (!draft) {
    const carry = !data.row.version && current.dirty && current.loaded.site === target.site;
    draft = {
     loaded:data.row,sourceLabel:data.sourceLabel,state:new Map(),
     existing:new Map((data.row.incidents || []).map(incident => [cameraKey(incident.name),incident])),
     dirty:carry,names:carry ? current.names : (data.row.incidents || []).map(incident => incident.name).join('\n'),
     total:carry ? current.total : data.row.total_count,remarks:carry ? current.remarks : data.row.remarks || '',recalculate:false
    };
    applyDraft(draft);
    if (carry) {
     for (const [index,name] of cameraNames(names.value).entries()) {
      const previous = current.state.get(cameraKey(name));
      if (previous) {
       state.delete(cameraKey(name));
       entry(name,index,previous);
      }
     }
    }
   } else applyDraft(draft);
   render();
   context.textContent = (loaded.version ? 'Laporan tersimpan' : 'Laporan baru') + ' · ' + selectedDateLabel() + '.';
   const url = new URL(location.href);
   url.searchParams.set('site', loaded.site);
   url.searchParams.set('work_date', loaded.work_date);
   history.replaceState(null, '', url);
   return true;
  } catch (failure) {
   if (number !== requestNumber) return false;
   error.textContent = failure.message;
   error.hidden = false;
   context.textContent = 'Laporan tanggal pilihan belum dimuat.';
   return false;
  } finally {
   if (number === requestNumber) setLoading(false);
  }
 }

 function selectionChanged() {
  if (!saving) pending = loadSelection();
 }

 known.addEventListener('change', () => {
  if (known.value) {
   names.value = (names.value.trim() + '\n' + known.value).trim();
   dirty = true;
   render();
   known.value = '';
  }
 });
 site.addEventListener('change', selectionChanged);
 date.addEventListener('change', selectionChanged);
 form.addEventListener('input', event => {
  if (event.target !== site && event.target !== date) dirty = true;
 });
 names.addEventListener('input', render);
 total.addEventListener('input', render);

 form.addEventListener('submit', async event => {
  event.preventDefault();
  if (saving) return;
  await pending;
  if (selectedKey() !== keyOf(loaded) && !await loadSelection()) return;
  if (!form.reportValidity()) return;
  if (saving) return;
  error.hidden = true;
  const values = cameraNames(names.value).map((name,index) => entry(name,index));
  const fileCount = values.reduce((count,value) => count + value.file.files.length,0);
  try {
   if (fileCount > 20) throw Error('Maksimal 20 file per laporan.');
   saving = true;
   form.inert = true;
   submit.disabled = true;
   for (const item of values) {
    item.tickets = [];
    if (Number(item.hours.value || 0) * 60 + Number(item.minutes.value || 0) > 1440) throw Error('Durasi offline maksimal 24 jam per CCTV per hari.');
    if (item.file.files.length > 4) throw Error('Maksimal empat bukti per CCTV.');
    for (const file of item.file.files) {
     const video = /\.(mp4|webm)$/i.test(file.name);
     if (file.size > (video ? 20 : 5) * 1024 * 1024) throw Error('Bukti melebihi batas ukuran.');
     if (document.body.dataset.uploadMode === 'signed') {
      if (item.uploaded.has(file)) {
       item.tickets.push(item.uploaded.get(file));
       continue;
      }
      progress.textContent = 'Mengunggah ' + file.name + '…';
      const response = await fetch('/upload-ticket', {
       method:'POST',headers:{'Content-Type':'application/json'},
       body:JSON.stringify({csrf:form.elements.csrf.value,kind:'cctv_media',extension:file.name.split('.').at(-1).toLowerCase(),size:file.size})
      });
      const ticket = await response.json();
      if (!response.ok) throw Error(ticket.error || 'Unggah belum siap.');
      const sent = await fetch(ticket.signedUrl,{method:'PUT',headers:{'Content-Type':file.type || 'application/octet-stream','x-upsert':'false'},body:file});
      if (!sent.ok) throw Error('Bukti belum berhasil diunggah.');
      item.tickets.push(ticket.id);
      item.uploaded.set(file,ticket.id);
     }
    }
   }
   form.elements.incident_details.value = JSON.stringify(values.map(value => ({
    key:value.key,duration_minutes:value.hours.value === '' && value.minutes.value === '' ? null : Number(value.hours.value || 0) * 60 + Number(value.minutes.value || 0),
    remove_media:value.removed,tickets:value.tickets
   })));
   if (document.body.dataset.uploadMode === 'signed') for (const item of values) item.file.disabled = true;
   progress.textContent = 'Menyimpan laporan…';
   HTMLFormElement.prototype.submit.call(form);
  } catch (failure) {
   saving = false;
   form.inert = false;
   submit.disabled = false;
   error.textContent = failure.message;
   error.hidden = false;
   progress.textContent = '';
  }
 });
 window.addEventListener('pageshow', () => {
  saving = false;
  form.inert = false;
  setLoading(false);
 });
 options();
 render();
}
