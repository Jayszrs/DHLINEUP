import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import {readFile} from 'node:fs/promises';
import {database,initialize,one} from '../backend/src/db.js';
import {OccRepository,OCC_SOURCE_ID,OCC_ITEMS,OCC_CCTV_SITES,parseOccSource,occStatusSummary,occSourceDate,occPhotoUrl,occFilters,occAssetGroup} from '../backend/src/occ.js';
import {occRoutes} from '../backend/src/occ-routes.js';
import {HttpError} from '../backend/src/validation.js';

function source(){
 const cctvHeader=['No.','Date','Day',...OCC_CCTV_SITES.map(s=>'CCTV '+s),'Issue Count','Overall','Notes'];
 const inventoryHeader=['No.','Date','Day',...OCC_ITEMS,'Issue Count','Overall','Notes'];
 const before=[[],[],[],[]];
 const all=keys=>keys.map(()=> 'OK'),unknown=keys=>keys.map(()=> 'Not Checked');
 return{spreadsheetId:OCC_SOURCE_ID,sheets:{
  'CCTV Availability':{values:[...before,cctvHeader,['1','04-Nov-2026','Wednesday','OK','OK','OK','Issue','OK','1','Issue','BCP issue'],['2','09-Nov-2026','Monday',...unknown(OCC_CCTV_SITES),'0','Not Checked'],['3','10-Nov-2026','Tuesday',...unknown(OCC_CCTV_SITES),'0','Not Checked'],['Summary','11-Nov-2026']]},
  'Inventory Availability':{values:[...before,inventoryHeader,['1','04-Nov-2026','Wednesday',...all(OCC_ITEMS),'0','OK'],['2','09-Nov-2026','Monday',...unknown(OCC_ITEMS),'0','Not Checked'],['3','10-Nov-2026','Tuesday',...unknown(OCC_ITEMS),'0','Not Checked'],['Summary','11-Nov-2026']]},
  'Inventory OCC':{values:[...before,['No.','Category','Inventory / Asset','Asset / Setup Code','Qty','Brand / Manufacturer','Model','Specifications','Related Device / Pair','Placement / Site','Availability','Condition','Documentation Photo','Photo Link','Notes'],['1','CCTV','CCTV JHO OCC','JHO-OCC','8','TBD','TBD','','','JHO / OCC','Available','Good','','Open Photo','Source note'],['2','PC Workstation','Lenovo PC','CC-OPT1','1','Lenovo','TBD','','Xiaomi','OCC','Available','Good'],['3','Monitor','Xiaomi Monitor','CC-OPT1','','Xiaomi','TBD','','Lenovo','OCC','To Check','TBD'],[],['No.','Device / Foto','','','Foto Tertanam'],['1','Speaker photo','','','','']]}
 }};
}
test('OCC parser imports only requested tables, preserves duplicate setup codes and unknown quantities',()=>{
 const parsed=parseOccSource(source());assert.equal(parsed.assets.length,3);assert.equal(parsed.checks.length,6);assert.equal(parsed.assets[2].qty,null);assert.equal(parsed.assets[1].asset_code,parsed.assets[2].asset_code);assert.notEqual(parsed.assets[1].id,parsed.assets[2].id);
 assert.equal(parsed.checks.find(r=>r.kind==='availability'&&r.work_date==='2026-11-10').statuses['T.MIC.01'],'Not Checked');
 assert.equal(occSourceDate('26-Agu-2026'),'2026-08-26');assert.equal(occSourceDate('16-Okt-2026'),'2026-10-16');assert.equal(occSourceDate('31-Feb-2026'),null);
 const missing=source();delete missing.sheets['Inventory OCC'];assert.throws(()=>parseOccSource(missing),/Sheet sumber/);
 assert.throws(()=>parseOccSource({...source(),spreadsheetId:'different-file'}),/tidak sesuai/);
 const bad=source();bad.sheets['CCTV Availability'].values[5][3]='Probably fine';assert.throws(()=>parseOccSource(bad),/Status sumber/);
});
test('unchecked and N/A statuses never become successful availability',()=>{
 assert.deepEqual(occStatusSummary({a:'Not Checked',b:'N/A'}),{total:2,ok:0,issue:0,unchecked:1,not_applicable:1,checked:0,availability_percent:null,completion_percent:0});
 const summary=occStatusSummary({a:'OK',b:'Issue',c:'Not Checked',d:'N/A'});assert.equal(summary.availability_percent,50);assert.equal(summary.completion_percent,200/3);
 assert.throws(()=>occPhotoUrl('javascript:alert(1)'),/HTTP/);assert.throws(()=>occPhotoUrl('https://user:password@example.com/image.png'),/HTTP/);assert.equal(occPhotoUrl('https://example.com/photo.png'),'https://example.com/photo.png');
});
test('OCC category filters partition all 50 units without changing global totals',async()=>{
 const db=await database({url:'',dataDir:null});await initialize(db);await db.exec(await readFile(new URL('../database/occ.sql',import.meta.url),'utf8'));
 try{
  const sample=source(),rows=[];
  const add=(category,count,quantity=1)=>{for(let i=0;i<count;i++)rows.push([String(rows.length+1),category,category+' fixture '+i,'GROUP-'+rows.length,String(typeof quantity==='function'?quantity(i):quantity),'Fixture','','','','OCC','Available','Good']);};
  add('Audio',17,i=>i===16?6:1);add('Display',1);add('Monitor',8);add('PC Workstation',8);add('CCTV',1,8);add('Camera',1);add('Control / Display',1);add('Accessory',1);
  sample.sheets['Inventory OCC'].values=sample.sheets['Inventory OCC'].values.slice(0,5).concat(rows);
  const repo=new OccRepository(db);await repo.importSource(sample);
  const groups=['audio','display','workstation','camera','control'],ids=new Set();let total=0;
  for(const group of groups){const data=await repo.data(occFilters({group}));assert.equal(data.summary.asset_records,38);assert.equal(data.summary.known_units,50);assert.equal(data.allAssets.length,38);for(const row of data.assets){assert.equal(occAssetGroup(row.category),group);assert.ok(!ids.has(row.id));ids.add(row.id);total+=row.qty;}}
  assert.equal(total,50);assert.equal(ids.size,38);
  const display=await repo.data(occFilters({group:'display'}));assert.equal(display.assets.length,9);assert.deepEqual([...new Set(display.assets.map(r=>r.category))].sort(),['Display','Monitor']);
  const camera=await repo.data(occFilters({group:'camera'}));assert.equal(camera.assets.length,2);assert.deepEqual(camera.assets.map(r=>r.category),['CCTV','Camera']);
  const control=await repo.data(occFilters({group:'control'}));assert.deepEqual(control.assets.map(r=>r.category),['Control / Display','Accessory']);
  assert.equal((await repo.data(occFilters({group:'display',search:'Monitor fixture'}))).assets.length,8);
  assert.equal(occFilters().group,'');assert.throws(()=>occFilters({group:'monitor'}),e=>e.status===422);
 }finally{await db.close();}
});
test('OCC import, editing, summaries and routes preserve manual data and permissions',async t=>{
 const db=await database({url:'',dataDir:null});await initialize(db);await db.exec(await readFile(new URL('../database/occ.sql',import.meta.url),'utf8'));
 await db.query("INSERT INTO fleetsync.users(name,username,password_hash,is_admin) VALUES('OCC Test','occ.test','unused',true)");
 const repo=new OccRepository(db,1);
 try{
  const imported=await repo.importSource(source());assert.equal(imported.assets,3);assert.equal(imported.checks,6);assert.equal((await repo.importSource(source())).already,true);
  const data=await repo.data({work_date:'2026-11-09'});assert.equal(data.summary.asset_records,3);assert.equal(data.summary.known_units,9);assert.equal(data.summary.unknown_quantity,1);assert.equal(data.summary.latest_checked_date,'2026-11-04');assert.equal(data.summary.daily_inventory.availability_percent,null);assert.equal(data.summary.daily_cctv.unchecked,5);assert.equal(data.availability.length,1);
  const checked=await repo.data({work_date:'2026-11-04'});assert.equal(checked.summary.daily_inventory.availability_percent,100);assert.equal(checked.summary.daily_cctv.availability_percent,80);assert.equal(checked.summary.cctv_jho_status,'OK');
  const issues=await repo.data({search:'Issue'});assert.ok(issues.cctv.length>0);assert.ok(issues.cctv.every(r=>Object.values(r.statuses).includes('Issue')));assert.equal((await repo.data({search:'does-not-exist'})).cctv.length,0);
  const asset=data.assets[0];await repo.saveAsset({...asset,qty:'8',notes:'Changed locally',version:String(asset.version)});await assert.rejects(repo.saveAsset({...asset,qty:'8',notes:'Stale edit',version:String(asset.version)}),e=>e.status===409);
  const refreshed=source();refreshed.sheets['Inventory OCC'].values[5][14]='Changed in Sheet';const again=await repo.importSource(refreshed);assert.equal(again.assets,0);assert.equal((await repo.asset(asset.id)).notes,'Changed locally');
  const input={work_date:'2026-11-09',version:'1',notes:'Local daily check',...Object.fromEntries(OCC_CCTV_SITES.map((_,i)=>['status_'+i,i===3?'Issue':'OK']))};await repo.saveCheck('cctv',input);await assert.rejects(repo.saveCheck('cctv',input),e=>e.status===409);assert.equal((await repo.check('cctv','2026-11-09')).statuses.BCP,'Issue');
  await assert.rejects(repo.saveCheck('availability',{work_date:'2026-11-09',version:'1',status_0:'OK'}),e=>e.status===422);
  const app=express();app.use(express.urlencoded({extended:false}));app.use((req,_res,next)=>{req.db=db;req.user={id:1,is_admin:req.headers['x-role']==='editor'};req.auth={csrf(request){if(request.body.csrf!=='valid-csrf')throw new HttpError(403,'CSRF invalid');},async flash(){}};next();});
  const view=(_req,res,page,locals)=>res.json({page,occPage:locals.occPage,kind:locals.occKind,summary:locals.occSummary,errorMessage:locals.errorMessage,row:locals.row});
  const url=(name,params={})=>'/'+name+(Object.keys(params).length?'?'+new URLSearchParams(params):'');occRoutes(app,view,url);app.use((error,_req,res,_next)=>res.status(error.status||500).json({error:error.message}));
  await t.test('viewers read dashboards and inventories but cannot forge changes',async()=>{for(const page of ['occ-dashboard','occ-cctv','occ-availability','occ-assets'])assert.equal((await request(app).get('/'+page)).status,200);assert.equal((await request(app).get('/occ-form')).status,403);assert.equal((await request(app).post('/occ-save').type('form').send({kind:'asset',csrf:'valid-csrf'})).status,403);});
  await t.test('editors need CSRF and receive conflict or validation details',async()=>{assert.equal((await request(app).post('/occ-save').set('x-role','editor').type('form').send({kind:'asset'})).status,403);const form=await request(app).get('/occ-form?kind=cctv&work_date=2026-11-09').set('x-role','editor');assert.equal(form.body.row.version,2);const conflict=await request(app).post('/occ-save').set('x-role','editor').type('form').send({...input,kind:'cctv',csrf:'valid-csrf'});assert.equal(conflict.status,409);assert.equal(conflict.body.page,'occ-form');const invalid=await request(app).post('/occ-save').set('x-role','editor').type('form').send({kind:'asset',name:'Unvalidated',category:'Camera',photo_url:'javascript:alert(1)',csrf:'valid-csrf'});assert.equal(invalid.status,422);});
  assert.ok(Number((await one(db,"SELECT count(*) AS n FROM fleetsync.audit_logs WHERE entity_type LIKE 'occ-%'")).n)>=4);
 }finally{await db.close();}
});
