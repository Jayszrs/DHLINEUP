import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import {gzipSync} from 'node:zlib';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {zipSync,unzipSync,strToU8,strFromU8} from 'fflate';
import {readSpeedSpreadsheet,GPS_HEADERS} from '../backend/src/speed-spreadsheet.js';
import {xlsx,csv} from '../backend/src/spreadsheet.js';
import {database,initialize,one} from '../backend/src/db.js';
import {createApp} from '../backend/src/app.js';
import {Storage} from '../backend/src/storage.js';
import {SpeedRepository,SpeedFiles} from '../backend/src/speed.js';
const headers=['Device ID','Device Name','Fleet Name','Speed','Altitude','Creation Time','Distance'];
const gps=(unit,day,time,speed)=>['00123',unit,'DT DARMA HENWA',speed,'43',`${day} ${time}`,'10'];
test('MDVR parser computes daily weighted inputs, deduplicates and preserves device IDs',()=>{
 const a=gps('DT2322','2026-10-17','10:00:00','10.5 km/h'),b=gps('DT2322','2026-10-17','10:01:00','0 km/h');
 const parsed=readSpeedSpreadsheet(Buffer.from(csv([headers,a,b,a])),'csv');assert.equal(parsed.duplicates,1);assert.equal(parsed.readings,2);assert.equal(parsed.daily[0].total_count,2);assert.equal(parsed.daily[0].moving_count,1);assert.equal(parsed.daily[0].speed_sum,10.5);assert.equal(parsed.daily[0].max_speed,10.5);assert.equal(parsed.daily[0].rows[0][0],'00123');assert.ok(parsed.daily[0].headers.includes('Distance'));
});
test('CSV accepts semicolon decimal commas, UTF16 tabs, local dates and filename fallback',()=>{
 const input='Creation Time;Speed\r\n17/10/2026 12:03:00;12,5 km/h';const p=readSpeedSpreadsheet(Buffer.from(input),'csv',{filename:'MDVR-DT2322.csv'});assert.equal(p.daily[0].speed_sum,12.5);assert.equal(p.daily[0].work_date,'2026-10-17');
 assert.equal(readSpeedSpreadsheet(Buffer.from('Device Name,Speed,Creation Time\nDT2322,10,2026-10-16T18:00:00Z'),'csv').daily[0].work_date,'2026-10-17');
 assert.equal(readSpeedSpreadsheet(Buffer.from('Device Name,Speed,Creation Time\nDT2322,10,2026-10-17 01:00:00.00\nDT2322,10,2026-10-16T18:00:00Z'),'csv').duplicates,1);
 const utf16=Buffer.concat([Buffer.from([255,254]),Buffer.from('Device Name\tSpeed\tCreation Time\r\nDT2376\t0\t2026-10-18 12:00:00','utf16le')]);assert.equal(readSpeedSpreadsheet(utf16,'csv').daily[0].unit,'DT2376');
});
test('XLSX reads every MDVR sheet, Excel serial timestamps and 1904 workbooks',()=>{
 const parts=unzipSync(xlsx([headers,gps('DT2322','2026-10-17','10:00:00','20')]));
 parts['xl/workbook.xml']=strToU8('<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="DT2322" r:id="rId1"/><sheet name="DT2376" r:id="rId2"/></sheets></workbook>');
 parts['xl/_rels/workbook.xml.rels']=strToU8('<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="worksheets/sheet2.xml"/></Relationships>');
 parts['xl/worksheets/sheet2.xml']=unzipSync(xlsx([headers,gps('DT2376','2026-10-18','10:00:00','30')]))['xl/worksheets/sheet1.xml'];const p=readSpeedSpreadsheet(Buffer.from(zipSync(parts)),'xlsx');assert.equal(p.daily.length,2);assert.equal(p.daily[1].unit,'DT2376');
 const serial=(Date.parse('2026-10-19T12:00:00Z')-Date.parse('1899-12-30'))/86400000;assert.equal(readSpeedSpreadsheet(xlsx([['Speed','Creation Time'],['10',serial]]),'xlsx',{unit:'DT2322'}).daily[0].rows[0][5],'2026-10-19 12:00:00');
 const v=unzipSync(xlsx([['Speed','Creation Time'],['10',serial-1462]]));v['xl/workbook.xml']=strToU8(strFromU8(v['xl/workbook.xml']).replace('<sheets>','<workbookPr date1904="1"/><sheets>'));assert.equal(readSpeedSpreadsheet(Buffer.from(zipSync(v)),'xlsx',{unit:'DT2322'}).daily[0].work_date,'2026-10-19');
});
test('bad dates, incomplete rows, conflicting duplicate GPS and average-only recaps fail entirely',()=>{
 for(const row of [gps('DT2322','2026-02-30','10:00:00','10'),gps('DT2322','2026-10-17','10:00:00',''),gps('BAD','2026-10-17','10:00:00','10'),gps('DT2322','2026-10-17','10:00:00','501')])assert.throws(()=>readSpeedSpreadsheet(Buffer.from(csv([headers,gps('DT2322','2026-10-17','09:00:00','10'),row])),'csv'),{status:422});
 assert.throws(()=>readSpeedSpreadsheet(Buffer.from(csv([headers,gps('DT2322','2026-10-17','10:00:00','10'),gps('DT2322','2026-10-17','10:00:00','20')])),'csv'),/nilai berbeda/);
 assert.throws(()=>readSpeedSpreadsheet(Buffer.from('Unit,Tanggal,Rata-rata\nDT2322,2026-10-17,15'),'csv'),{status:422});
});
test('MDVR file supports over 5000 readings while summary CSV requires reliable counts and sum',()=>{
 const rows=[headers];for(let i=0;i<6001;i++)rows.push(gps('DT2322','2026-10-17',new Date(Date.parse('2026-10-17T00:00:00Z')+i*1000).toISOString().slice(11,19),i%2?'10':'0'));assert.equal(readSpeedSpreadsheet(xlsx(rows),'xlsx').daily[0].total_count,6001);
 const r=readSpeedSpreadsheet(Buffer.from('Unit;Tanggal;Catatan;Bergerak;Jumlah Speed;Speed Tertinggi\nDT2322;17/10/2026;1.000;500;7.500,5;40'),'csv');assert.equal(r.kind,'recap');assert.equal(r.daily[0].total_count,1000);assert.equal(r.daily[0].speed_sum,7500.5);
});

