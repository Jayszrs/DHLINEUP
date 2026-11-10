import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import {unzipSync,strFromU8} from 'fflate';
import {database,initialize} from '../backend/src/db.js';
import {SpeedRepository} from '../backend/src/speed.js';
import {verifiedSpeedStats} from '../backend/src/speed-quality.js';
import {speedExport} from '../backend/src/speed-export.js';
import {reportWorkbook} from '../backend/src/report-workbook.js';
import {OccMeetings,meetingLocal,meetingInput} from '../backend/src/occ-meetings.js';
import {createApp} from '../backend/src/app.js';
const xml=(bytes,path)=>strFromU8(unzipSync(bytes)[path]);
test('XLSX report has numeric cells, frozen styled headers, text IDs and safe text',()=>{
 const bytes=reportWorkbook([{name:'Report',title:'DHOCC',subtitle:'Period',rows:[['ID','Speed','Ratio'],['00123',14.04,.785],['=HYPERLINK("bad")',null,0]],percentColumns:[2]}]);
 const sheet=xml(bytes,'xl/worksheets/sheet1.xml');assert.match(sheet,/<c r="B6" s="2"><v>14.04<\/v>/);assert.match(sheet,/00123/);assert.ok(!sheet.includes('<f>'));assert.match(sheet,/ySplit="5"/);assert.match(sheet,/autoFilter ref="A5:C7"/);assert.match(xml(bytes,'xl/styles.xml'),/FFAA581A/);
});
test('speed policy removes >=80 readings only when raw counts and sums reconcile',()=>{
 const rows=[['Speed'],['0 km/h'],['40.00 km/h'],['79,99 km/jam'],['80 km/h'],['101.06 km/h']],expected={total_count:5,moving_count:4,speed_sum:301.05,max_speed:101.06};
 const clean=verifiedSpeedStats(rows,expected);assert.deepEqual(clean,{total_count:3,moving_count:2,speed_sum:119.99,max_speed:79.99,anomaly_count:2});assert.equal(verifiedSpeedStats(rows.slice(0,-1),expected),null);assert.equal(verifiedSpeedStats(rows,{...expected,speed_sum:300}),null);
});
test('date filtering and Excel include all matching unit/day detail, preserve source and invalidate stale quality',async()=>{
 const db=await database({url:'',dataDir:null});await initialize(db);
 try{await db.query("INSERT INTO fleetsync.speed_units(unit) VALUES('DT1'),('DT2'),('DT3')");for(const day of ['2026-10-01','2026-10-05','2026-10-15','2026-10-16'])for(const unit of ['DT1','DT2'])await db.query('INSERT INTO fleetsync.speed_daily(unit,work_date,total_count,moving_count,speed_sum,max_speed) VALUES($1,$2,10,5,100,40)',[unit,day]);
 const repo=new SpeedRepository(db,null),filters={from:'2026-10-01',to:'2026-10-15'};assert.equal((await repo.summary(filters)).total_count,60);assert.deepEqual((await repo.daily({...filters,to:'2026-10-05'})).map(r=>r.work_date),['2026-10-01','2026-10-05']);assert.equal((await repo.units(filters)).length,2);
 const output=await speedExport(repo,filters,'daily');const detail=xml(output.bytes,'xl/worksheets/sheet2.xml');assert.equal((detail.match(/<row /g)||[]).length,10);assert.ok(!detail.includes('2026-10-16'));assert.match(detail,/2026-10-15/);assert.match(detail,/DT2/);
 await db.query("UPDATE fleetsync.speed_daily SET max_speed=100,speed_sum=100,total_count=2,moving_count=1 WHERE unit='DT1' AND work_date='2026-10-01'");let summary=await repo.summary({from:'2026-10-01',to:'2026-10-01',unit:'DT1'});assert.equal(summary.total_count,0);assert.equal(Number(summary.pending_count),2);assert.equal(summary.max_speed,null);
 await db.query("INSERT INTO fleetsync.speed_quality_daily(unit,work_date,source_version,source_count,source_sum,source_max,total_count,moving_count,speed_sum,max_speed,anomaly_count) VALUES('DT1','2026-10-01',1,2,100,100,1,0,0,0,1)");summary=await repo.summary({unit:'DT1',from:'2026-10-01',to:'2026-10-01'});assert.equal(summary.total_count,1);assert.equal(Number(summary.anomaly_count),1);
 await db.query("UPDATE fleetsync.speed_daily SET version=2 WHERE unit='DT1' AND work_date='2026-10-01'");assert.equal(Number((await repo.summary({unit:'DT1',from:'2026-10-01',to:'2026-10-01'})).pending_count),2);
 }finally{await db.close();}
});
test('OCC meetings enforce WIB dates, safe links, overlaps and optimistic versions',async()=>{
 const db=await database({url:'',dataDir:null});await initialize(db);const repo=new OccMeetings(db,null),input={title:'Review OCC',start_at:'2026-11-10T09:00',end_at:'2026-11-10T10:00',meeting_url:'https://meet.google.com/abc-defg-hij',notes:'Agenda',version:'0'};
 try{assert.equal(await repo.save(input),'2026-11-10');const [row]=await repo.list('2026-11-10');assert.equal(meetingLocal(row.start_at),input.start_at);assert.equal((await repo.list('2026-11-09')).length,0);await assert.rejects(repo.save({...input,title:'Overlap'}),e=>e.status===409);await repo.save({...input,start_at:'2026-11-10T10:00',end_at:'2026-11-10T11:00'});await assert.rejects(repo.save({...input,id:String(row.id),version:'99'}),e=>e.status===409);assert.throws(()=>meetingInput({...input,meeting_url:'javascript:alert(1)'}),e=>e.status===422);assert.throws(()=>meetingInput({...input,end_at:input.start_at}),e=>e.status===422);assert.throws(()=>meetingInput({...input,start_at:'2026-02-30T09:00'}),e=>e.status===422);await repo.remove({id:String(row.id),version:'1'});assert.equal((await repo.list('2026-11-10')).length,1);
 }finally{await db.close();}
});
test('meeting and photo routes require authenticated access; meeting writes require editor and CSRF',async()=>{
 const db=await database({url:'',dataDir:null});await initialize(db);const app=createApp({db}),admin=request.agent(app),password='Meeting-Fixture-2026',token=r=>r.text.match(/name="csrf" value="([a-f0-9]{64})"/)?.[1];
 try{const setup=await admin.get('/setup');await admin.post('/setup').type('form').send({csrf:token(setup),name:'Admin',username:'meeting.admin',password,password_confirmation:password});const page=await admin.get('/occ-dashboard');assert.equal(page.status,200);assert.match(page.text,/Jadwal meeting OCC/);assert.equal((await admin.get('/occ-meeting-form')).status,200);assert.equal((await admin.post('/occ-meeting-save').type('form').send({csrf:'bad'})).status,419);assert.equal((await request(app).get('/occ-documentation?id=x')).status,303);assert.equal((await request(app).get('/occ-photo?id=x')).status,303);
 const csrf=token(page);await admin.post('/account-create').type('form').send({csrf,name:'Viewer',username:'meeting.viewer',password,password_confirmation:password,current_password:password});const viewer=request.agent(app),login=await viewer.get('/login');await viewer.post('/login').type('form').send({csrf:token(login),username:'meeting.viewer',password});assert.equal((await viewer.get('/occ-meeting-form')).status,403);const viewerPage=await viewer.get('/occ-dashboard');assert.equal((await viewer.post('/occ-meeting-save').type('form').send({csrf:token(viewerPage)})).status,403);
 }finally{await db.close();}
});
