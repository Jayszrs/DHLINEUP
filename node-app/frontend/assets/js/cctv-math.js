export const CCTV_SITES=['ACP','KCP','BCP','BPP','HO','SSCP'];
export function cameraKey(name){return String(name||'').normalize('NFKC').toLocaleLowerCase('id-ID').replace(/[^\p{L}\p{N}]/gu,'');}
export function cameraNames(text){const seen=new Set();return String(text||'').split(/[\n;,]+/).map(v=>v.trim().replace(/\s+/g,' ')).filter(name=>{const key=cameraKey(name);if(!key||seen.has(key))return false;seen.add(key);return true;});}
export function cameraMetrics(total,names){const down=new Set(names.map(cameraKey).filter(Boolean)).size;return{total,down,online:total-down,availability:total>0&&down<=total?100*(total-down)/total:null};}
export function availabilityTone(value){return value===null||value===undefined?'muted':Number(value)<60?'red':'green';}
