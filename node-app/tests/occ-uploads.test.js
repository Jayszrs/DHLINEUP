import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import {mkdtemp,readdir,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {database,initialize,one} from '../backend/src/db.js';
import {createApp} from '../backend/src/app.js';
import {OccRepository} from '../backend/src/occ.js';
import {Storage} from '../backend/src/storage.js';

const csrfOf = response => response.text.match(/name="csrf" value="([a-f0-9]{64})"/)?.[1];

test('OCC inventory saves multiple codes and photos with rollback, signed uploads and authenticated galleries',async t=>{
 const directory=await mkdtemp(path.join(os.tmpdir(),'occ-photos-'));
 const db=await database({url:'',dataDir:null});
 await initialize(db);
 const storage=new Storage({directory,url:'',key:''});
 const app=createApp({db,storage}),admin=request.agent(app),password='OCC-Photos-QA-2026';
 const png=await sharp({create:{width:24,height:16,channels:3,background:'#b65d1a'}}).png().toBuffer();
 const jpg=await sharp(png).jpeg().toBuffer();
 const repo=new OccRepository(db,1);
 let id,token;
 try{
  const setup=await admin.get('/setup');
  await admin.post('/setup').type('form').send({csrf:csrfOf(setup),name:'OCC Admin',username:'occ.photos',password,password_confirmation:password});
  const form=await admin.get('/occ-form?kind=asset');
  assert.equal(form.status,200,form.text);
  token=csrfOf(form);
  assert.match(form.text,/name="occ_photo" multiple/);
  assert.match(form.text,/<textarea name="asset_code"/);
  const fields={csrf:token,kind:'asset',version:'0',name:'Headset monitor',category:'Audio',qty:'2',asset_code:'HS-001\nHS-002;hs-001',availability:'Available',condition:'Good'};

  await t.test('multiple files are saved and served with the actual image MIME type',async()=>{
   const saved=await admin.post('/occ-save').field(fields).attach('occ_photo',png,'front.png').attach('occ_photo',jpg,'serial.jpg');
   assert.equal(saved.status,303,saved.text);
   const [asset]=(await repo.data()).assets;
   id=asset.id;
   assert.equal(asset.asset_code,'HS-001\nHS-002');
   assert.equal(asset.qty,2);
   assert.equal(asset.photos.length,2);
   for(const [index,bytes,mime]of [[0,png,'image/png'],[1,jpg,'image/jpeg']]){
    const image=await admin.get('/occ-photo?id='+id+'&index='+index);
    assert.equal(image.status,200);
    assert.match(image.headers['content-type'],new RegExp(mime));
    assert.deepEqual(image.body,bytes);
   }
   assert.equal((await request(app).get('/occ-photo?id='+id+'&index=0')).status,303);
   const list=await admin.get('/occ-assets');
   assert.match(list.text,/Lihat 2 foto/);
   const gallery=await admin.get('/occ-documentation?id='+id);
   assert.match(gallery.text,/serial.jpg/);
   assert.match(gallery.text,/Tambah foto/);
  });

  await t.test('editing adds photos, keeps old photos and removes only selected uploads',async()=>{
   const first=await repo.asset(id);
   const result=await admin.post('/occ-save').field({...fields,id,version:'1',remove_photos:JSON.stringify([first.photos[0].id])}).attach('occ_photo',png,'detail.png');
   assert.equal(result.status,303,result.text);
   const saved=await repo.asset(id);
   assert.equal(saved.photos.length,2);
   assert.equal(saved.photos[0].name,'serial.jpg');
   assert.equal(saved.photos[1].name,'detail.png');
   await assert.rejects(storage.get(first.photos[0].path),error=>error.status===404);
   const conflict=await admin.post('/occ-save').field({...fields,id,version:'1'}).attach('occ_photo',png,'stale.png');
   assert.equal(conflict.status,409);
   assert.equal((await repo.asset(id)).photos.length,2);
  });

  await t.test('invalid files roll back the record and clean new storage objects',async()=>{
   const before=(await readdir(path.join(directory,'uploads'))).sort();
   const failed=await admin.post('/occ-save').field({...fields,id,version:'2',name:'Must roll back'}).attach('occ_photo',png,'valid.png').attach('occ_photo',Buffer.from('invalid image'),'fake.jpg');
   assert.equal(failed.status,422,failed.text);
   assert.match(failed.text,/Pilih ulang foto/);
   const saved=await repo.asset(id);
   assert.equal(saved.version,2);
   assert.equal(saved.name,fields.name);
   assert.deepEqual((await readdir(path.join(directory,'uploads'))).sort(),before);
   const forged=await admin.post('/occ-save').type('form').send({...fields,id,version:'2',remove_photos:JSON.stringify(['a'.repeat(24)])});
   assert.equal(forged.status,422);
  });

  await t.test('signed uploads are consumed atomically and recover after validation failures',async()=>{
   storage.client={storage:{from(){return{async createSignedUploadUrl(){return{data:{signedUrl:'https://fixture.invalid/upload'}};}};}}};
   const ticket=await admin.post('/upload-ticket').send({csrf:token,kind:'occ_photo',extension:'png',size:png.length});
   assert.equal(ticket.status,200,ticket.text);
   storage.client=null;
   const pending=await one(db,'SELECT * FROM fleetsync.upload_tickets WHERE id=$1',[ticket.body.id]);
   await storage.put(pending.path,png,'image/png');
   const input={...fields,id,version:'2',photo_tickets:JSON.stringify([{id:ticket.body.id,name:'signed-photo.png'}])};
   const invalid=await admin.post('/occ-save').type('form').send({...input,name:''});
   assert.equal(invalid.status,422);
   assert.match(invalid.text,/signed-photo.png/);
   assert.equal((await one(db,'SELECT consumed_at FROM fleetsync.upload_tickets WHERE id=$1',[ticket.body.id])).consumed_at,null);
   const saved=await admin.post('/occ-save').type('form').send(input);
   assert.equal(saved.status,303,saved.text);
   assert.equal((await repo.asset(id)).photos.length,3);
   assert.ok((await one(db,'SELECT consumed_at FROM fleetsync.upload_tickets WHERE id=$1',[ticket.body.id])).consumed_at);
   await assert.rejects(storage.get(pending.path),error=>error.status===404);
   const reused=await admin.post('/occ-save').type('form').send({...input,version:'3'});
   assert.equal(reused.status,422);
   assert.equal((await repo.asset(id)).photos.length,3);
  });

  await t.test('long lists of codes are searchable and preserve existing photos without upload fields',async()=>{
   const codes=Array.from({length:60},(_,index)=>'OCC-'+String(index).padStart(3,'0')+'-'+ 'X'.repeat(60));
   const saved=await admin.post('/occ-save').type('form').send({...fields,id,version:'3',asset_code:codes.join('\n')});
   assert.equal(saved.status,303,saved.text);
   const asset=await repo.asset(id);
   assert.equal(asset.asset_code,codes.join('\n'));
   assert.equal(asset.photos.length,3);
   assert.equal((await repo.data({search:codes.at(-1)})).assets.length,1);
   const invalid=await admin.post('/occ-save').type('form').send({...fields,id,version:'4',asset_code:'x'.repeat(121)});
   assert.equal(invalid.status,422);
  });

  await t.test('source galleries and new uploads are shown together without replacing shared source files',async()=>{
   const sourcePath=await storage.image(png),reference='occ_source_fixture';
   await db.query("INSERT INTO fleetsync.app_settings(setting_key,setting_value) VALUES('occ_photos_v1',$1)",[JSON.stringify({[reference]:[{path:sourcePath,mime:'image/png',name:'Source camera'}]})]);
   const saved=await admin.post('/occ-save').field({...fields,name:'Source gallery camera',photo_url:'https://drive.google.com/drive/folders/'+reference}).attach('occ_photo',jpg,'New camera.jpg');
   assert.equal(saved.status,303,saved.text);
   const asset=(await repo.data({search:'Source gallery camera'})).assets[0];
   const gallery=await admin.get('/occ-documentation?id='+asset.id);
   assert.match(gallery.text,/Source camera/);
   assert.match(gallery.text,/New camera.jpg/);
   const first=await admin.get('/occ-photo?id='+asset.id+'&index=0');
   assert.deepEqual(first.body,png);
   const removed=await admin.post('/occ-save').type('form').send({...fields,id:asset.id,version:'1',photo_url:asset.photo_url,remove_photos:JSON.stringify([asset.photos[0].id])});
   assert.equal(removed.status,303,removed.text);
   assert.deepEqual(await storage.get(sourcePath),png);
  });

  await t.test('CSRF and viewer permissions cover the upload and save endpoints',async()=>{
   assert.equal((await admin.post('/occ-save').field({...fields,csrf:'invalid'}).attach('occ_photo',png,'front.png')).status,419);
   await admin.post('/account-create').type('form').send({csrf:token,name:'Viewer',username:'occ.viewer',password,password_confirmation:password,current_password:password});
   const viewer=request.agent(app),login=await viewer.get('/login');
   await viewer.post('/login').type('form').send({csrf:csrfOf(login),username:'occ.viewer',password});
   const page=await viewer.get('/occ-assets');
   const viewerToken=csrfOf(page);
   assert.equal((await viewer.post('/occ-save').field({...fields,csrf:viewerToken}).attach('occ_photo',png,'front.png')).status,403);
   assert.equal((await viewer.post('/upload-ticket').send({csrf:viewerToken,kind:'occ_photo',extension:'png',size:png.length})).status,403);
   assert.equal((await viewer.get('/occ-photo?id='+id+'&index=0')).status,200);
  });
 }finally{
  storage.client=null;
  await db.close();
  assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir())+path.sep+'occ-photos-'));
  await rm(directory,{recursive:true,force:true});
 }
});
