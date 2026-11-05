import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,rm,readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import sharp from 'sharp';
import bcrypt from 'bcryptjs';
import { database,initialize,one } from '../backend/src/db.js';
import { createApp } from '../backend/src/app.js';
import { Storage } from '../backend/src/storage.js';
import { Auth,passwordMatches } from '../backend/src/auth.js';
import { HEADERS,xlsx,csv,readSpreadsheet } from '../backend/src/spreadsheet.js';
import { zipSync,unzipSync,strToU8,strFromU8 } from 'fflate';
import { createHash } from 'node:crypto';

const token=response=>response.text.match(/name="csrf" value="([a-f0-9]{64})"/)?.[1];
const binary=(response,done)=>{const chunks=[];response.on('data',chunk=>chunks.push(chunk));response.on('end',()=>done(null,Buffer.concat(chunks)));};
test('JavaScript app parity using a real isolated PostgreSQL engine',async t=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),'fleetsync-node-test-'));
  const db=await database({dataDir:null});await initialize(db);
  const storage=new Storage({directory}),app=createApp({db,storage}),client=request.agent(app);
  let csrf,id,proof,operatorId;
  const password='Local-Integration-2026';
  const row={site:'BCP',work_date:'2026-11-04',shift:'D',type_category:'Production',unit:'qa-01',equipment:'HD',operator_name:'QA Operator',nik:'00001234',dh:'Ya',mine:'Tidak',ftw:'Belum dicek',source_status:'QA',note:'<script>alert(1)</script>'};
  try {
    await t.test('public assets and health need no database login',async()=>{
      assert.equal((await request(app).get('/health')).body.runtime,'node');
      assert.equal((await request(app).get('/assets/fonts/tt-firs-neue-bold.ttf')).status,200);
      assert.equal((await request(app).get('/assets/../backend/src/auth.js')).status,303);
    });
    await t.test('first run and CSRF-protected setup',async()=>{
      assert.equal((await client.get('/lineup')).headers.location,'/setup');
      const setup=await client.get('/setup');assert.equal(setup.status,200);csrf=token(setup);assert.ok(csrf);
      assert.equal((await client.post('/setup').type('form').send({csrf:'invalid'})).status,419);
      const result=await client.post('/setup').type('form').send({csrf,name:'First Manager',username:'manager',password,password_confirmation:password});
      assert.equal(result.status,303);assert.equal(result.headers.location,'/lineup');
      assert.equal(Number((await one(db,'SELECT count(*) AS n FROM fleetsync.users')).n),1);
      csrf=token(await client.get('/lineup'));assert.ok(csrf);
      assert.equal((await client.get('/setup')).headers.location,'/lineup');
    });
    await t.test('all authenticated screens render with the new template engine',async()=>{
      for(const page of ['lineup','dashboard','master','import','audit','profile','accounts','lineup-form','operator-form']) {
        const result=await client.get('/'+page);assert.equal(result.status,200,`${page}: ${result.text.slice(-200)}`);assert.ok(result.text.includes('TT Firs Neue')||result.text.includes('/assets/css/app.css'));
        assert.ok(!result.text.includes('<?php'));assert.ok(!result.text.includes('index.php'));
      }
    });
    await t.test('validated filters and mutating methods',async()=>{
      assert.equal((await client.get('/lineup?site=INVALID')).status,422);
      assert.equal((await client.get('/lineup?work_date=2026-02-31')).status,422);
      assert.equal((await client.get('/lineup-delete')).status,405);
      assert.equal((await client.post('/profile-save').type('form').send({csrf:'bad'})).status,419);
      assert.equal((await client.get('/lineup?search=%27%20OR%201=1')).status,200);
    });
    await t.test('create and fetch a lineup with private image evidence',async()=>{
      const png=await sharp({create:{width:2,height:2,channels:3,background:'#ff831e'}}).png().toBuffer();
      let req=client.post('/lineup-save');for(const [k,v] of Object.entries({...row,csrf,id:'',version:'0'})) req=req.field(k,v);
      const result=await req.attach('proof_mine',png,'proof.png');assert.equal(result.status,303,result.text);id=new URL(result.headers.location,'http://local').searchParams.get('id');assert.ok(id);
      const saved=await one(db,'SELECT * FROM fleetsync.lineups WHERE id=$1',[id]);assert.equal(saved.unit,'QA-01');assert.equal(saved.nik,'00001234');proof=saved.proof_mine;
      assert.ok(proof.startsWith('uploads/'));
      const media=await client.get('/media').query({path:proof});assert.equal(media.status,200);assert.deepEqual(media.body,png);
      const detail=await client.get('/detail').query({id});assert.equal(detail.status,200);assert.ok(!detail.text.includes('Catatan / temuan'));assert.ok(!detail.text.includes('Status sumber:'));assert.ok(!detail.text.includes('<script>alert(1)'));
      const master=await one(db,'SELECT * FROM fleetsync.operators WHERE nik=$1',['00001234']);operatorId=String(master.id);assert.equal(master.name,'QA Operator');
    });
    await t.test('optimistic locking and duplicate assignment protection',async()=>{
      assert.equal((await client.post('/lineup-save').type('form').send({...row,csrf,id,version:1,mine:'Ya',ftw:'Ya'})).status,303);
      assert.equal((await client.post('/lineup-save').type('form').send({...row,csrf,id,version:1,note:'STALE'})).status,409);
      const saved=await one(db,'SELECT * FROM fleetsync.lineups WHERE id=$1',[id]);assert.equal(saved.version,2);assert.notEqual(saved.note,'STALE');
      assert.equal((await client.post('/lineup-save').type('form').send({...row,csrf,id:'',version:0})).status,409);
      assert.equal(Number((await one(db,'SELECT count(*) AS n FROM fleetsync.lineups')).n),1);
    });
    await t.test('forged images roll back database changes',async()=>{
      let req=client.post('/lineup-save');for(const [k,v] of Object.entries({...row,csrf,id:'',version:'0',unit:'QA-FAKE'})) req=req.field(k,v);
      assert.equal((await req.attach('proof_ftw',Buffer.from('not an image'),'fake.png')).status,422);
      assert.equal(Number((await one(db,"SELECT count(*) AS n FROM fleetsync.lineups WHERE unit='QA-FAKE'")).n),0);
    });
    await t.test('operators retain leading zeros and deleting a profile preserves lineup history',async()=>{
      assert.equal((await client.post('/operator-delete').type('form').send({csrf,id:operatorId,version:1})).status,409);
      assert.equal((await client.post('/operator-delete').type('form').send({csrf,id:operatorId,version:2})).status,303);
      assert.equal(await one(db,'SELECT id FROM fleetsync.operators WHERE id=$1',[operatorId]),undefined);
      const preserved=await one(db,'SELECT operator_name,nik FROM fleetsync.lineups WHERE id=$1',[id]);assert.equal(preserved.operator_name,'QA Operator');assert.equal(preserved.nik,'00001234');assert.equal((await client.get('/detail?id='+id)).status,200);
      const data={csrf,id:'',version:0,site:'ACP',name:'Second Operator',nik:'00000099',unit:'unit-2',equipment:'EX',last_date:'2026-11-04'};
      assert.equal((await client.post('/operator-save').type('form').send(data)).status,303);
      const saved=await one(db,"SELECT * FROM fleetsync.operators WHERE site='ACP'");assert.equal(saved.nik,'00000099');
      assert.equal((await client.post('/operator-save').type('form').send(data)).status,409);
      assert.equal((await client.post('/operator-delete').type('form').send({csrf,id:saved.id,version:1})).status,303);
    });
    await t.test('Excel and CSV exports are real files with string NIK values',async()=>{
      const result=await client.get('/export').buffer(true).parse(binary);assert.equal(result.status,200);const doc=readSpreadsheet(result.body,'xlsx');assert.equal(doc[0].nik,'00001234');assert.equal(doc[0].mine,'Ya');
      const sheet=unzipSync(result.body);assert.ok(strFromU8(sheet['xl/worksheets/sheet1.xml']).includes('t="inlineStr"'));
      const text=await client.get('/export?format=csv');assert.equal(text.status,200);assert.ok(text.text.includes('00001234'));
    });
    const imported=['04/11/2026','SSCP','N','Support','QA-IMPORT','EX','Imported','00000088','Ya','Tidak','Belum dicek','','Imported note'];
    await t.test('imports are atomic and idempotent',async()=>{
      const before=Number((await one(db,'SELECT count(*) AS n FROM fleetsync.lineups')).n);
      const result=await client.post('/import').field('csrf',csrf).attach('spreadsheet',Buffer.from(csv([HEADERS,imported,imported])),'import.csv');assert.equal(result.status,303,result.text);
      assert.equal(Number((await one(db,'SELECT count(*) AS n FROM fleetsync.lineups')).n),before+1);
      const invalid=[...imported];invalid[0]='31/02/2026';invalid[4]='QA-INVALID';const valid=[...imported];valid[4]='QA-NO-PARTIAL';
      assert.equal((await client.post('/import').field('csrf',csrf).attach('spreadsheet',xlsx([HEADERS,valid,invalid]),'import.xlsx')).status,422);
      assert.equal(Number((await one(db,'SELECT count(*) AS n FROM fleetsync.lineups')).n),before+1);
      const repeat=await client.post('/import').field('csrf',csrf).attach('spreadsheet',xlsx([HEADERS,imported]),'repeat.xlsx');assert.equal(repeat.status,303);
    });
    await t.test('profile changes affect only the current session account',async()=>{
      const result=await client.post('/profile-save').type('form').send({csrf,id:999,name:'Updated Manager',username:'manager.updated'});assert.equal(result.status,303);
      assert.equal((await one(db,'SELECT name FROM fleetsync.users WHERE id=1')).name,'Updated Manager');
      assert.ok((await client.get('/profile')).text.includes('Updated Manager'));
    });
    await t.test('new accounts have equal access and password reauthentication',async()=>{
      const data={csrf,name:'Colleague',username:'colleague',password:'Colleague-Test-2026',password_confirmation:'Colleague-Test-2026',current_password:'wrong'};
      assert.equal((await client.post('/account-create').type('form').send(data)).status,422);
      data.current_password=password;assert.equal((await client.post('/account-create').type('form').send(data)).status,303);
      assert.equal((await client.post('/account-create').type('form').send(data)).status,409);
      assert.equal((await client.post('/profile-save').type('form').send({csrf,name:'Conflicting',username:'COLLEAGUE'})).status,409);
      await db.query("UPDATE fleetsync.users SET can_edit_data=true WHERE username='colleague'");
      const colleague=request.agent(app);const login=await colleague.get('/login');assert.equal((await colleague.post('/login').type('form').send({csrf:token(login),username:'COLLEAGUE',password:data.password})).status,303);
      assert.equal((await colleague.get('/accounts')).status,200);assert.equal((await colleague.get('/lineup-form')).status,200);
      const colleagueToken=token(await colleague.get('/accounts'));
      assert.equal((await colleague.post('/account-create').type('form').send({...data,csrf:colleagueToken,name:'Third',username:'third',current_password:data.password})).status,303);
      const audit=await client.get('/audit');assert.ok(audit.text.includes('account_create'));assert.ok(!audit.text.includes(data.password));
    });
    await t.test('simplified lineup form offers image previews and preserves omitted legacy metadata',async()=>{
      const before=await one(db,'SELECT * FROM fleetsync.lineups WHERE id=$1',[id]);
      const form=await client.get('/lineup-form?id='+id);
      assert.equal(form.status,200);assert.ok(!form.text.includes('name="note"'));assert.ok(!form.text.includes('name="source_status"'));
      assert.equal((form.text.match(/data-evidence-upload /g)||[]).length,2);assert.ok(form.text.includes('data-evidence-clear'));assert.ok(form.text.includes('data-current-url="/media?path='));
      assert.ok(form.headers['content-security-policy'].includes("img-src 'self' blob:"));
      const {note,source_status,...fields}=row;
      const result=await client.post('/lineup-save').type('form').send({...fields,csrf,id,version:before.version});assert.equal(result.status,303);
      const after=await one(db,'SELECT * FROM fleetsync.lineups WHERE id=$1',[id]);assert.equal(after.note,before.note);assert.equal(after.source_status,before.source_status);assert.equal(after.proof_mine,before.proof_mine);
    });
    await t.test('private routes and logout revoke access',async()=>{
      const guest=request.agent(app);assert.equal((await guest.get('/accounts')).headers.location,'/login');assert.equal((await guest.get('/media').query({path:proof})).headers.location,'/login');
      assert.equal((await client.post('/logout').type('form').send({csrf})).headers.location,'/login');
      assert.equal((await client.get('/lineup')).headers.location,'/login');
    });
    await t.test('login throttle is brief and survives new browser sessions',async()=>{
      const guest=request.agent(app),loginToken=token(await guest.get('/login'));
      for(let i=0;i<5;i++) assert.equal((await guest.post('/login').type('form').send({csrf:loginToken,username:'manager.updated',password:'wrong'})).status,422);
      const blocked=await guest.post('/login').type('form').send({csrf:loginToken,username:'manager.updated',password});
      assert.equal(blocked.status,429);assert.ok(Number(blocked.headers['retry-after'])<=30);assert.ok(!blocked.text.includes('15 menit'));
    });
    await t.test('PHP bcrypt password hashes remain compatible',async()=>{
      const hash=(await bcrypt.hash(password,10)).replace(/^\$2b\$/,'$2y$');assert.equal(await passwordMatches(password,hash),true);assert.equal(await passwordMatches('wrong',hash),false);
    });
    await t.test('remote activation is required and setup stays single-use',async()=>{
      const isolated=await database({dataDir:null});await initialize(isolated);
      try {
        const activation='owner-only-test-code',auth=new Auth(isolated,{production:true,activationHash:createHash('sha256').update(activation).digest('hex')}),req={body:{name:'Owner',username:'owner',password,password_confirmation:password},session:null},res={cookie(){}};
        await assert.rejects(auth.setup(req,res),e=>e.status===403);req.body.activation_code=activation;await auth.setup(req,res);assert.equal(await auth.needsSetup(),false);await assert.rejects(auth.setup(req,res),e=>e.status===409);
      } finally {await isolated.close();}
    });
  } finally {
    await db.close();
    assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir())+path.sep+'fleetsync-node-test-'));
    await rm(directory,{recursive:true,force:true});
  }
});

