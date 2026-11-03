import initialData from '../data/lineup.json';
import type { District, LineUpEntry, Operator } from '../types';
const LINEUP_KEY='dh-fleetsync-lineup-v1';
const OPERATOR_KEY='dh-fleetsync-operators-v1';
export const districts: District[] = ['BCP','ACP','KCP','SSCP'];
export const originalLineups = initialData as LineUpEntry[];
export function getLineups(): LineUpEntry[] {
  try {const raw=localStorage.getItem(LINEUP_KEY); return raw?JSON.parse(raw):structuredClone(originalLineups);} catch {return structuredClone(originalLineups);}
}
export function saveLineups(items:LineUpEntry[]) {try {localStorage.setItem(LINEUP_KEY,JSON.stringify(items));} catch { alert('Penyimpanan browser penuh. Gunakan file bukti berukuran lebih kecil.');}}
export function getOperators(lineups:LineUpEntry[]):Operator[]{
  let extra:Operator[]=[]; try {extra=JSON.parse(localStorage.getItem(OPERATOR_KEY)||'[]')}catch{ /* ignore */ }
  const map=new Map<string,Operator>();
  for(const e of [...lineups].sort((a,b)=>a.date.localeCompare(b.date))){if(!e.nik)continue; map.set(e.site+'|'+e.nik,{id:e.site+'|'+e.nik,site:e.site,nik:e.nik,name:e.operator||'— Belum diisi',unit:e.unit,equipment:e.equipment,lastDate:e.date});}
  for(const o of extra){map.set(o.site+'|'+o.nik,o)}
  return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name,'id'));
}
export function saveOperators(items:Operator[]){try{localStorage.setItem(OPERATOR_KEY,JSON.stringify(items))}catch{alert('Penyimpanan lokal gagal.')}}
export function formatDate(s:string, style:'long'|'short'='long'){if(!s)return '—';const d=new Date(s+'T12:00:00'); if(Number.isNaN(d.getTime()))return s;return d.toLocaleDateString('id-ID',{day:'2-digit',month:style==='short'?'short':'long',year:style==='long'?'numeric':undefined});}
export function categoryFor(e:LineUpEntry){return e.typeCategory||'Belum diklasifikasi';}
export function statusOf(e:LineUpEntry){if(e.dh==='Ya'&&e.mine==='Ya'&&e.ftw==='Ya')return {name:'SESUAI',tone:'green'} as const;if(e.mine==='Belum dicek'||e.ftw==='Belum dicek')return {name:'BELUM DICEK',tone:'amber'} as const;return {name:'TINDAK LANJUT',tone:'red'} as const;}
export function downloadText(content:string,fileName:string,type='text/plain;charset=utf-8'){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=fileName;a.click();setTimeout(()=>URL.revokeObjectURL(url),500);}