test('speed import previews, commits atomically and protects other dates, GPS, permissions and newer edits',async t=>{
 const directory=await mkdtemp(path.join(os.tmpdir(),'dh-speed-import-')),db=await database({dataDir:null});await initialize(db);const storage=new Storage({directory}),app=createApp({db,storage}),admin=request.agent(app),password='Speed-Import-2026',token=r=>r.text.match(/name="csrf" value="([a-f0-9]{64})"/)?.[1];
 try{
  const setup=await admin.get('/setup');await admin.post('/setup').type('form').send({csrf:token(setup),name:'Import Administrator',username:'import.admin',password,password_confirmation:password});const csrf=token(await admin.get('/lineup')),repo=new SpeedRepository(db,1),files=new SpeedFiles(storage),base={unit:'DT2322',work_date:'2026-10-01',total_count:'10',moving_count:'5',speed_sum:'100',max_speed:'30',version:'0'};
  await repo.save(base);await repo.save({...base,work_date:'2026-10-17'});const old='speed/'+'b'.repeat(64)+'/1.json.gz';await files.put(old,gzipSync(JSON.stringify({rows:[GPS_HEADERS,[...gps('DT2322','2026-10-01','10:00:00','5').slice(0,6)],[...gps('DT2322','2026-10-17','10:00:00','55').slice(0,6)]]})));await db.query('UPDATE fleetsync.speed_units SET raw_path=$1,raw_count=2 WHERE unit=$2',[old,'DT2322']);
  const rawRows=[headers,gps('DT2322','2026-10-17','10:00:00','0'),gps('DT2322','2026-10-17','10:01:00','10'),gps('DT2322','2026-10-17','10:02:00','20'),gps('DT2322','2026-10-18','10:00:00','40'),gps('DT2376','2026-10-17','10:00:00','0'),gps('DT2322','2026-10-17','10:00:00','0')];
  const preview=async(bytes=Buffer.from(csv(rawRows)),name='MDVR-17-18.csv')=>admin.post('/speed-import-preview').field('csrf',csrf).attach('spreadsheet',bytes,name);
  let id;
  await t.test('dashboard has a dedicated import action, preview makes no changes and lists exact replacements',async()=>{
   assert.ok((await admin.get('/speed-dashboard')).text.includes('href="/speed-import"'));assert.equal((await admin.get('/speed-import')).status,200);const r=await preview();assert.equal(r.status,303);id=new URL(r.headers.location,'http://test').searchParams.get('job');const job=await one(db,'SELECT * FROM fleetsync.speed_import_jobs WHERE id=$1',[id]);assert.equal(job.metadata.added,2);assert.equal(job.metadata.replaced,1);assert.equal(job.metadata.duplicates,1);assert.equal((await repo.record('DT2322','2026-10-17')).total_count,10);assert.equal(await repo.record('DT2322','2026-10-18'),undefined);assert.equal((await admin.get(r.headers.location)).status,200);assert.equal((await admin.get('/speed-import-plan?job='+id)).status,200);
  });
  await t.test('commit requires confirmation and CSRF, updates just supplied unit dates, GPS and charts',async()=>{
   assert.equal((await admin.post('/speed-import-apply').type('form').send({csrf,job:id})).status,422);assert.equal((await admin.post('/speed-import-apply').type('form').send({csrf:'bad',job:id,confirm_replace:'1'})).status,419);
   assert.equal((await admin.post('/speed-import-apply').type('form').send({csrf,job:id,confirm_replace:'1'})).status,303);
   const r=await repo.record('DT2322','2026-10-17');assert.equal(r.total_count,3);assert.equal(Number(r.speed_sum),30);assert.equal(r.version,2);assert.equal((await repo.record('DT2322','2026-10-01')).total_count,10);assert.equal((await repo.record('DT2322','2026-10-18')).total_count,1);
   const gps=await repo.records('DT2322',{},files);assert.equal(gps.total,5);assert.equal(gps.rows.filter(r=>String(r[5]).startsWith('2026-10-17')).length,3);assert.equal((await repo.unit('DT2322')).raw_count,5);assert.equal((await repo.unit('DT2376')).raw_count,1);assert.equal((await repo.records('DT2322',{from:'2026-10-17',to:'2026-10-17'},files)).total,3);assert.equal((await repo.summary({from:'2026-10-17',to:'2026-10-18'})).average,14);assert.equal((await admin.get('/speed-dashboard')).status,200);assert.equal((await admin.get('/speed-unit?unit=DT2322&tab=gps')).status,200);
   await admin.post('/speed-import-apply').type('form').send({csrf,job:id,confirm_replace:'1'});assert.equal((await repo.record('DT2322','2026-10-17')).version,2);
  });
  await t.test('newer edits reject the entire import and preserve every untouched day',async()=>{
   const p=await preview(Buffer.from(csv([headers,gps('DT2322','2026-10-17','10:00:00','10'),gps('DT9999','2026-10-19','10:00:00','20')])));assert.equal(p.status,303);const job=new URL(p.headers.location,'http://test').searchParams.get('job');await repo.save({...base,work_date:'2026-10-17',version:'2'});const r=await admin.post('/speed-import-apply').type('form').send({csrf,job,confirm_replace:'1'});assert.equal(r.status,409);assert.equal((await repo.record('DT2322','2026-10-17')).version,3);assert.equal(await repo.record('DT9999','2026-10-19'),undefined);assert.equal(await one(db,"SELECT unit FROM fleetsync.speed_units WHERE unit='DT9999'"),undefined);
  });
  await t.test('summary imports keep GPS and signed upload tickets are consumed once and private',async()=>{
   const ticket='e'.repeat(64),object=`incoming/1/${ticket}.csv`,bytes=Buffer.from('Unit,Tanggal,Catatan,Bergerak,Jumlah Speed,Speed Tertinggi\nDT2322,2026-10-18,10,5,100,30');await storage.put(object,bytes);await db.query("INSERT INTO fleetsync.upload_tickets(id,user_id,path,kind,extension,expires_at) VALUES($1,1,$2,'spreadsheet','csv',now()+interval '1 hour')",[ticket,object]);
   const p=await admin.post('/speed-import-preview').type('form').send({csrf,spreadsheet_ticket:ticket,filename:'rekap.csv'});assert.equal(p.status,303);const job=new URL(p.headers.location,'http://test').searchParams.get('job');assert.ok((await one(db,'SELECT consumed_at FROM fleetsync.upload_tickets WHERE id=$1',[ticket])).consumed_at);await admin.post('/speed-import-apply').type('form').send({csrf,job,confirm_replace:'1'});assert.equal((await repo.record('DT2322','2026-10-18')).total_count,10);assert.equal((await repo.records('DT2322',{from:'2026-10-18',to:'2026-10-18'},files)).total,1);assert.equal((await admin.post('/speed-import-preview').type('form').send({csrf,spreadsheet_ticket:ticket})).status,422);assert.equal((await admin.get('/assets/'+object)).status,404);
  });
  await t.test('viewers cannot import; other editors cannot inspect or apply another users preview',async()=>{
   await admin.post('/account-create').type('form').send({csrf,name:'Import Viewer',username:'import.viewer',password,password_confirmation:password,current_password:password});const viewer=request.agent(app),login=await viewer.get('/login');await viewer.post('/login').type('form').send({csrf:token(login),username:'import.viewer',password});const page=await viewer.get('/speed-dashboard'),vcsrf=token(page);assert.ok(!page.text.includes('href="/speed-import"'));for(const route of ['/speed-import','/speed-import?job='+id,'/speed-import-plan?job='+id])assert.equal((await viewer.get(route)).status,403);for(const route of ['/speed-import-preview','/speed-import-apply'])assert.equal((await viewer.post(route).type('form').send({csrf:vcsrf,job:id,confirm_replace:'1'})).status,403);
   await db.query("UPDATE fleetsync.users SET can_edit_data=true WHERE username='import.viewer'");assert.equal((await viewer.get('/speed-import?job='+id)).status,404);assert.equal((await viewer.post('/speed-import-apply').type('form').send({csrf:vcsrf,job:id,confirm_replace:'1'})).status,404);
   assert.equal(Number((await one(db,'SELECT count(*) AS n FROM fleetsync.lineups')).n),0);assert.equal(Number((await one(db,'SELECT count(*) AS n FROM fleetsync.operators')).n),0);
  });
 }finally{await db.close();assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir())+path.sep+'dh-speed-import-'));await rm(directory,{recursive:true,force:true});}
});
