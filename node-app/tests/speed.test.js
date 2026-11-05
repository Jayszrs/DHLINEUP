import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import {gzipSync} from 'node:zlib';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {database,initialize,one} from '../backend/src/db.js';
import {createApp} from '../backend/src/app.js';
import {Storage} from '../backend/src/storage.js';
import {SpeedRepository,SpeedFiles} from '../backend/src/speed.js';
const token=r=>r.text.match(/name="csrf" value="([a-f0-9]{64})"/)?.[1];
test('speed module preserves weighted recaps, GPS archives, permissions and Line Up data',async t=>{
 const directory=await mkdtemp(path.join(os.tmpdir(),'dh-speed-')),db=await database({dataDir:null});await initialize(db);const storage=new Storage({directory}),app=createApp({db,storage}),admin=request.agent(app),password='Speed-Fixture-2026';
 try {
  const setup=await admin.get('/setup');await admin.post('/setup').type('form').send({csrf:token(setup),name:'Speed Administrator',username:'speed.admin',password,password_confirmation:password});const csrf=token(await admin.get('/lineup')),repo=new SpeedRepository(db,1);
  const base={unit:'DT2322',work_date:'2026-10-01',total_count:'10',moving_count:'5',speed_sum:'100',max_speed:'30',version:'0'};
  await repo.save(base);await repo.save({...base,work_date:'2026-10-02',total_count:'90',moving_count:'45',speed_sum:'1800',max_speed:'50'});
  await t.test('fleet averages use summed readings instead of averaging per-day averages',async()=>{const summary=await repo.summary();assert.equal(summary.total_count,100);assert.equal(summary.moving_count,50);assert.equal(summary.average,19);assert.equal(summary.moving_average,38);assert.equal(summary.max_speed,50);assert.equal(summary.stopped_count,50);});
  await t.test('reports render, native nested menu is active, import is confined to Line Up and documentation redirects',async()=>{
   for(const route of ['/speed-dashboard','/speed-daily','/speed-monthly','/speed-units','/speed-unit?unit=DT2322','/speed-form?unit=DT2322&work_date=2026-10-01']) {const r=await admin.get(route);assert.equal(r.status,200,route+': '+r.text.slice(-200));assert.ok(r.text.includes('Recap Fleet Speed Monitoring'));assert.ok(!r.text.includes('>Dokumentasi</a>'));assert.ok(!r.text.includes('header-import'));}
   const line=await admin.get('/lineup');assert.ok(line.text.includes('href="/import"'));const speed=await admin.get('/speed-dashboard');assert.ok(!speed.text.includes('href="/import"'));assert.ok(speed.text.includes('<details class="nav-group" open>'));assert.equal((await admin.get('/dokumentasi')).headers.location,'/lineup');
   assert.equal((await admin.get('/speed-export?kind=daily')).status,200);
  });
  await t.test('dashboard comparison and recaps follow weighted date filters and empty periods',async()=>{
   const dashboard=await admin.get('/speed-dashboard');assert.equal(dashboard.status,200);assert.ok(dashboard.text.includes('Semua: 19,00 km/jam; bergerak: 38,00 km/jam'));assert.ok(dashboard.text.includes('Rekap harian terbaru'));assert.ok(dashboard.text.includes('Ringkasan bulanan fleet'));assert.ok(dashboard.text.includes('data-comparison-mode="detail"'));
   const filtered=await admin.get('/speed-dashboard?from=2026-10-01&to=2026-10-01');assert.equal(filtered.status,200);assert.ok(filtered.text.includes('Semua: 10,00 km/jam; bergerak: 20,00 km/jam'));assert.ok(!filtered.text.includes('Semua: 19,00 km/jam;'));
   const empty=await admin.get('/speed-dashboard?from=2027-01-01');assert.equal(empty.status,200);assert.ok(empty.text.includes('Belum ada unit berdata pada periode ini'));assert.ok(!empty.text.includes('class="comparison-bar all"'));
  });
  await t.test('manual save validates counts, applies optimistic versions and can delete one recap only',async()=>{
   assert.equal((await admin.post('/speed-save').type('form').send({...base,csrf,unit:'DT2695',moving_count:'11'})).status,422);
   const created=await admin.post('/speed-save').type('form').send({...base,csrf,unit:'DT2695'});assert.equal(created.status,303);assert.equal((await admin.post('/speed-save').type('form').send({...base,csrf,unit:'DT2695'})).status,409);
   assert.equal((await admin.post('/speed-save').type('form').send({...base,csrf,unit:'DT2695',version:'1',speed_sum:'110'})).status,303);
   assert.equal((await admin.post('/speed-delete').type('form').send({...base,csrf,unit:'DT2695',version:'1'})).status,409);
   assert.equal((await admin.post('/speed-delete').type('form').send({...base,csrf,unit:'DT2695',version:'2'})).status,303);assert.equal(await repo.record('DT2695',base.work_date),undefined);assert.ok(await repo.record('DT2322',base.work_date));
   assert.equal((await admin.post('/speed-save').type('form').send({...base,csrf:'bad'})).status,419);
  });
  await t.test('private GPS rows keep source columns and paginate without losing original values',async()=>{
   const name='speed/'+'a'.repeat(64)+'/123.json.gz',rows=[['Device ID','Device Name','Fleet Name','Speed','Altitude','Creation Time','Location','Precision','Direct','Satellites','IO Status','Emergency','ACC State','Speed Numeric (km/jam)','Tanggal GPS']];for(let i=0;i<201;i++)rows.push(['00123','DT2322','DT DARMA HENWA','12.34 km/h','43.0','2026-10-01 10:00:00','117.5,0.79','','','','','No','on','12,34 km/jam','01 Okt 2026']);
   const files=new SpeedFiles(storage);await files.put(name,gzipSync(JSON.stringify({rows})));await db.query('UPDATE fleetsync.speed_units SET raw_path=$1,raw_count=201 WHERE unit=$2',[name,'DT2322']);
   const page=await repo.records('DT2322',{},files,3);assert.equal(page.total,201);assert.equal(page.pages,3);assert.equal(page.rows.length,1);assert.equal(page.rows[0][0],'00123');assert.equal((await admin.get('/speed-unit?unit=DT2322&tab=gps&raw_page=3')).status,200);assert.equal((await admin.get('/assets/'+name)).status,404);
  });
  await t.test('read-only users can view speed but cannot forge editor access or mutate recaps',async()=>{
   await admin.post('/account-create').type('form').send({csrf,name:'Speed Viewer',username:'speed.viewer',password,password_confirmation:password,current_password:password});const viewer=request.agent(app),login=await viewer.get('/login');await viewer.post('/login').type('form').send({csrf:token(login),username:'speed.viewer',password});const page=await viewer.get('/speed-dashboard');assert.equal(page.status,200);assert.ok(!page.text.includes('Input rekap speed'));assert.equal((await viewer.get('/speed-form')).status,403);for(const action of ['speed-save','speed-delete'])assert.equal((await viewer.post('/'+action).type('form').send({...base,csrf:token(page),is_admin:true,can_edit_data:true})).status,403);
   assert.equal(Number((await one(db,'SELECT count(*) AS n FROM fleetsync.lineups')).n),0);assert.equal(Number((await one(db,'SELECT count(*) AS n FROM fleetsync.operators')).n),0);
  });
 }finally{await db.close();assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir())+path.sep+'dh-speed-'));await rm(directory,{recursive:true,force:true});}
});
