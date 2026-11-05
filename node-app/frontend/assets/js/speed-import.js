'use strict';
const file=document.querySelector('[data-speed-file]'),filename=document.querySelector('[data-speed-filename]');
file?.addEventListener('change',()=>{
 const selected=file.files[0];filename.value=selected?.name.slice(0,180)||'';
 file.setCustomValidity(selected&&selected.size>10*1024*1024?'File maksimal 10 MB. Pisahkan berdasarkan DT atau tanggal.':'');
 file.reportValidity();
});
