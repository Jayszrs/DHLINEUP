import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import sharp from 'sharp';
import { createApp } from '../backend/src/app.js';
import { database,initialize,one } from '../backend/src/db.js';
import { Mailer } from '../backend/src/mail.js';
import { readFile } from 'node:fs/promises';
const token=response=>response.text.match(/name="csrf" value="([a-f0-9]{64})"/)?.[1];
const password='Permission-Fixture-2026';
test('three approved accounts have data CRUD; other accounts retain read access',async t=>{
 const db=await database({dataDir:null});await initialize(db);
 const app=createApp({db,mailer:new Mailer({})}),admin=request.agent(app);
 try {
  const setup=await admin.get('/setup');await admin.post('/setup').type('form').send({csrf:token(setup),name:'Fixture Administrator',username:'jayszrs',password,password_confirmation:password});
  const adminToken=token(await admin.get('/accounts'));
  for(const username of ['tnazwar','yuliantobudi','viewer']) await admin.post('/account-create').type('form').send({csrf:adminToken,name:'Fixture '+username,username,password,password_confirmation:password,current_password:password,can_edit_data:true});
  await db.query("UPDATE fleetsync.users SET can_edit_data=true WHERE username IN ('tnazwar','yuliantobudi')");
  for(const username of ['jayszrs','tnazwar','yuliantobudi']) await t.test(`${username} can create, open, edit and delete Line Up and Operator`,async()=>{
   const agent=request.agent(app),login=await agent.get('/login');assert.equal((await agent.post('/login').type('form').send({csrf:token(login),username,password})).status,303);
   const csrf=token(await agent.get('/lineup'));
   const row={csrf,site:'BCP',work_date:'2026-11-04',shift:'D',type_category:'Production',unit:'QA-'+username,equipment:'HD',operator_name:'Fixture '+username,nik:'QA-'+username,dh:'Ya',mine:'Tidak',ftw:'Belum dicek',source_status:'QA',note:'QA',id:'',version:0};
   const created=await agent.post('/lineup-save').type('form').send(row);assert.equal(created.status,303);const id=new URL(created.headers.location,'http://local').searchParams.get('id');
   const list=await agent.get('/lineup');assert.ok(list.text.includes('class="record-link operator-name"'));assert.ok(list.text.includes('action="/lineup-delete"'));assert.ok(list.text.includes('href="/detail?id='+id+'"'));
   assert.equal((await agent.get('/detail?id='+id)).status,200);assert.equal((await agent.post('/lineup-save').type('form').send({...row,id,version:1,note:'Updated'})).status,303);
   const operator=await one(db,'SELECT * FROM fleetsync.operators WHERE nik=$1',[row.nik]);
   assert.equal((await agent.post('/operator-save').type('form').send({csrf,id:operator.id,version:operator.version,site:'BCP',name:'Changed Fixture',nik:row.nik,unit:row.unit,equipment:'HD',last_date:'2026-11-04'})).status,303);
   const operators=await agent.get('/master');assert.ok(operators.text.includes('class="record-link operator-name"'));assert.ok(!operators.text.includes('Master Operator'));
   assert.equal((await agent.post('/lineup-delete').type('form').send({csrf,id,version:2})).status,303);
   const updated=await one(db,'SELECT version FROM fleetsync.operators WHERE id=$1',[operator.id]);assert.equal((await agent.post('/operator-delete').type('form').send({csrf,id:operator.id,version:updated.version})).status,303);
   assert.equal(await one(db,'SELECT id FROM fleetsync.lineups WHERE id=$1',[id]),undefined);assert.equal(await one(db,'SELECT id FROM fleetsync.operators WHERE id=$1',[operator.id]),undefined);
  });
  await t.test('read-only member cannot bypass data permissions through direct URLs or form fields',async()=>{
   const agent=request.agent(app),login=await agent.get('/login');await agent.post('/login').type('form').send({csrf:token(login),username:'viewer',password});
   const page=await agent.get('/lineup'),csrf=token(page);assert.ok(!page.text.includes('Input Line Up'));assert.ok(!page.text.includes('Impor Excel / CSV'));assert.equal((await one(db,"SELECT can_edit_data FROM fleetsync.users WHERE username='viewer'")).can_edit_data,false);
   for(const path of ['/lineup-form','/operator-form','/import']) assert.equal((await agent.get(path)).status,403);
   for(const path of ['/lineup-save','/lineup-delete','/operator-save','/operator-delete','/import','/upload-ticket']) assert.equal((await agent.post(path).type('form').send({csrf,id:1,version:1,can_edit_data:true,is_admin:true})).status,403,path);
   await db.query("INSERT INTO fleetsync.operators(site,name,nik) VALUES('BCP','Read-only fixture','QA-read')");const operator=await one(db,"SELECT id FROM fleetsync.operators WHERE nik='QA-read'");
   const detail=await agent.get('/operator-form?id='+operator.id);assert.equal(detail.status,200);assert.ok(detail.text.includes('Profil Operator'));assert.ok(!detail.text.includes('action="/operator-save"'));
   assert.equal((await agent.get('/export?kind=master')).status,200);
  });
  await t.test('logo has transparent pixels and favicon uses symbol without letters',async()=>{
   const bytes=await sharp(await readFile(new URL('../frontend/assets/dh-symbol.svg',import.meta.url))).resize(1024,1024).png().toBuffer(),metadata=await sharp(bytes).metadata(),stats=await sharp(bytes).stats();
   assert.ok(metadata.hasAlpha);assert.equal(metadata.width,1024);assert.equal(stats.channels[3].min,0);
   const html=await request(app).get('/login');
   assert.ok(html.text.includes('type="image/svg+xml" href="/assets/dh-symbol.svg"'));
   assert.ok(html.text.includes('class="brand-wordmark brand-occ-name">DH</span>'));
   assert.ok(html.text.includes('class="brand-caption">Operation Command Center</span>'));
   assert.equal((await request(app).get('/assets/dh-symbol.svg')).status,200);
  });
 } finally {await db.close();}
});
