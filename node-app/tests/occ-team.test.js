import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import sharp from 'sharp';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {database,initialize} from '../backend/src/db.js';
import {OccTeam} from '../backend/src/occ-team.js';
import {createApp} from '../backend/src/app.js';
import {Storage} from '../backend/src/storage.js';
const token=r=>r.text.match(/name="csrf" value="([a-f0-9]{64})"/)?.[1];
test('OCC team profiles start honestly empty, preserve source identities, enforce versions and never change accounts',async()=>{
 const db=await database({url:'',dataDir:null});await initialize(db);const repo=new OccTeam(db,null);
 try{const all=await repo.all();assert.equal(all.length,6);assert.equal(all.filter(p=>p.gender==='female').length,3);assert.equal(all[0].work_status,'Belum diperbarui');assert.equal(all[0].photo_path,'');assert.deepEqual(all.map(p=>p.desk),['workstation-back-1','workstation-back-2','workstation-back-3','workstation-back-4','workstation-front-1','workstation-front-2']);
  await db.query("INSERT INTO fleetsync.users(name,username,password_hash,profile_photo) VALUES('Jaelani Surya Saputra','photo.user','not-a-login','uploads/"+'a'.repeat(48)+".webp')");assert.match((await repo.get('M10102')).photo_path,/uploads/);await repo.save({nik:'M10102',version:'0',bio:'Internship IT',work_status:'Aktif'});assert.equal((await repo.get('M10102')).version,1);await assert.rejects(repo.save({nik:'M10102',version:'0',bio:'Stale'}),e=>e.status===409);await assert.rejects(repo.save({nik:'not-a-person',version:'0'}),e=>e.status===404);assert.equal((await db.query('SELECT profile_photo FROM fleetsync.users')).rows[0].profile_photo,'uploads/'+'a'.repeat(48)+'.webp');
 }finally{await db.close();}
});
test('team photo upload, profile preview, permissions and CSRF stay authenticated',async()=>{
 const directory=await mkdtemp(path.join(os.tmpdir(),'occ-team-')),db=await database({url:'',dataDir:null});await initialize(db);const app=createApp({db,storage:new Storage({directory})}),admin=request.agent(app),password='Team-Fixture-2026';
 try{const setup=await admin.get('/setup');await admin.post('/setup').type('form').send({csrf:token(setup),name:'Team Admin',username:'team.admin',password,password_confirmation:password});const page=await admin.get('/occ-dashboard'),csrf=token(page),photo=await sharp({create:{width:32,height:32,channels:3,background:'#009daa'}}).png().toBuffer();
  assert.equal((await request(app).get('/3d-preview')).status,303);const studio=await admin.get('/3d-preview');assert.equal(studio.status,200);assert.match(studio.text,/data-dh3d/);assert.match(studio.text,/dh-premium-viewer\.js\?v=[a-f0-9]{16}/);assert.equal((await admin.get('/dh-3d-preview.html')).headers.location,'/3d-preview');assert.equal((await admin.get('/occ-team-form?nik=M10102')).status,200);assert.equal((await admin.get('/occ-team-photo?nik=M10102')).status,404);assert.equal((await admin.post('/occ-team-save').field('csrf','bad').field('nik','M10102')).status,419);
  const saved=await admin.post('/occ-team-save').field('csrf',csrf).field('nik','M10102').field('version','0').field('bio','Bertugas pada sistem IT OCC').field('work_status','Aktif').attach('profile_photo',photo,'portrait.png');assert.equal(saved.status,303,saved.text);const image=await admin.get('/occ-team-photo?nik=M10102');assert.equal(image.status,200);assert.match(image.headers['content-type'],/image\/webp/);assert.equal((await sharp(image.body).metadata()).width,32);assert.equal((await request(app).get('/occ-team-photo?nik=M10102')).status,303);
  const dashboard=await admin.get('/occ-dashboard');assert.match(dashboard.text,/Bertugas pada sistem IT OCC/);assert.match(dashboard.text,/occ-team-photo/);await admin.post('/account-create').type('form').send({csrf,name:'Viewer',username:'team.viewer',password,password_confirmation:password,current_password:password});const viewer=request.agent(app),login=await viewer.get('/login');await viewer.post('/login').type('form').send({csrf:token(login),username:'team.viewer',password});assert.equal((await viewer.get('/occ-team-form?nik=M10102')).status,403);assert.equal((await viewer.post('/occ-team-save').type('form').send({csrf,nik:'M10102'})).status,403);
 }finally{await db.close();assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir())+path.sep+'occ-team-'));await rm(directory,{recursive:true,force:true});}
});
