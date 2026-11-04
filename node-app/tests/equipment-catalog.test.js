import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { database,initialize,one } from '../backend/src/db.js';
import { createApp } from '../backend/src/app.js';
import { equipmentOptions } from '../backend/src/catalog.js';
import { readSpreadsheet,xlsx,HEADERS,exportRows } from '../backend/src/spreadsheet.js';
const token=r=>r.text.match(/name="csrf" value="([a-f0-9]{64})"/)?.[1];

test('shared equipment catalog preserves old models and separates searchable equipment fields',async()=>{
  const db=await database({dataDir:null});await initialize(db);
  const client=request.agent(createApp({db})),password='Catalog-Fixture-2026';
  try {
    const start=await client.get('/setup');await client.post('/setup').type('form').send({csrf:token(start),name:'Fixture Administrator',username:'catalog.admin',password,password_confirmation:password});
    await db.query("INSERT INTO fleetsync.operators(site,name,nik,unit,equipment) VALUES('BCP','Fixture','QA-catalog','EX4051','R9200')");
    let form=await client.get('/lineup-form'),csrf=token(form);
    assert.equal(form.status,200);assert.equal((form.text.match(/data-search-select/g)||[]).length,3);
    const options=await equipmentOptions(db);assert.ok(options.unit.includes('DT4044'));assert.ok(options.unit.includes('DT2317'));assert.ok(options.unit.includes('EX4051'));assert.ok(options.model.includes('R9200'));assert.ok(options.model.includes('CAT 777'));assert.equal(options.unit.filter(v=>/^DT\d+$/.test(v)).length,178);
    assert.equal((await client.post('/equipment-option').send({csrf:'bad',category:'kind',value:'Loader'})).status,419);
    for(const category of ['kind','model']) {const value=category==='kind'?'Wheel Loader':'CAT 992';assert.equal((await client.post('/equipment-option').send({csrf,category,value})).body.value,value);assert.equal((await client.post('/equipment-option').send({csrf,category,value:value.toLowerCase()})).status,200);}
    assert.equal(Number((await one(db,'SELECT count(*) AS n FROM fleetsync.equipment_options')).n),2);
    assert.equal((await client.post('/equipment-option').send({csrf,category:'unit',value:'BAD'})).status,422);
    assert.equal((await client.post('/equipment-option').send({csrf,category:'kind',value:'x'.repeat(101)})).status,422);
    const row={csrf,id:'',version:0,site:'BCP',work_date:'2026-11-04',unit:'DT4044',equipment_kind:'Dump Truck',equipment:'CAT 777',operator_name:'Fixture Driver',nik:'QA-007'};
    const saved=await client.post('/lineup-save').type('form').send(row);assert.equal(saved.status,303);const id=new URL(saved.headers.location,'http://fixture').searchParams.get('id');
    const result=await one(db,'SELECT * FROM fleetsync.lineups WHERE id=$1',[id]);assert.equal(result.equipment_kind,'Dump Truck');assert.equal(result.equipment,'CAT 777');
    const operator=await one(db,"SELECT * FROM fleetsync.operators WHERE nik='QA-007'");assert.equal(operator.equipment_kind,'Dump Truck');
    const {equipment_kind,...legacy}=row;assert.equal((await client.post('/lineup-save').type('form').send({...legacy,id,version:1})).status,303);assert.equal((await one(db,'SELECT equipment_kind FROM fleetsync.lineups WHERE id=$1',[id])).equipment_kind,'Dump Truck');
    const roundtrip=readSpreadsheet(xlsx(exportRows([result])),'xlsx')[0];assert.equal(roundtrip.equipment_kind,'Dump Truck');assert.equal(roundtrip.equipment,'CAT 777');
    const oldHeaders=HEADERS.slice(0,13).map(v=>v==='Tipe Alat'?'Jenis Alat':v);
    const old=readSpreadsheet(xlsx([oldHeaders,['2026-11-04','BCP','','','DT1234','HD785','Fixture','0001']]),'xlsx')[0];assert.equal(old.equipment,'HD785');assert.equal(old.equipment_kind,'');
    await db.query('UPDATE fleetsync.users SET is_admin=false,can_edit_data=false');
    assert.equal((await client.post('/equipment-option').send({csrf,category:'kind',value:'Forbidden'})).status,403);
    assert.equal(Number((await one(db,"SELECT count(*) AS n FROM fleetsync.equipment_options WHERE value='Forbidden'")).n),0);
  } finally {await db.close();}
});
