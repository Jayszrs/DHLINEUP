import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {database,one,audit} from '../src/db.js';
import {Storage} from '../src/storage.js';
import {SpeedFiles} from '../src/speed.js';
const filename=path.resolve(process.argv[2]||'.private/speed-package/manifest.json'),manifest=JSON.parse(await readFile(filename,'utf8'));
if(!/^[a-f0-9]{64}$/.test(manifest.revision)||!Array.isArray(manifest.sheets)||!Array.isArray(manifest.units)||!Array.isArray(manifest.daily))throw new Error('Manifest speed tidak valid.');
const db=await database();
try {
 await db.transaction(async tx=>{await tx.query("SET LOCAL lock_timeout='5s'");await tx.query(await readFile(new URL('../../database/speed.sql',import.meta.url),'utf8'));});
 const old=await one(db,"SELECT setting_value FROM fleetsync.app_settings WHERE setting_key='speed_source_revision'");
 if(old?.setting_value===manifest.revision){console.log(JSON.stringify({skipped:true,reason:'Snapshot speed yang sama sudah diimpor.'}));}
 else {
  if(Number((await one(db,'SELECT count(*) AS n FROM fleetsync.speed_daily')).n))throw new Error('Speed sudah berisi data. Snapshot baru tidak boleh menimpa perubahan.');
  const files=new SpeedFiles(new Storage());let completed=0;
  for(let start=0;start<manifest.sheets.length;start+=3)await Promise.all(manifest.sheets.slice(start,start+3).map(async sheet=>{
   const bytes=await readFile(path.join(path.dirname(filename),sheet.gid+'.json.gz'));
   if(createHash('sha256').update(bytes).digest('hex')!==sheet.checksum)throw new Error('Checksum arsip speed tidak cocok.');
   if(bytes.length>10*1024*1024)throw new Error('Arsip per tab melebihi 10 MB.');
   await files.put(`speed/${manifest.revision}/${sheet.gid}.json.gz`,bytes);completed++;if(completed%20===0)console.log(JSON.stringify({uploaded:completed,total:manifest.sheets.length}));
  }));
  await db.transaction(async tx=>{
   await tx.query("SELECT setting_value FROM fleetsync.app_settings WHERE setting_key='bootstrap' FOR UPDATE");
   if(Number((await one(tx,'SELECT count(*) AS n FROM fleetsync.speed_daily')).n))throw new Error('Speed berubah saat impor berlangsung.');
   for(const u of manifest.units)await tx.query('INSERT INTO fleetsync.speed_units(unit,fleet,source_gid,raw_path,raw_count,registry,note) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING',[u.unit,u.fleet,u.source_gid,u.source_gid?`speed/${manifest.revision}/${u.source_gid}.json.gz`:'',u.raw_count||0,JSON.stringify(u.registry),u.note||'']);
   for(let start=0;start<manifest.daily.length;start+=200){const rows=manifest.daily.slice(start,start+200);await tx.query("INSERT INTO fleetsync.speed_daily(unit,work_date,total_count,moving_count,speed_sum,max_speed,source) SELECT unit,work_date,total_count,moving_count,speed_sum,max_speed,'spreadsheet' FROM jsonb_to_recordset($1::jsonb) AS x(unit text,work_date date,total_count integer,moving_count integer,speed_sum numeric,max_speed numeric)",[JSON.stringify(rows)]);}
   for(const s of manifest.sheets)await tx.query('INSERT INTO fleetsync.speed_source_sheets(gid,name,object_path,source_rows,checksum) VALUES($1,$2,$3,$4,$5)',[s.gid,s.name,`speed/${manifest.revision}/${s.gid}.json.gz`,s.source_rows,s.checksum]);
   for(const [key,value] of Object.entries({speed_source_revision:manifest.revision,speed_periods:JSON.stringify(manifest.periods),speed_source_url:'https://docs.google.com/spreadsheets/d/'+manifest.source+'/edit'}))await tx.query('INSERT INTO fleetsync.app_settings(setting_key,setting_value) VALUES($1,$2) ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value',[key,value]);
   await audit(tx,null,'import','speed-source',manifest.revision,{sheets:manifest.sheets.length,units:manifest.units.length,daily:manifest.daily.length});
  });
  const totals=await one(db,'SELECT count(*)::int AS daily,sum(total_count)::bigint AS total_count,sum(moving_count)::bigint AS moving_count,sum(speed_sum)::numeric AS speed_sum FROM fleetsync.speed_daily');console.log(JSON.stringify({imported:true,sheets:manifest.sheets.length,units:manifest.units.length,...totals}));
 }
}catch(error){console.error('Speed import failed:',error.code||error.message);process.exitCode=1;}finally{await db.close();}
