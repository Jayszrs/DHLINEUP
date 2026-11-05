import {randomBytes,createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {one,audit} from './db.js';
import {HttpError} from './validation.js';
import {readSpeedSpreadsheet} from './speed-spreadsheet.js';

const keys=rows=>rows.map(r=>({unit:r.unit,work_date:r.work_date}));
const columns='unit text,work_date date';
const dailyColumns=columns+',total_count integer,moving_count integer,speed_sum numeric,max_speed numeric,version integer';
const stale=()=>new HttpError(409,'Data speed berubah setelah pratinjau. Unggah ulang file agar perubahan terbaru tidak tertimpa.');
export class SpeedImporter {
 constructor(db,storage,files,user){Object.assign(this,{db,storage,files,user});}
 async job(id){if(!/^[a-f0-9]{64}$/.test(id||''))throw new HttpError(422,'Referensi impor tidak valid.');const job=await one(this.db,'SELECT * FROM fleetsync.speed_import_jobs WHERE id=$1 AND user_id=$2 AND expires_at>now()',[id,this.user.id]);if(!job)throw new HttpError(404,'Pratinjau impor tidak tersedia atau sudah kedaluwarsa. Unggah ulang file.');return job;}
 async preview(bytes,extension,{unit='',filename='MDVR'}={}){
  const pending=await one(this.db,'SELECT count(*) AS n FROM fleetsync.speed_import_jobs WHERE user_id=$1 AND expires_at>now() AND applied_at IS NULL',[this.user.id]);if(Number(pending.n)>=20)throw new HttpError(429,'Terlalu banyak pratinjau tertunda. Gunakan pratinjau yang sudah ada atau coba lagi setelah dua jam.');
  const data=readSpeedSpreadsheet(bytes,extension,{unit,filename}),affected=JSON.stringify(keys(data.daily));
  const old=(await this.db.query(`SELECT d.unit,d.work_date,d.version FROM fleetsync.speed_daily d JOIN jsonb_to_recordset($1::jsonb) AS k(${columns}) USING(unit,work_date)`,[affected])).rows;
  const versions=new Map(old.map(r=>[r.unit+':'+r.work_date,r.version]));
  const units=[...new Set(data.daily.map(r=>r.unit))],sources=(await this.db.query('SELECT unit,raw_path FROM fleetsync.speed_units WHERE unit=ANY($1::text[])',[units])).rows;
  const baseCounts=new Map();
  if(data.kind==='gps')for(const source of sources){if(!source.raw_path)continue;const archive=await this.files.rows(source.raw_path),days=new Set(data.daily.filter(r=>r.unit===source.unit).map(r=>r.work_date));for(const row of archive.rows.slice(1)){const day=String(row[5]||'').slice(0,10);if(row[0]&&days.has(day)){const key=source.unit+':'+day;baseCounts.set(key,(baseCounts.get(key)||0)+1);}}}
  const daily=data.daily.map(r=>({unit:r.unit,work_date:r.work_date,total_count:r.total_count,moving_count:r.moving_count,speed_sum:r.speed_sum,max_speed:r.max_speed,version:Number(versions.get(r.unit+':'+r.work_date)||0),base_count:baseCounts.get(r.unit+':'+r.work_date)||0}));
  const dates=daily.map(r=>r.work_date).sort(),metadata={kind:data.kind,units:units.length,readings:data.readings,duplicates:data.duplicates,from:dates[0],to:dates.at(-1),added:daily.filter(r=>!r.version).length,replaced:daily.filter(r=>r.version).length,daily};
  const id=randomBytes(32).toString('hex'),object_path=`speed/${id}/0.json.gz`,packed=gzipSync(Buffer.from(JSON.stringify(data)));
  if(packed.length>10*1024*1024)throw new HttpError(422,'Data GPS terlalu besar. Pisahkan file berdasarkan unit atau tanggal.');
  await this.files.put(object_path,packed);
  await this.db.query('INSERT INTO fleetsync.speed_import_jobs(id,user_id,object_path,filename,metadata) VALUES($1,$2,$3,$4,$5)',[id,this.user.id,object_path,String(filename).slice(0,180),JSON.stringify(metadata)]);
  return this.job(id);
 }
 async apply(id){
  const job=await this.job(id);if(job.applied_at)return{already:true,...job.metadata};
  const data=await this.files.rows(job.object_path),metadata=job.metadata,overrides=[];
  if(data.kind==='gps')for(const [index,group] of data.daily.entries()){
   const rows=[group.headers,...group.rows],packed=gzipSync(Buffer.from(JSON.stringify({name:group.unit,rows}))),revision=createHash('sha256').update(id+':'+index).digest('hex'),object_path=`speed/${revision}/0.json.gz`;
   if(packed.length>10*1024*1024)throw new HttpError(422,'Arsip harian terlalu besar. Pisahkan file.');await this.files.put(object_path,packed);
   overrides.push({unit:group.unit,work_date:group.work_date,object_path,row_count:group.rows.length,base_count:metadata.daily[index].base_count});
  }
  return this.db.transaction(async tx=>{
   const locked=await one(tx,'SELECT * FROM fleetsync.speed_import_jobs WHERE id=$1 AND user_id=$2 AND expires_at>now() FOR UPDATE',[id,this.user.id]);if(!locked)throw new HttpError(409,'Pratinjau kedaluwarsa. Unggah ulang file.');if(locked.applied_at)return{already:true,...metadata};
   const units=[...new Set(metadata.daily.map(r=>r.unit))].sort();
   await tx.query('INSERT INTO fleetsync.speed_units(unit) SELECT unnest($1::text[]) ON CONFLICT DO NOTHING',[units]);
   await tx.query('SELECT unit FROM fleetsync.speed_units WHERE unit=ANY($1::text[]) ORDER BY unit FOR UPDATE',[units]);
   const selected=(await tx.query(`SELECT d.unit,d.work_date,d.version FROM fleetsync.speed_daily d JOIN jsonb_to_recordset($1::jsonb) AS k(${columns}) USING(unit,work_date) ORDER BY d.unit,d.work_date FOR UPDATE OF d`,[JSON.stringify(keys(metadata.daily))])).rows;
   const versions=new Map(selected.map(r=>[r.unit+':'+r.work_date,Number(r.version)]));if(metadata.daily.some(r=>(versions.get(r.unit+':'+r.work_date)||0)!==r.version))throw stale();
   const payload=JSON.stringify(metadata.daily),source=data.kind==='gps'?'MDVR GPS':'Impor rekap';
   const updated=await tx.query(`UPDATE fleetsync.speed_daily d SET total_count=k.total_count,moving_count=k.moving_count,speed_sum=k.speed_sum,max_speed=k.max_speed,source=$2,version=d.version+1,updated_at=now() FROM jsonb_to_recordset($1::jsonb) AS k(${dailyColumns}) WHERE k.version>0 AND d.unit=k.unit AND d.work_date=k.work_date AND d.version=k.version RETURNING d.unit`,[payload,source]);
   const inserted=await tx.query(`INSERT INTO fleetsync.speed_daily(unit,work_date,total_count,moving_count,speed_sum,max_speed,source) SELECT unit,work_date,total_count,moving_count,speed_sum,max_speed,$2 FROM jsonb_to_recordset($1::jsonb) AS k(${dailyColumns}) WHERE version=0 ON CONFLICT DO NOTHING RETURNING unit`,[payload,source]);
   if(updated.rows.length+inserted.rows.length!==metadata.daily.length)throw stale();
   if(overrides.length)await tx.query(`INSERT INTO fleetsync.speed_gps_overrides(unit,work_date,object_path,row_count,base_count) SELECT unit,work_date,object_path,row_count,base_count FROM jsonb_to_recordset($1::jsonb) AS k(${columns},object_path text,row_count integer,base_count integer) ON CONFLICT(unit,work_date) DO UPDATE SET object_path=excluded.object_path,row_count=excluded.row_count,base_count=excluded.base_count`,[JSON.stringify(overrides)]);
   await tx.query('UPDATE fleetsync.speed_import_jobs SET applied_at=now() WHERE id=$1',[id]);
   await audit(tx,this.user.id,'import','speed-daily',id,{filename:job.filename,kind:metadata.kind,units:metadata.units,from:metadata.from,to:metadata.to,added:metadata.added,replaced:metadata.replaced,readings:metadata.readings,duplicates:metadata.duplicates});
   return metadata;
  });
 }
}
