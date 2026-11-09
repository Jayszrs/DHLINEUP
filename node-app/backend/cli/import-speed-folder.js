import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {database,one,audit} from '../src/db.js';
import {Storage} from '../src/storage.js';
import {SpeedFiles} from '../src/speed.js';

const filename=path.resolve(process.argv[2]||'.private/october-package/manifest.json');
const manifest=JSON.parse(await readFile(filename,'utf8')),apply=process.argv.includes('--apply');
if(!manifest.provider_checksums_verified||manifest.errors?.length||manifest.from!=='2026-10-17'||manifest.to!=='2026-10-31'||!/^[a-f0-9]{64}$/.test(manifest.revision))throw new Error('Manifest sumber belum terverifikasi.');
if(!manifest.daily?.length||manifest.daily.some(r=>!/^DT\d+$/.test(r.unit)||r.work_date<manifest.from||r.work_date>manifest.to))throw new Error('Cakupan sumber tidak valid.');
const units=[...new Set(manifest.daily.map(r=>r.unit))].sort(),db=await database();
try{
 const source=await one(db,"SELECT setting_value FROM fleetsync.app_settings WHERE setting_key=$1",['speed_folder_'+manifest.revision]);
 if(source){console.log(JSON.stringify({already:true,revision:manifest.revision}));}
 else{
  const before=(await db.query('SELECT * FROM fleetsync.speed_daily ORDER BY unit,work_date')).rows;
  const existing=new Map(before.map(r=>[r.unit+':'+r.work_date,r]));
  const changes=manifest.daily.filter(r=>{const old=existing.get(r.unit+':'+r.work_date);if(!old)return true;for(const k of ['total_count','moving_count','speed_sum','max_speed'])if(Number(old[k])!==Number(r[k]))throw new Error('Rekap berbeda sudah tersedia: '+r.unit+' '+r.work_date);return false;});
  // A partial identical recap without its original GPS needs manual review.
  if(changes.length!==manifest.daily.length)throw new Error('Sebagian tanggal sudah tersedia; periksa cakupan sebelum impor.');
  const report={revision:manifest.revision,files:manifest.files.length,units:units.length,daily:changes.length,readings:changes.reduce((n,r)=>n+r.total_count,0),from:manifest.from,to:manifest.to,apply};
  console.log(JSON.stringify(report));
  const files=new SpeedFiles(new Storage());
  for(let start=0;start<changes.length;start+=10){
   await Promise.all(changes.slice(start,start+10).map(async(day,index)=>{
    if(!/^DT\d+-2026-10-\d{2}\.json\.gz$/.test(day.file))throw new Error('Nama arsip sumber tidak valid.');
    const bytes=await readFile(path.join(path.dirname(filename),day.file));
    if(createHash('sha256').update(bytes).digest('hex')!==day.checksum)throw new Error('Checksum sumber tidak cocok.');
    const chunk=JSON.parse(gunzipSync(bytes));
    if(chunk.rows.length-1!==day.total_count)throw new Error('Jumlah GPS tidak cocok dengan rekap.');
    const speedIndex=chunk.rows[0].indexOf('Speed Numeric (km/jam)');let moving=0,sum=0,max=0;
    for(const row of chunk.rows.slice(1)){const speed=Number(row[speedIndex]);if(!Number.isFinite(speed)||speed<0||speed>500||row[1]!==day.unit||row[5].slice(0,10)!==day.work_date)throw new Error('GPS di luar cakupan rekap.');moving+=speed>0?1:0;sum+=speed;max=Math.max(max,speed);}
    if(moving!==day.moving_count||Math.abs(sum-Number(day.speed_sum))>.0001||max!==Number(day.max_speed))throw new Error('Angka rekap tidak cocok dengan seluruh GPS asli.');
    day.object_path=`speed/${manifest.revision}/${start+index}.json.gz`;
    if(apply)await files.put(day.object_path,bytes);
   }));
   if(start%200===0)console.log(JSON.stringify({verifiedDaily:Math.min(start+10,changes.length),total:changes.length}));
  }
  if(apply){
   const backup=path.resolve('.private/dhocc-speed-backup-'+Date.now()+'.json');await mkdir(path.dirname(backup),{recursive:true});
   await writeFile(backup,JSON.stringify({daily:before,units:(await db.query('SELECT * FROM fleetsync.speed_units')).rows,overrides:(await db.query('SELECT * FROM fleetsync.speed_gps_overrides')).rows}));
   await db.transaction(async tx=>{
    await tx.query("SELECT setting_value FROM fleetsync.app_settings WHERE setting_key='bootstrap' FOR UPDATE");
    const current=(await tx.query('SELECT * FROM fleetsync.speed_daily ORDER BY unit,work_date FOR UPDATE')).rows;
    if(JSON.stringify(current)!==JSON.stringify(before))throw new Error('Data berubah saat verifikasi. Ulangi pratinjau.');
    await tx.query('INSERT INTO fleetsync.speed_units(unit) SELECT unnest($1::text[]) ON CONFLICT DO NOTHING',[units]);
    for(let start=0;start<changes.length;start+=200){const payload=JSON.stringify(changes.slice(start,start+200));
     await tx.query("INSERT INTO fleetsync.speed_daily(unit,work_date,total_count,moving_count,speed_sum,max_speed,source) SELECT unit,work_date,total_count,moving_count,speed_sum,max_speed,$2 FROM jsonb_to_recordset($1::jsonb) AS x(unit text,work_date date,total_count int,moving_count int,speed_sum numeric,max_speed numeric)",[payload,'Drive '+manifest.source_folder]);
     await tx.query('INSERT INTO fleetsync.speed_gps_overrides(unit,work_date,object_path,row_count,base_count) SELECT unit,work_date,object_path,total_count,0 FROM jsonb_to_recordset($1::jsonb) AS x(unit text,work_date date,object_path text,total_count int)',[payload]);
    }
    await tx.query('INSERT INTO fleetsync.app_settings(setting_key,setting_value) VALUES($1,$2)',['speed_folder_'+manifest.revision,JSON.stringify(report)]);
    await audit(tx,null,'import','speed-folder',manifest.revision,report);
   });
   const after=(await db.query('SELECT * FROM fleetsync.speed_daily WHERE work_date<$1 ORDER BY unit,work_date',[manifest.from])).rows;
   if(JSON.stringify(after)!==JSON.stringify(before))throw new Error('Verifikasi data lama gagal.');
   const totals=await one(db,'SELECT count(*)::int AS daily,sum(total_count)::bigint AS readings,sum(moving_count)::bigint AS moving,sum(speed_sum)::numeric AS speed_sum,max(max_speed)::numeric AS max_speed FROM fleetsync.speed_daily WHERE work_date BETWEEN $1 AND $2',[manifest.from,manifest.to]);
   for(const key of ['readings','moving','speed_sum']){const expected=changes.reduce((n,r)=>n+Number(r[{readings:'total_count',moving:'moving_count',speed_sum:'speed_sum'}[key]]),0);if(Math.abs(Number(totals[key])-expected)>.001)throw new Error('Total impor tidak cocok: '+key);}
   await writeFile(path.resolve('.private/dhocc-speed-import-result.json'),JSON.stringify({...report,totals,previousRowsPreserved:before.length,backup},null,2));
   console.log(JSON.stringify({imported:true,...totals,previousRowsPreserved:before.length}));
  }
 }
}finally{await db.close();}
