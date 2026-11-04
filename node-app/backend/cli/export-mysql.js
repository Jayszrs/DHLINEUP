import mysql from 'mysql2/promise';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { zipSync,strToU8 } from 'fflate';
import { snapshotColumns,normalizeProof } from '../src/snapshot.js';

const source=fileURLToPath(new URL('../../../',import.meta.url));
const db=await mysql.createConnection({host:process.env.MYSQL_HOST||'127.0.0.1',port:Number(process.env.MYSQL_PORT||3306),user:process.env.MYSQL_USER||'root',password:process.env.MYSQL_PASSWORD||'',database:process.env.MYSQL_DATABASE||'dh_fleetsync',dateStrings:true,supportBigNumbers:true,bigNumberStrings:true});
try {
  await db.query("SET time_zone='+07:00'");await db.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');await db.beginTransaction();
  const tables={};for(const [table,columns] of Object.entries(snapshotColumns)) tables[table]=(await db.query('SELECT '+columns.map(k=>'`'+k+'`').join(',')+' FROM `'+table+'`'))[0];await db.commit();
  const paths=new Set(tables.lineups.flatMap(row=>[row.proof_ftw,row.proof_mine]).filter(Boolean).map(normalizeProof));
  for(const name of ['Kolom_1_image2.png','Kolom_7_image1.png','Kolom_19_image3.png']) paths.add('reference/'+name);
  const images=[],files={};
  for(const name of paths) {
    if(!/^(evidence\/[A-Za-z0-9_]+\.png|reference\/[A-Za-z0-9_]+\.png|uploads\/[a-f0-9]{48}\.(png|jpg|webp))$/.test(name)) throw new Error('Nama bukti tidak valid.');
    const sourceFile=path.join(source,name.startsWith('uploads/')?'storage/'+name:'frontend/assets/'+name),bytes=await readFile(sourceFile);
    const mime=name.endsWith('.jpg')?'image/jpeg':name.endsWith('.webp')?'image/webp':'image/png';
    images.push({path:name,sha256:createHash('sha256').update(bytes).digest('hex'),mime});files['images/'+name]=bytes;
  }
  const snapshot={format:'fleetsync-snapshot-v2',source:'Laragon MySQL local',created_at:new Date().toISOString(),tables,images};files['snapshot.json']=strToU8(JSON.stringify(snapshot));
  const directory=fileURLToPath(new URL('../../.private/migration/',import.meta.url));await mkdir(directory,{recursive:true});
  await writeFile(path.join(directory,'local-snapshot.zip'),zipSync(files));
  console.log(JSON.stringify({file:path.join(directory,'local-snapshot.zip'),lineups:tables.lineups.length,operators:tables.operators.length,users:tables.users.length,images:images.length}));
} finally {await db.end();}
