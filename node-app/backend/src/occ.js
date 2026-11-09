import {createHash,randomBytes} from 'node:crypto';
import {one,audit} from './db.js';
import {HttpError,text,date,choice} from './validation.js';

export const OCC_SOURCE_ID='13EVeMvQt5TrdwfU73hur1wJ5ls8zSikf3AaBMQcpNb8';
export const OCC_SOURCE_URL='https://docs.google.com/spreadsheets/d/'+OCC_SOURCE_ID+'/edit';
export const OCC_SHEETS=['CCTV Availability','Inventory Availability','Inventory OCC'];
export const OCC_CCTV_SITES=['JHO','ACP','KCP','BCP','BPP'];
export const OCC_ITEMS=['T.MIC.01','T.MIC.02','T.MIC.03','T.MIC.04','T.MIC.05','T.MIC.06','T.MIC.07','T.MIC.08','T.MIC.09','T.MIC.10','W.MIC.01','W.MIC.02','W.MIC.03','W.MIC.04','Charger 01','Charger 02','Speaker','Crestron Deck','Videotron','Kandao Camera'];
export const OCC_STATUSES=['OK','Issue','Not Working','Rusak','Low Battery','Ganti Baterai','Maintenance','Charging','Not Checked','N/A'];
export const OCC_CCTV_STATUSES=['OK','Issue','Not Checked','N/A'];
export const OCC_ASSET_AVAILABILITY=['Available','Unavailable','Not Available','Maintenance','To Check'];
export const OCC_CONDITIONS=['Good','Issue','Not Working','Rusak','Maintenance','To Check','TBD'];
export const OCC_GROUPS=['','audio','display','workstation','camera','control'];
export function occAssetGroup(category){return category==='Audio'?'audio':['Display','Monitor'].includes(category)?'display':category==='PC Workstation'?'workstation':['CCTV','Camera'].includes(category)?'camera':'control';}
const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Jakarta'});
const value=x=>String(x??'').trim();
const stale=()=>new HttpError(409,'Data OCC sudah berubah. Buka ulang formulir sebelum menyimpan.');
const normalizeDay=day=>day instanceof Date?day.toISOString().slice(0,10):String(day);
export function occStatusTone(status){return ['OK','Good','Available'].includes(status)?'green':['Not Checked','To Check','TBD','N/A',''].includes(status)?'muted':['Low Battery','Ganti Baterai','Charging','Maintenance'].includes(status)?'amber':'red';}
export function occPhotoUrl(raw){
 const input=value(raw);if(!input)return '';
 try{const url=new URL(input);if(!['http:','https:'].includes(url.protocol)||url.username||url.password||input.length>2048)throw new Error();return url.href;}catch{throw new HttpError(422,'Tautan dokumentasi harus berupa URL HTTP atau HTTPS yang valid.');}
}
export function occSourceDate(raw){
 const input=value(raw);let day=input;
 const months={jan:1,feb:2,mar:3,apr:4,mei:5,may:5,jun:6,jul:7,agu:8,aug:8,sep:9,okt:10,oct:10,nov:11,des:12,dec:12};
 const match=input.match(/^(\d{1,2})[- /]([A-Za-z]{3})[- /](\d{4})$/);
 if(match&&months[match[2].toLowerCase()])day=`${match[3]}-${String(months[match[2].toLowerCase()]).padStart(2,'0')}-${match[1].padStart(2,'0')}`;
 if(typeof raw==='number'&&raw>0&&raw<100000)day=new Date(Date.UTC(1899,11,30)+Math.round(raw)*86400000).toISOString().slice(0,10);
 try{return date({day},'day');}catch{return null;}
}
function sourceLink(sheet,row,col,raw){
 const colName=String.fromCharCode(65+col),links=sheet.links||{};
 const candidate=links[`${colName}${row+1}`]||links[`${row+1}:${col+1}`]||links[row]?.[col];
 const link=typeof candidate==='object'?candidate?.url||candidate?.hyperlink:candidate;
 const direct=link||(/^https?:\/\//i.test(value(raw))?raw:'');
 if(!direct)return '';return occPhotoUrl(direct);
}
export function parseOccSource(input){
 if(!input||typeof input.sheets!=='object')throw new HttpError(422,'Paket sumber OCC tidak valid.');
 if(input.spreadsheetId&&input.spreadsheetId!==OCC_SOURCE_ID)throw new HttpError(422,'Spreadsheet sumber OCC tidak sesuai.');
 const assets=[],checks=[];
 for(const name of OCC_SHEETS){
  const sheet=input.sheets[name];if(!Array.isArray(sheet?.values))throw new HttpError(422,'Sheet sumber wajib tersedia: '+name);
  const rows=sheet.values,header=rows[4]||[];
  if(name==='Inventory OCC'){
   if(value(header[2])!=='Inventory / Asset'||value(header[3])!=='Asset / Setup Code')throw new HttpError(422,'Header Inventory OCC tidak sesuai.');
   for(const [index,row]of rows.entries()){
    if(index<5||!/^\d+$/.test(value(row[0]))||!value(row[2]))continue;
    const rawQty=value(row[4]);const qty=/^\d+$/.test(rawQty)?Number(rawQty):null;
    if(qty!==null&&!Number.isSafeInteger(qty))throw new HttpError(422,'Jumlah inventory tidak valid pada baris '+(index+1));
    const id='occ-src-'+createHash('sha256').update(OCC_SOURCE_ID+':Inventory OCC:'+(index+1)).digest('hex').slice(0,24);
    assets.push({id,category:value(row[1]),name:value(row[2]),asset_code:value(row[3]),qty,brand:value(row[5]),model:value(row[6]),specifications:value(row[7]),related_device:value(row[8]),placement:value(row[9]),availability:value(row[10])||'To Check',condition:value(row[11])||'To Check',photo_url:sourceLink(sheet,index,13,row[13])||sourceLink(sheet,index,12,row[12]),photo_label:[value(row[12]),value(row[13])].filter(Boolean).join(' / '),notes:value(row[14]),source_row:index+1,source:'Google Sheets OCC'});
   }
  }else{
   if(value(header[1])!=='Date')throw new HttpError(422,'Header tanggal sumber tidak sesuai: '+name);
   const keys=name==='CCTV Availability'?OCC_CCTV_SITES:OCC_ITEMS,columns=keys.map(key=>header.indexOf(name==='CCTV Availability'?'CCTV '+key:key));
   if(columns.some(i=>i<0))throw new HttpError(422,'Kolom status sumber belum lengkap: '+name);
   const notesIndex=header.indexOf('Notes');
   for(const [index,row]of rows.entries()){
    if(index<5||!/^\d+$/.test(value(row[0])))continue;
    const work_date=occSourceDate(row[1]);if(!work_date)continue;
    const statuses={};for(const [position,key]of keys.entries()){
     const status=value(row[columns[position]])||'Not Checked';
     if(!OCC_STATUSES.includes(status))throw new HttpError(422,'Status sumber belum dikenal pada '+name+' baris '+(index+1)+': '+status);
     statuses[key]=status;
    }
    checks.push({kind:name==='CCTV Availability'?'cctv':'availability',work_date,statuses,notes:notesIndex>=0?value(row[notesIndex]):'',source_row:index+1,source:'Google Sheets OCC'});
   }
  }
 }
 const identities=new Set();for(const row of checks){const key=row.kind+':'+row.work_date;if(identities.has(key))throw new HttpError(422,'Tanggal sumber duplikat: '+key);identities.add(key);}
 return{source:OCC_SOURCE_ID,revision:createHash('sha256').update(JSON.stringify({assets,checks})).digest('hex'),assets,checks};
}
export function occStatusSummary(statuses={},keys=Object.keys(statuses)){
 const output={total:keys.length,ok:0,issue:0,unchecked:0,not_applicable:0};
 for(const key of keys){const status=statuses[key]||'Not Checked';if(status==='OK')output.ok++;else if(status==='N/A')output.not_applicable++;else if(status==='Not Checked')output.unchecked++;else output.issue++;}
 output.checked=output.ok+output.issue;const relevant=output.total-output.not_applicable;
 output.availability_percent=output.checked?100*output.ok/output.checked:null;
 output.completion_percent=relevant?100*output.checked/relevant:null;
 return output;
}
export function occFilters(input={}){const from=date(input,'from',false)||'',to=date(input,'to',false)||'';if(from&&to&&from>to)throw new HttpError(422,'Tanggal awal harus sebelum tanggal akhir.');return{work_date:date(input,'work_date',false)||'',from,to,search:text(input,'search',200),group:choice(input,'group',OCC_GROUPS,'')};}
const assetFields={category:120,name:200,asset_code:120,brand:150,model:150,specifications:10000,related_device:300,placement:200,photo_label:200,notes:10000};
export const blankOccAsset=()=>({id:'',version:0,category:'',name:'',asset_code:'',qty:'',brand:'',model:'',specifications:'',related_device:'',placement:'OCC JHO',availability:'To Check',condition:'To Check',photo_url:'',photo_label:'',notes:''});
export class OccRepository{
 constructor(db,actor=null){this.db=db;this.actor=actor;}
 async asset(id){const row=await one(this.db,'SELECT * FROM fleetsync.occ_assets WHERE id=$1',[id]);if(!row)throw new HttpError(404,'Inventory OCC tidak ditemukan.');return row;}
 async check(kind,day){const row=await one(this.db,'SELECT * FROM fleetsync.occ_checks WHERE kind=$1 AND work_date=$2',[kind,day]);return row?{...row,work_date:normalizeDay(row.work_date)}:null;}
 async importSource(input){
  const source=parseOccSource(input);
  return this.db.transaction(async tx=>{
   await tx.query("SELECT setting_value FROM fleetsync.app_settings WHERE setting_key='bootstrap' FOR UPDATE");
   const old=await one(tx,"SELECT setting_value FROM fleetsync.app_settings WHERE setting_key='occ_source_revision'");if(old?.setting_value===source.revision)return{already:true,revision:source.revision,assets:0,checks:0};
   let assets=0,checks=0;
   for(const row of source.assets){const names=Object.keys(row),saved=await tx.query(`INSERT INTO fleetsync.occ_assets(${names.join(',')}) VALUES(${names.map((_,i)=>'$'+(i+1)).join(',')}) ON CONFLICT DO NOTHING RETURNING id`,names.map(k=>row[k]));assets+=saved.rows.length;}
   for(const row of source.checks){const saved=await tx.query('INSERT INTO fleetsync.occ_checks(kind,work_date,statuses,notes,source_row,source) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING RETURNING kind',[row.kind,row.work_date,JSON.stringify(row.statuses),row.notes,row.source_row,row.source]);checks+=saved.rows.length;}
   await tx.query("INSERT INTO fleetsync.app_settings(setting_key,setting_value) VALUES('occ_source_revision',$1) ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value",[source.revision]);
   await tx.query("INSERT INTO fleetsync.app_settings(setting_key,setting_value) VALUES('occ_source_imported_at',$1) ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value",[new Date().toISOString()]);
   await audit(tx,this.actor,'import','occ-source',source.revision,{assets,checks,sheets:OCC_SHEETS,source:OCC_SOURCE_ID});return{already:false,revision:source.revision,assets,checks};
  });
 }
 async data(filters={}){
  const [assets,rawChecks]=await Promise.all([this.db.query('SELECT * FROM fleetsync.occ_assets ORDER BY source_row NULLS LAST,category,name,id'),this.db.query('SELECT * FROM fleetsync.occ_checks ORDER BY work_date,kind')]);
  const checks=rawChecks.rows.map(r=>({...r,work_date:normalizeDay(r.work_date)})),dates=checks.map(r=>r.work_date).filter(d=>d<=today()).sort(),reference=filters.work_date||dates.at(-1)||today();
  const cctv=checks.filter(r=>r.kind==='cctv'),availability=checks.filter(r=>r.kind==='availability'),selectedCctv=cctv.find(r=>r.work_date===reference)||null,selectedInventory=availability.find(r=>r.work_date===reference)||null;
  const daily_inventory=occStatusSummary(selectedInventory?.statuses,OCC_ITEMS),daily_cctv=occStatusSummary(selectedCctv?.statuses,OCC_CCTV_SITES);
  const latestChecked=checks.filter(r=>r.work_date<=today()&&occStatusSummary(r.statuses).checked>0).map(r=>r.work_date).sort().at(-1)||null;
  const assetAvailable=assets.rows.filter(r=>r.availability==='Available').length,assetUnchecked=assets.rows.filter(r=>['To Check','TBD','Not Checked',''].includes(r.availability)).length;
  const summary={work_date:reference,reference_date:reference,latest_checked_date:latestChecked,asset_records:assets.rows.length,known_units:assets.rows.reduce((n,r)=>n+Number(r.qty||0),0),unknown_quantity:assets.rows.filter(r=>r.qty===null).length,asset_available_records:assetAvailable,asset_issue_records:assets.rows.length-assetAvailable-assetUnchecked,asset_unchecked_records:assetUnchecked,asset_availability_percent:assets.rows.length>assetUnchecked?100*assetAvailable/(assets.rows.length-assetUnchecked):null,daily_inventory,daily_cctv,cctv_jho_status:selectedCctv?.statuses?.JHO||'Not Checked'};
  const search=String(filters.search||'').toLowerCase(),inDates=row=>(!filters.work_date||row.work_date===filters.work_date)&&(!filters.from||row.work_date>=filters.from)&&(!filters.to||row.work_date<=filters.to);
  const matchesCheck=row=>inDates(row)&&(!search||[row.work_date,row.notes,...Object.entries(row.statuses).flat()].join(' ').toLowerCase().includes(search));
  return{assets:assets.rows.filter(r=>(!filters.group||occAssetGroup(r.category)===filters.group)&&(!search||[r.name,r.category,r.asset_code,r.brand,r.model,r.placement].join(' ').toLowerCase().includes(search))),allAssets:assets.rows,cctv:cctv.filter(matchesCheck),availability:availability.filter(matchesCheck),selectedCctv,selectedInventory,summary};
 }
 async saveAsset(input){
  const id=text(input,'id',80),version=Number(text(input,'version',12)||0);if(!Number.isSafeInteger(version)||version<0||version>2147483647)throw new HttpError(422,'Versi inventory tidak valid.');
  const row={};for(const [key,max]of Object.entries(assetFields))row[key]=text(input,key,max,['category','name'].includes(key));
  const rawQty=text(input,'qty',9);if(rawQty&&!/^\d+$/.test(rawQty))throw new HttpError(422,'Jumlah unit harus bilangan bulat positif atau kosong jika belum diketahui.');row.qty=rawQty?Number(rawQty):null;
  row.availability=choice(input,'availability',OCC_ASSET_AVAILABILITY,'To Check');row.condition=choice(input,'condition',OCC_CONDITIONS,'To Check');row.photo_url=occPhotoUrl(text(input,'photo_url',2048));
  const savedId=id||'occ-'+randomBytes(16).toString('hex');
  await this.db.transaction(async tx=>{const keys=Object.keys(row),values=keys.map(k=>row[k]);let saved;if(id){if(version<1)throw stale();saved=await tx.query(`UPDATE fleetsync.occ_assets SET ${keys.map((k,i)=>`${k}=$${i+1}`).join(',')},version=version+1,updated_at=now() WHERE id=$${keys.length+1} AND version=$${keys.length+2} RETURNING id`,[...values,id,version]);}else{if(version!==0)throw stale();saved=await tx.query(`INSERT INTO fleetsync.occ_assets(id,${keys.join(',')}) VALUES($1,${keys.map((_,i)=>'$'+(i+2)).join(',')}) RETURNING id`,[savedId,...values]);}if(!saved.rows.length)throw stale();await audit(tx,this.actor,id?'update':'create','occ-asset',savedId,row);});return savedId;
 }
 async saveCheck(kind,input){
  if(!['cctv','availability'].includes(kind))throw new HttpError(422,'Jenis pengecekan tidak valid.');const work_date=date(input,'work_date'),version=Number(text(input,'version',12)||0);if(!Number.isSafeInteger(version)||version<0||version>2147483647)throw new HttpError(422,'Versi pengecekan tidak valid.');
  const keys=kind==='cctv'?OCC_CCTV_SITES:OCC_ITEMS,statuses={};for(const [index,key]of keys.entries())statuses[key]=choice(input,'status_'+index,kind==='cctv'?OCC_CCTV_STATUSES:OCC_STATUSES);
  const notes=text(input,'notes',10000);
  await this.db.transaction(async tx=>{const saved=version?await tx.query('UPDATE fleetsync.occ_checks SET statuses=$1,notes=$2,version=version+1,updated_at=now() WHERE kind=$3 AND work_date=$4 AND version=$5 RETURNING kind',[JSON.stringify(statuses),notes,kind,work_date,version]):await tx.query('INSERT INTO fleetsync.occ_checks(kind,work_date,statuses,notes) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING kind',[kind,work_date,JSON.stringify(statuses),notes]);if(!saved.rows.length)throw stale();await audit(tx,this.actor,'save','occ-check',kind+':'+work_date,{statuses,notes});});return work_date;
 }
}
