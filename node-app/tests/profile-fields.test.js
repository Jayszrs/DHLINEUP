import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import sharp from 'sharp';
import { mkdtemp,rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { database,initialize,one } from '../backend/src/db.js';
import { createApp } from '../backend/src/app.js';
import { Storage } from '../backend/src/storage.js';
import { accountVersion } from '../backend/src/auth.js';
const token=r=>r.text.match(/name="csrf" value="([a-f0-9]{64})"/)?.[1];

test('account profiles store private photos, full names, employee NIK and site',async t=>{
 const directory=await mkdtemp(path.join(os.tmpdir(),'fleetsync-profile-'));
 const db=await database({dataDir:null});await initialize(db);const storage=new Storage({directory});
 const app=createApp({db,storage}),admin=request.agent(app),viewer=request.agent(app),password='Profile-Fixture-2026';
 let csrf,viewerCsrf,photo,viewerId;
 const png=await sharp({create:{width:800,height:600,channels:3,background:'#f58220'}}).png().toBuffer();
 try {
  let start=await admin.get('/setup');await admin.post('/setup').type('form').send({csrf:token(start),name:'Fixture Administrator',username:'profile.admin',password,password_confirmation:password});csrf=token(await admin.get('/profile'));
  await admin.post('/account-create').type('form').send({csrf,name:'Fixture Viewer',username:'profile.viewer',password,password_confirmation:password,current_password:password});
  viewerId=(await one(db,"SELECT id FROM fleetsync.users WHERE username='profile.viewer'")).id;
  start=await viewer.get('/login');await viewer.post('/login').type('form').send({csrf:token(start),username:'profile.viewer',password});viewerCsrf=token(await viewer.get('/profile'));
  await t.test('profile fields retain leading zero NIK and never accept forged account IDs or permissions',async()=>{
   const form=await viewer.get('/profile');assert.ok(form.text.includes('name="profile_photo"'));assert.ok(form.text.includes('name="nik"'));assert.ok(form.text.includes('name="site"'));
   assert.equal((await viewer.post('/profile-save').type('form').send({csrf:viewerCsrf,name:'Fixture Long Full Name',username:'profile.viewer',nik:'00004567',site:'ACP',id:1,is_admin:true,can_edit_data:true})).status,303);
   const user=await one(db,'SELECT * FROM fleetsync.users WHERE id=$1',[viewerId]);assert.equal(user.nik,'00004567');assert.equal(user.site,'ACP');assert.equal(user.is_admin,false);assert.equal(user.can_edit_data,false);
   assert.equal((await one(db,'SELECT name FROM fleetsync.users WHERE id=1')).name,'Fixture Administrator');
   assert.equal((await viewer.post('/profile-save').type('form').send({csrf:viewerCsrf,name:user.name,username:user.username,site:'INVALID'})).status,422);
  });
  await t.test('read-only account can upload its own validated photo, view it privately and retain it on text edits',async()=>{
   const saved=await viewer.post('/profile-save').field('csrf',viewerCsrf).field('name','Fixture Full Name').field('username','profile.viewer').field('nik','00004567').field('site','ACP').attach('profile_photo',png,'photo.png');assert.equal(saved.status,303,saved.text);
   const user=await one(db,'SELECT * FROM fleetsync.users WHERE id=$1',[viewerId]);photo=user.profile_photo;assert.match(photo,/^uploads\/[a-f0-9]{48}\.webp$/);
   const meta=await sharp(await storage.get(photo)).metadata();assert.ok(meta.width<=512);assert.ok(meta.height<=512);assert.equal(meta.format,'webp');
   assert.equal((await viewer.get('/avatar?id='+viewerId)).status,200);assert.equal((await admin.get('/avatar?id='+viewerId)).status,200);assert.equal((await viewer.get('/avatar?id=1')).status,403);
   assert.equal((await request(app).get('/avatar?id='+viewerId)).status,303);
   assert.equal((await viewer.post('/profile-save').type('form').send({csrf:viewerCsrf,name:user.name,username:user.username})).status,303);
   const retained=await one(db,'SELECT * FROM fleetsync.users WHERE id=$1',[viewerId]);assert.equal(retained.nik,'00004567');assert.equal(retained.site,'ACP');assert.equal(retained.profile_photo,photo);
   assert.ok((await viewer.get('/profile')).text.includes('class="avatar"><img'));
  });
  await t.test('invalid and oversized images do not alter the saved profile; photo removal needs CSRF',async()=>{
   for(const file of [Buffer.from('not an image'),Buffer.alloc(2*1024*1024+1)]) assert.equal((await viewer.post('/profile-save').field('csrf',viewerCsrf).field('name','Should Not Save').field('username','profile.viewer').attach('profile_photo',file,'fake.png')).status,422);
   let user=await one(db,'SELECT * FROM fleetsync.users WHERE id=$1',[viewerId]);assert.equal(user.name,'Fixture Full Name');assert.equal(user.profile_photo,photo);
   assert.equal((await viewer.post('/profile-save').type('form').send({csrf:'invalid',name:user.name,username:user.username,remove_profile_photo:'1'})).status,419);
   assert.equal((await viewer.post('/profile-save').type('form').send({csrf:viewerCsrf,name:user.name,username:user.username,remove_profile_photo:'1'})).status,303);
   assert.equal((await viewer.get('/avatar?id='+viewerId)).status,404);
  });
  await t.test('signed profile uploads work for read-only users without granting evidence or data upload access',async()=>{
   storage.client={storage:{from(){return {async createSignedUploadUrl(){return {data:{signedUrl:'https://fixture.invalid/upload'}};}};}}};
   const ticket=await viewer.post('/upload-ticket').send({csrf:viewerCsrf,kind:'profile_photo',extension:'png',size:png.length});assert.equal(ticket.status,200,ticket.text);
   assert.equal((await viewer.post('/upload-ticket').send({csrf:viewerCsrf,kind:'proof_ftw',extension:'png',size:png.length})).status,403);
   assert.equal((await viewer.post('/upload-ticket').send({csrf:viewerCsrf,kind:'profile_photo',extension:'png',size:2*1024*1024+1})).status,422);
   storage.client=null;
   const pending=await one(db,'SELECT path FROM fleetsync.upload_tickets WHERE id=$1',[ticket.body.id]);await storage.put(pending.path,png,'image/png');
   const fields={csrf:viewerCsrf,name:'Fixture Full Name',username:'profile.viewer',profile_photo_ticket:ticket.body.id};assert.equal((await viewer.post('/profile-save').type('form').send(fields)).status,303);
   assert.equal((await viewer.post('/profile-save').type('form').send(fields)).status,422);
   assert.ok((await one(db,'SELECT profile_photo FROM fleetsync.users WHERE id=$1',[viewerId])).profile_photo);
  });
  await t.test('administrator can update NIK/site with role controls and stale profile protection',async()=>{
   const user=await one(db,'SELECT * FROM fleetsync.users WHERE id=$1',[viewerId]);
   const fields={csrf,id:viewerId,name:user.name,username:user.username,nik:'00000999',site:'KCP',role:'Pengelola',account_version:accountVersion(user),current_password:password};
   assert.equal((await admin.post('/account-update').type('form').send(fields)).status,303);
   assert.equal((await admin.post('/account-update').type('form').send({...fields,site:'BCP'})).status,409);
   const saved=await one(db,'SELECT * FROM fleetsync.users WHERE id=$1',[viewerId]);assert.equal(saved.nik,'00000999');assert.equal(saved.site,'KCP');assert.equal(saved.is_admin,false);assert.equal(saved.can_edit_data,false);
  });
 } finally {storage.client=null;await db.close();assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir())+path.sep+'fleetsync-profile-'));await rm(directory,{recursive:true,force:true});}
});
