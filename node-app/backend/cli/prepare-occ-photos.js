import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {database,audit} from '../src/db.js';
import {Storage} from '../src/storage.js';
const input=process.argv[2];if(!input)throw new Error('Provide the verified photo download manifest.');
const files=JSON.parse(await readFile(input,'utf8')),storage=new Storage(),db=await database(),manifest={},folder='1Fkji8gNuaSJ4nqxTgfK4ftgZ9lSaz6At',all=[];
try{
 for(const file of files){if(file.error||!/^image\//.test(file.mime))throw new Error('Photo download not verified: '+file.id);const original=await readFile(file.local),bytes=await sharp(original,{limitInputPixels:40000000}).rotate().resize({width:1600,height:1200,fit:'inside',withoutEnlargement:true}).webp({quality:86}).toBuffer();const hash=createHash('sha256').update(bytes).digest('hex'),path='uploads/'+hash.slice(0,48)+'.webp',photo={id:file.id,name:file.name,path,sha256:hash};
  if(process.argv.includes('--apply')){let existing;try{existing=await storage.get(path);}catch{}if(existing){if(createHash('sha256').update(existing).digest('hex')!==hash)throw new Error('Existing photo checksum mismatch');}else await storage.put(path,bytes,'image/webp');const verified=await storage.get(path);if(createHash('sha256').update(verified).digest('hex')!==hash)throw new Error('Uploaded photo checksum mismatch');}
  manifest[file.id]=[photo];all.push(photo);
 }
 manifest[folder]=all;
 const assets=(await db.query('SELECT id,photo_url FROM fleetsync.occ_assets')).rows;
 for(const asset of assets){const id=asset.photo_url.match(/\/(?:d|folders)\/([\w-]+)/)?.[1];if(id&&!manifest[id])throw new Error('Asset source photo missing: '+asset.id);}
 if(process.argv.includes('--apply'))await db.transaction(async tx=>{await tx.query("INSERT INTO fleetsync.app_settings(setting_key,setting_value) VALUES('occ_photos_v1',$1) ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value",[JSON.stringify(manifest)]);await audit(tx,null,'import','occ-photos',folder,{photos:all.length,source:'Verified OCC documentation folder',source_links_preserved:true});});
 await mkdir('.private/occ-images',{recursive:true});await writeFile('.private/occ-images/site-manifest.json',JSON.stringify(manifest,null,2));console.log(JSON.stringify({photos:all.length,assets:assets.length,linksResolved:assets.filter(a=>a.photo_url).length,applied:process.argv.includes('--apply')}));
}finally{await db.close();}
