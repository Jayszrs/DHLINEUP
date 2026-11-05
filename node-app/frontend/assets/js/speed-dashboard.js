'use strict';
const comparison=document.querySelector('.speed-comparison');
if(comparison) {
  function selectMode(mode,announce=false) {
    if(!['overview','detail'].includes(mode))return;
    comparison.querySelectorAll('[data-comparison-view]').forEach(view=>{view.hidden=view.dataset.comparisonView!==mode;});
    comparison.querySelectorAll('[data-comparison-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.comparisonMode===mode)));
    const help=comparison.querySelector('[data-comparison-scroll-help]');if(help)help.hidden=mode!=='detail';
    if(announce)comparison.querySelector('[data-comparison-status]').textContent=mode==='detail'?'Grafik diperbesar. Geser mendatar untuk melihat semua unit.':'Grafik menampilkan seluruh unit dalam satu tampilan.';
    try{sessionStorage.setItem('dh-speed-comparison-view',mode);}catch{}
  }
  comparison.querySelectorAll('[data-comparison-mode]').forEach(button=>button.addEventListener('click',()=>selectMode(button.dataset.comparisonMode,true)));
  try{selectMode(sessionStorage.getItem('dh-speed-comparison-view')||(window.matchMedia('(max-width:700px)').matches?'detail':'overview'));}catch{}
}
