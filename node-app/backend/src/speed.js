import {gunzipSync} from 'node:zlib';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {one,audit} from './db.js';
import {HttpError,text,date} from './validation.js';

export const speedNumber=(value,digits=2)=>value===null||value===undefined?'—':new Intl.NumberFormat('id-ID',{minimumFractionDigits:digits,maximumFractionDigits:digits}).format(Number(value));
export function speedUnit(input,required=false) {const value=text(input,'unit',60,required).toUpperCase();if(value&&!/^DT\d{1,8}$/.test(value))throw new HttpError(422,'Nomor unit harus berupa DT diikuti angka.');return value;}
export function speedFilters(input) {
  const from=date(input,'from',false)||'',to=date(input,'to',false)||'',unit=speedUnit(input),search=text(input,'search',100);
  if(from&&to&&from>to)throw new HttpError(422,'Tanggal awal harus sebelum tanggal akhir.');
  return {from,to,unit,search};
}
function where(filters={},alias='d') {
  const terms=[],values=[];
  for(const [key,op] of [['from','>='],['to','<=']])if(filters[key]){values.push(filters[key]);terms.push(`${alias}.work_date${op}$${values.length}`);}
  if(filters.unit){values.push(filters.unit);terms.push(`${alias}.unit=$${values.length}`);}
  if(filters.search){values.push(`%${filters.search}%`);terms.push(`${alias}.unit ILIKE $${values.length}`);}
  return {sql:terms.length?'WHERE '+terms.join(' AND '):'',values};
}
const metrics="sum(d.total_count)::bigint AS total_count,sum(d.moving_count)::bigint AS moving_count,sum(d.speed_sum)::numeric AS speed_sum,max(d.max_speed)::numeric AS max_speed,count(DISTINCT CASE WHEN d.total_count>0 THEN d.unit END)::int AS active_units";
export const withAverages=row=>({...row,total_count:Number(row.total_count||0),moving_count:Number(row.moving_count||0),speed_sum:Number(row.speed_sum||0),max_speed:row.max_speed===null?null:Number(row.max_speed),stopped_count:Number(row.total_count||0)-Number(row.moving_count||0),average:Number(row.total_count)>0?Number(row.speed_sum)/Number(row.total_count):null,moving_average:Number(row.moving_count)>0?Number(row.speed_sum)/Number(row.moving_count):null,moving_ratio:Number(row.total_count)>0?100*Number(row.moving_count)/Number(row.total_count):null});
export class SpeedFiles {
  constructor(storage){this.storage=storage;this.cache=new Map();}
  valid(name){if(!/^speed\/[a-f0-9]{64}\/[0-9]+\.json\.gz$/.test(name))throw new HttpError(404,'Data sumber speed tidak ditemukan.');return name;}
  async put(name,bytes){this.valid(name);const s=this.storage;if(s.client){const {error}=await s.client.storage.from(s.bucket).upload(name,bytes,{contentType:'application/gzip',upsert:true});if(error)throw new HttpError(503,'Arsip speed belum berhasil diunggah.');}else{const file=path.join(s.directory,name);await mkdir(path.dirname(file),{recursive:true});await writeFile(file,bytes);}}
  async rows(name){this.valid(name);if(this.cache.has(name))return this.cache.get(name);const s=this.storage;let bytes;if(s.client){const{data,error}=await s.client.storage.from(s.bucket).download(name);if(error)throw new HttpError(503,'Pembacaan GPS belum dapat dimuat. Coba lagi.');bytes=Buffer.from(await data.arrayBuffer());}else bytes=await readFile(path.join(s.directory,name));
    const data=JSON.parse(gunzipSync(bytes,{maxOutputLength:64*1024*1024}).toString('utf8'));if(!Array.isArray(data.rows))throw new HttpError(503,'Arsip speed tidak valid.');if(this.cache.size>=2)this.cache.delete(this.cache.keys().next().value);this.cache.set(name,data);return data;
  }
}
export class SpeedRepository {
 constructor(db,actor){this.db=db;this.actor=actor;}
 async summary(filters={}){const w=where(filters);return withAverages(await one(this.db,`SELECT ${metrics} FROM fleetsync.speed_daily d ${w.sql}`,w.values));}
 async daily(filters={}){const w=where(filters);return(await this.db.query(`SELECT d.work_date,${metrics} FROM fleetsync.speed_daily d ${w.sql} GROUP BY d.work_date ORDER BY d.work_date`,w.values)).rows.map(withAverages);}
 async monthly(filters={}){const w=where(filters);const rows=(await this.db.query(`SELECT to_char(d.work_date,'YYYY-MM') AS month,${metrics} FROM fleetsync.speed_daily d ${w.sql} GROUP BY to_char(d.work_date,'YYYY-MM') ORDER BY month`,w.values)).rows.map(withAverages);const setting=await one(this.db,"SELECT setting_value FROM fleetsync.app_settings WHERE setting_key='speed_periods'");let periods=[];try{periods=JSON.parse(setting?.setting_value||'[]');}catch{}for(const month of periods)if(!rows.some(r=>r.month===month)&&(!filters.from||month>=filters.from.slice(0,7))&&(!filters.to||month<=filters.to.slice(0,7)))rows.push(withAverages({month,max_speed:null}));return rows.sort((a,b)=>a.month.localeCompare(b.month));}
 async units(filters={}){const w=where(filters),values=[...w.values,`%${filters.search||''}%`];return(await this.db.query(`SELECT u.*,s.total_count,s.moving_count,s.speed_sum,s.max_speed,s.first_date,s.last_date FROM fleetsync.speed_units u LEFT JOIN (SELECT d.unit,${metrics},min(d.work_date) AS first_date,max(d.work_date) AS last_date FROM fleetsync.speed_daily d ${w.sql} GROUP BY d.unit) s ON s.unit=u.unit WHERE u.unit ILIKE $${values.length} ORDER BY u.unit`,values)).rows.map(withAverages);}
 async unit(unit){const row=await one(this.db,'SELECT * FROM fleetsync.speed_units WHERE unit=$1',[unit]);if(!row)throw new HttpError(404,'Unit speed tidak ditemukan.');return row;}
 async records(unit,filters,files,page=1){const row=await this.unit(unit);if(!row.raw_path)return{headers:[],rows:[],total:0,page:1,pages:1};const source=await files.rows(row.raw_path);let rows=source.rows.slice(1).filter(r=>r[0]&&r[5]&&/^\d{4}-\d{2}-\d{2}/.test(r[5]));if(filters.from)rows=rows.filter(r=>r[5].slice(0,10)>=filters.from);if(filters.to)rows=rows.filter(r=>r[5].slice(0,10)<=filters.to);const total=rows.length,pages=Math.max(1,Math.ceil(total/100));page=Math.min(page,pages);return{headers:source.rows[0].slice(0,source.rows[0].indexOf('Tanggal GPS')+1||15),rows:rows.slice((page-1)*100,page*100).map(r=>r.slice(0,source.rows[0].indexOf('Tanggal GPS')+1||15)),total,page,pages};}
 async record(unit,day){return await one(this.db,'SELECT * FROM fleetsync.speed_daily WHERE unit=$1 AND work_date=$2',[unit,day]);}
 async save(input){const unit=speedUnit(input,true),work_date=date(input,'work_date');const values={};for(const key of ['total_count','moving_count','speed_sum','max_speed']){const raw=text(input,key,24,true);if(!/^\d+(\.\d{1,4})?$/.test(raw))throw new HttpError(422,'Isian rekap harus berupa angka positif; gunakan titik untuk desimal.');values[key]=Number(raw);if(!Number.isFinite(values[key]))throw new HttpError(422,'Angka rekap tidak valid.');}
 if(!Number.isInteger(values.total_count)||!Number.isInteger(values.moving_count)||values.total_count>100000000||values.moving_count>values.total_count||values.max_speed>500||values.speed_sum>values.max_speed*values.moving_count+0.0001||(values.moving_count>0&&(values.speed_sum<=0||values.max_speed<=0||values.speed_sum+0.0001<values.max_speed))||(values.moving_count===0&&values.max_speed!==0)||(values.moving_count===0&&values.speed_sum!==0))throw new HttpError(422,'Periksa catatan, bergerak, jumlah speed, dan speed tertinggi. Nilainya belum sesuai.');
 const version=Number(text(input,'version',12)||0);if(!Number.isSafeInteger(version)||version<0)throw new HttpError(422,'Versi rekap tidak valid.');
 await this.db.transaction(async tx=>{await tx.query('INSERT INTO fleetsync.speed_units(unit) VALUES($1) ON CONFLICT DO NOTHING',[unit]);let saved;
 if(version>0)saved=await tx.query('UPDATE fleetsync.speed_daily SET total_count=$1,moving_count=$2,speed_sum=$3,max_speed=$4,source=$5,version=version+1,updated_at=now() WHERE unit=$6 AND work_date=$7 AND version=$8 RETURNING unit',[values.total_count,values.moving_count,values.speed_sum,values.max_speed,'manual',unit,work_date,version]);else saved=await tx.query('INSERT INTO fleetsync.speed_daily(unit,work_date,total_count,moving_count,speed_sum,max_speed) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING RETURNING unit',[unit,work_date,values.total_count,values.moving_count,values.speed_sum,values.max_speed]);
 if(!saved.rows.length)throw new HttpError(409,'Rekap sudah berubah atau sudah ada. Buka ulang rekap sebelum menyimpan.');await audit(tx,this.actor,'save','speed-daily',unit+':'+work_date,values);});return unit;
 }
 async delete(input){const unit=speedUnit(input,true),day=date(input,'work_date'),version=Number(text(input,'version',12,true));if(!Number.isSafeInteger(version)||version<1)throw new HttpError(422,'Versi rekap tidak valid.');await this.db.transaction(async tx=>{if(!(await tx.query('DELETE FROM fleetsync.speed_daily WHERE unit=$1 AND work_date=$2 AND version=$3 RETURNING unit',[unit,day,version])).rows.length)throw new HttpError(409,'Rekap sudah berubah. Muat ulang sebelum menghapus.');await audit(tx,this.actor,'delete','speed-daily',unit+':'+day);});return unit;}
}