test('spreadsheet resource guards and text fidelity',async()=>{
  const row=['2026-11-04','BCP','','','TEST','EX','André & Putra','00001','Ya','No','','','Text'];
  assert.equal(readSpreadsheet(xlsx([HEADERS,row]),'xlsx')[0].operator_name,'André & Putra');
  assert.equal(readSpreadsheet(xlsx([HEADERS,row]),'xlsx')[0].shift,'Belum ditentukan');
  assert.throws(()=>readSpreadsheet(Buffer.from('fake'),'xls'),/Format/);
  const evil=zipSync({'xl/workbook.xml':strToU8('<!DOCTYPE workbook [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><workbook>&xxe;</workbook>')});assert.throws(()=>readSpreadsheet(Buffer.from(evil),'xlsx'),/entity/);
  const files=unzipSync(xlsx([HEADERS,row]));
  files['xl/workbook.xml']=strToU8(strFromU8(files['xl/workbook.xml']).replace('<sheets>','<workbookPr date1904="1"/><sheets>'));
  const sheet=strFromU8(files['xl/worksheets/sheet1.xml']).replace('<c r="A2" t="inlineStr"><is><t xml:space="preserve">2026-11-04</t></is></c>','<c r="A2"><v>44868</v></c>');files['xl/worksheets/sheet1.xml']=strToU8(sheet);
  assert.equal(readSpreadsheet(Buffer.from(zipSync(files)),'xlsx')[0].work_date,new Date(Date.parse('1904-01-01')+44868*86400000).toISOString().slice(0,10));
  assert.ok(csv([['=1+1']]).includes("'=1+1"));
});
