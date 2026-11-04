import { createHash } from 'node:crypto';
import { unzipSync,strFromU8 } from 'fflate';
import { one } from './db.js';
import { HttpError } from './validation.js';

export const snapshotColumns={
  app_settings:['setting_key','setting_value'],
  users:['id','name','username','password_hash','created_at'],
  operators:['id','site','nik','name','unit','equipment','last_date','version','updated_at'],
  lineups:['id','site','work_date','shift','type_category','unit','equipment','operator_name','nik','dh','mine','ftw','source_status','note','proof_ftw','proof_mine','source','source_row','version','created_at','updated_at'],
  audit_logs:['id','user_id','action','entity_type','entity_id','details','created_at'],
};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export function normalizeProof(value) {
  if (String(value || '').startsWith('/assets/evidence/')) return value.slice(8);
  return /^[a-f0-9]{48}\.(png|jpg|webp)$/.test(value||'')?'uploads/'+value:(value||'');
}
function normalizeValue(key,value) {
  if(['proof_ftw','proof_mine'].includes(key)) return normalizeProof(value);
  if(['created_at','updated_at'].includes(key)&&typeof value==='string'&&/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(value)) return value.replace(' ','T')+'+07:00';
  if(key==='details') return typeof value==='string'?value:JSON.stringify(value);
  return value;
}
export async function importSnapshot(db,storage,buffer) {
  if(buffer.length>60*1024*1024) throw new HttpError(422,'Paket snapshot maksimal 60 MB.');
  let total=0;
  const files=unzipSync(buffer,{filter(file){total+=file.originalSize;if(file.originalSize>15*1024*1024||total>100*1024*1024) throw new HttpError(422,'Isi snapshot terlalu besar.');return file.name==='snapshot.json'||file.name.startsWith('images/');}});
  const data=JSON.parse(strFromU8(files['snapshot.json']||new Uint8Array()));
  if(data.format!=='fleetsync-snapshot-v2'||!data.tables||!Array.isArray(data.images)) throw new HttpError(422,'Format snapshot tidak dikenali.');
  for(const table of Object.keys(snapshotColumns)) if(!Array.isArray(data.tables[table])||data.tables[table].length>100000) throw new HttpError(422,'Tabel snapshot tidak valid.');
  const marker=sha(buffer),added=[];
  try {
    return await db.transaction(async tx=>{
      await tx.query("SELECT setting_value FROM fleetsync.app_settings WHERE setting_key='bootstrap' FOR UPDATE");
      if((await one(tx,"SELECT setting_value FROM fleetsync.app_settings WHERE setting_key='migration_snapshot'"))?.setting_value===marker) return {skipped:true};
      for(const table of ['users','lineups','operators']) if(Number((await one(tx,`SELECT count(*) AS n FROM fleetsync.${table}`)).n)) throw new HttpError(409,'Tujuan sudah berisi data. Migrasi dibatalkan agar akun atau perubahan tidak tertimpa.');
      for(const image of data.images) {
        storage.valid(image.path);
        const bytes=files['images/'+image.path];
        if(!bytes||sha(bytes)!==image.sha256) throw new HttpError(422,'Checksum gambar snapshot tidak cocok.');
        let existing;
        try {existing=await storage.get(image.path);} catch(error) {if(error.status!==404) throw error;}
        if(existing) {if(sha(existing)!==image.sha256) throw new HttpError(409,'File tujuan berbeda. Migrasi dibatalkan.');}
        else {await storage.put(image.path,bytes,image.mime);added.push(image.path);}
      }
      for(const [table,columns] of Object.entries(snapshotColumns)) for(const row of data.tables[table]) {
        if(table==='app_settings'&&['migration_snapshot','bootstrap'].includes(row.setting_key)) continue;
        for(const field of ['proof_ftw','proof_mine']) if(row[field]&&!data.images.some(image=>image.path===normalizeProof(row[field]))) throw new HttpError(422,'Bukti yang dirujuk tidak tersedia di snapshot.');
        const values=columns.map(key=>normalizeValue(key,row[key]??null));
        await tx.query(`INSERT INTO fleetsync.${table}(${columns.join(',')}) VALUES(${columns.map((_,i)=>`$${i+1}`).join(',')}) ${table==='app_settings'?'ON CONFLICT DO NOTHING':''}`,values);
      }
      for(const table of ['users','operators','audit_logs']) await tx.query(`SELECT setval(pg_get_serial_sequence('fleetsync.${table}','id'),coalesce((SELECT max(id) FROM fleetsync.${table}),1),(SELECT count(*)>0 FROM fleetsync.${table}))`);
      await tx.query("INSERT INTO fleetsync.app_settings(setting_key,setting_value) VALUES('migration_snapshot',$1)",[marker]);
      return {skipped:false,counts:Object.fromEntries(Object.entries(data.tables).map(([key,rows])=>[key,rows.length])),images:data.images.length};
    });
  } catch(error) {await Promise.allSettled(added.map(name=>storage.remove(name)));throw error;}
}
