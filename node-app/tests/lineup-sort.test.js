import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,createHash} from 'node:crypto';
import request from 'supertest';
import {database,initialize} from '../backend/src/db.js';
import {createApp} from '../backend/src/app.js';
import {Repository} from '../backend/src/repository.js';
import {readSpreadsheet} from '../backend/src/spreadsheet.js';
import {filters} from '../backend/src/validation.js';

test('Line Up date sorting is chronological, keeps filters and matches Excel and CSV exports',async()=>{
 const db=await database({url:'',dataDir:null});await initialize(db);
 try{
  await db.query("INSERT INTO fleetsync.users(name,username,password_hash) VALUES('Sort viewer','sort.viewer','unused')");
  const token=randomBytes(32).toString('hex');
  await db.query("INSERT INTO fleetsync.sessions(id,user_id,csrf,expires_at) VALUES($1,1,$2,now()+interval '1 hour')",[createHash('sha256').update(token).digest('hex'),randomBytes(32).toString('hex')]);
  const rows=[['DT1','2025-12-31','D'],['DT2','2026-01-01','D'],['DT3','2026-10-26','D'],['DT4','2026-11-01','D'],['DT5','2026-10-26','N']];
  for(const [unit,day,shift]of rows)await db.query("INSERT INTO fleetsync.lineups(id,site,work_date,shift,unit,operator_name,nik) VALUES($1,'BCP',$2,$3,$1,'Sort fixture','0123')",[unit,day,shift]);
  const repo=new Repository(db,1);
  assert.deepEqual((await repo.lineups({site:'BCP',date_order:'oldest'})).map(row=>row.unit),['DT1','DT2','DT3','DT5','DT4']);
  assert.deepEqual((await repo.lineups({site:'BCP',date_order:'newest'})).map(row=>row.unit),['DT4','DT3','DT5','DT2','DT1']);
  const app=createApp({db});
  const get=path=>request(app).get(path).set('Cookie','fleetsync_node='+token);
  const query=new URLSearchParams({site:'BCP',shift:'D',search:'Sort fixture',date_order:'newest'});
  const page=await get('/lineup?'+query);
  assert.equal(page.status,200,page.text);
  assert.match(page.text,/aria-sort="descending"/);
  assert.match(page.text,/name="date_order" value="newest"/);
  const units=[...page.text.matchAll(/class="record-link unit-label"[^>]*>([^<]+)<\/a>/g)].map(match=>match[1]);
  assert.deepEqual(units,['DT4','DT3','DT2','DT1']);
  const toggle=page.text.match(/class="table-date-sort" href="([^"]+)"/)[1].replaceAll('&amp;','&');
  const target=new URL(toggle,'http://localhost');
  assert.equal(target.searchParams.get('date_order'),'oldest');
  assert.equal(target.searchParams.get('shift'),'D');
  assert.equal(target.searchParams.get('search'),'Sort fixture');
  const oldest=await get(toggle);
  assert.match(oldest.text,/aria-sort="ascending"/);
  assert.deepEqual([...oldest.text.matchAll(/class="record-link unit-label"[^>]*>([^<]+)<\/a>/g)].map(match=>match[1]),['DT1','DT2','DT3','DT4']);
  const csv=await get('/export?'+query+'&format=csv');
  assert.equal(csv.status,200);
  assert.deepEqual(readSpreadsheet(Buffer.from(csv.text),'csv').map(row=>row.unit),units);
  const excel=await get('/export?'+query).buffer(true).parse((response,done)=>{
   const chunks=[];response.on('data',chunk=>chunks.push(chunk));response.on('end',()=>done(null,Buffer.concat(chunks)));
  });
  assert.equal(excel.status,200);
  assert.deepEqual(readSpreadsheet(excel.body,'xlsx').map(row=>row.unit),units);
  const singleDate=await get('/lineup?'+query+'&work_date=2026-10-26');
  assert.deepEqual([...singleDate.text.matchAll(/class="record-link unit-label"[^>]*>([^<]+)<\/a>/g)].map(match=>match[1]),['DT3']);
  assert.throws(()=>filters({date_order:'DESC; DROP TABLE lineups'}),error=>error.status===422);
  assert.equal((await get('/lineup?date_order=invalid')).status,422);
  assert.equal(Number((await db.query('SELECT count(*) AS n FROM fleetsync.lineups')).rows[0].n),5);
 }finally{await db.close();}
});
