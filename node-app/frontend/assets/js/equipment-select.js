'use strict';

document.querySelectorAll('[data-search-select]').forEach(field => {
  const input=field.querySelector('input'), fallback=field.querySelector('datalist');
  const toggle=field.querySelector('.catalog-toggle'), popup=field.querySelector('.catalog-popup');
  const list=field.querySelector('[role="listbox"]'), empty=field.querySelector('.catalog-empty');
  const add=field.querySelector('[data-catalog-add]'), feedback=field.querySelector('.catalog-feedback');
  const values=Array.from(fallback.options,option=>option.value);
  let matches=[], active=-1;
  input.removeAttribute('list'); fallback.remove(); toggle.hidden=false; if(add) add.hidden=false;
  input.setAttribute('role','combobox'); input.setAttribute('aria-autocomplete','list');
  input.setAttribute('aria-controls',list.id); input.setAttribute('aria-expanded','false');
  function close() {popup.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');active=-1;}
  function highlight(index) {
    active=index;
    Array.from(list.children).forEach((option,i)=>{option.setAttribute('aria-selected',String(i===active));if(i===active) {input.setAttribute('aria-activedescendant',option.id);option.scrollIntoView({block:'nearest'});}});
  }
  function choose(value) {input.value=value;close();input.dispatchEvent(new Event('change',{bubbles:true}));input.focus();close();}
  function open(all=false) {
    const search=all?'':input.value.trim().toLocaleLowerCase('id-ID');
    matches=values.filter(value=>value.toLocaleLowerCase('id-ID').includes(search));active=-1;list.replaceChildren();input.removeAttribute('aria-activedescendant');
    matches.forEach((value,i)=>{const option=document.createElement('div');option.id=list.id+'-'+i;option.setAttribute('role','option');option.setAttribute('aria-selected','false');option.textContent=value;
      option.addEventListener('mousedown',event=>event.preventDefault());option.addEventListener('click',()=>choose(value));list.append(option);});
    empty.hidden=matches.length>0;popup.hidden=false;input.setAttribute('aria-expanded','true');
  }
  input.addEventListener('focus',()=>open(true)); input.addEventListener('input',()=>{feedback.textContent='';open();});
  toggle.addEventListener('mousedown',event=>event.preventDefault());toggle.addEventListener('click',()=>{if(!popup.hidden) close();else {input.focus();open(true);}});
  input.addEventListener('keydown',event=>{
    if(event.isComposing) return;
    if(['ArrowDown','ArrowUp'].includes(event.key)) {event.preventDefault();if(popup.hidden) open(true);if(matches.length) highlight(event.key==='ArrowDown'?(active+1)%matches.length:(active<0?matches.length-1:(active-1+matches.length)%matches.length));}
    else if(event.key==='Enter'&&!popup.hidden) {event.preventDefault();if(active>=0) choose(matches[active]);else close();}
    else if(event.key==='Escape'&&!popup.hidden) {event.preventDefault();event.stopPropagation();close();}
    else if(event.key==='Tab') close();
  });
  field.addEventListener('focusout',event=>{if(!field.contains(event.relatedTarget)) close();});
  document.addEventListener('pointerdown',event=>{if(!field.contains(event.target)) close();});
  add?.addEventListener('click',async()=>{
    close();const value=input.value.trim().replace(/\s+/g,' ');
    if(!value) {feedback.textContent='Ketik '+field.querySelector('label').textContent.toLowerCase()+' yang ingin ditambahkan.';input.focus();return;}
    if(!input.reportValidity()) return;
    if(values.some(item=>item.toLocaleLowerCase('id-ID')===value.toLocaleLowerCase('id-ID'))) {feedback.textContent='Pilihan ini sudah ada di daftar.';return;}
    add.disabled=true;feedback.textContent='Menambahkan pilihan...';
    try {
      const response=await fetch('/equipment-option',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({csrf:input.form.elements.csrf.value,category:field.dataset.category,value})});
      if(response.redirected) throw new Error('Sesi berakhir. Masuk kembali sebelum menambahkan pilihan.');
      const result=await response.json();if(!response.ok) throw new Error(result.error||'Pilihan belum tersimpan. Coba lagi.');
      if(!values.includes(result.value)) values.push(result.value);values.sort((a,b)=>a.localeCompare(b,'id-ID',{numeric:true}));input.value=result.value;feedback.textContent='Pilihan ditambahkan ke daftar bersama.';
    } catch(error) {feedback.textContent=error.message||'Koneksi terputus. Coba lagi.';}
    finally {add.disabled=false;}
  });
});
