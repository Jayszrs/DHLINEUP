import test from 'node:test';
import assert from 'node:assert/strict';
import {database,initialize} from '../backend/src/db.js';
import {parseGpsLocation,parseGpsSpeed,gpsWibSeconds,gpsContinuous,sampleSpeedRoute,speedMapSignature,speedMapPayloadDigest,loadSpeedMap,speedMapViewBounds} from '../backend/src/speed-map.js';

const headers=['Device Name','Location','Creation Time','Speed Numeric (km/jam)'];
const row=(second,{lat=.8,lon=117.5,speed=20,day='2026-10-23',unit='DT2322'}={})=>[unit,lon+','+lat,day+' '+String(Math.floor(second/3600)).padStart(2,'0')+':'+String(Math.floor(second/60)%60).padStart(2,'0')+':'+String(second%60).padStart(2,'0'),String(speed)];
test('map coordinates retain source longitude/latitude order and reject unusable fixes',()=>{
 assert.deepEqual(parseGpsLocation('117.500123, 0.812345'),[.812345,117.500123]);assert.deepEqual(parseGpsLocation('-75.2; -10.4'),[-10.4,-75.2]);
 for(const value of['0,0','181,1','117,91','not a point','117,0,1','1e2,1',null])assert.equal(parseGpsLocation(value),null);
 assert.equal(gpsWibSeconds('2026-10-23 23:59:59','2026-10-23'),86399);assert.equal(gpsWibSeconds('2026-10-24 00:00:00','2026-10-23'),null);assert.equal(gpsWibSeconds('2026-10-23 24:00:00','2026-10-23'),null);assert.equal(gpsWibSeconds('2026-10-23 12:30:00Z','2026-10-23'),null);
 assert.equal(gpsWibSeconds('2026-10-16 9:59:22','2026-10-16'),35962);assert.equal(parseGpsSpeed('13,63 km/jam'),13.63);assert.equal(parseGpsSpeed('13.63 km/h'),13.63);assert.equal(parseGpsSpeed('0,00 km/jam'),0);assert.ok(Number.isNaN(parseGpsSpeed('13,63,00')));
});
test('map sampling keeps original fixes, endpoint speeds and discontinuities within its point budget',()=>{
 const rows=Array.from({length:1200},(_,i)=>row(i*60,{lon:117.5+i*.00001,speed:i%51}));
 const route=sampleSpeedRoute('DT2322',rows.reverse(),headers,'2026-10-23');assert.ok(route.points.length<=240);assert.equal(route.source_count,1200);assert.equal(route.points[0][2],0);assert.equal(route.points.at(-1)[2],71940);assert.equal(route.points[0][3],0);assert.equal(route.points.at(-1)[3],1199%51);
 const originals=new Set(rows.map(r=>JSON.stringify([Number(r[1].split(',')[1]),Number(r[1].split(',')[0]),gpsWibSeconds(r[2],'2026-10-23'),Number(r[3])])));for(const point of route.points)assert.ok(originals.has(JSON.stringify(point)));
 const gaps=sampleSpeedRoute('DT2322',[row(0),row(60,{lon:117.5001}),row(4000,{lon:117.501}),row(4060,{lon:117.5011}),row(4120,{lon:120}),row(4180,{lon:117.5012})],headers,'2026-10-23');assert.deepEqual(gaps.breaks,[2,4,5]);assert.equal(gaps.segments.length,4);assert.equal(gpsContinuous(gaps.points[3],gaps.points[4]),false);
 const invalid=sampleSpeedRoute('DT2322',[row(0),['DT2322','0,0','2026-10-23 00:00:20','0'],row(40,{unit:'DT9999'}),row(50,{day:'2026-10-24'}),['DT2322','117.5,.8','2026-10-23 00:01:00','20']],headers,'2026-10-23');assert.equal(invalid.source_count,3);assert.equal(invalid.invalid_count,2);assert.equal(invalid.points.length,1);
 assert.deepEqual(invalid.invalid_reasons,{location:2,time:0,speed:0});
 const legacy=sampleSpeedRoute('DT2322',[['DT2322','117.5,0.8','2026-10-16 9:59:22','13,63 km/jam']],headers,'2026-10-16');assert.equal(legacy.points.length,1);assert.equal(legacy.points[0][3],13.63);
});
test('dominant map viewport excludes remote fixes from initial fit while preserving all original route coordinates',()=>{
 const points=Array.from({length:1000},(_,i)=>[.8+i*.000001,117.5+i*.000001,i,20]);points.push([40,-70,2000,10]);const routes=[{unit:'DT2322',points}],copy=JSON.stringify(routes);
 const viewport=speedMapViewBounds(routes);assert.equal(viewport.outlierSampleCount,1);assert.equal(viewport.outlierCount,1);assert.equal(viewport.outlierUnitCount,1);assert.equal(viewport.outlierBasis,'sampled-fixes');assert.ok(viewport.viewBounds[1][0]<1);assert.equal(JSON.stringify(routes),copy);assert.equal(speedMapViewBounds([]).viewBounds,null);
});
test('map fingerprint and payload integrity prevent serving changed or corrupt historical replay',async()=>{
 const db=await database({url:'',dataDir:null});await initialize(db);const revision='a'.repeat(64),path=`speed/${revision}/0.json.gz`,day='2026-10-23';
 try{
  await db.query("INSERT INTO fleetsync.speed_units(unit,raw_path,raw_count) VALUES('DT2322',$1,10)",['speed/'+'b'.repeat(64)+'/0.json.gz']);
  await db.query("INSERT INTO fleetsync.speed_daily(unit,work_date,total_count,moving_count,speed_sum,max_speed) VALUES('DT2322',$1,10,5,100,30)",[day]);
  const signature=await speedMapSignature(db,day);const payload={rows:[],date:day,routes:[{unit:'DT2322',points:[[.8,117.5,0,20]],breaks:[],segments:[{start:0,end:0}],source_count:1}],bounds:[[.8,117.5],[.8,117.5]],maxGapSeconds:900,rawCount:1,invalidCount:0};payload.payload_sha256=speedMapPayloadDigest(payload);
  const index={revision,dates:{[day]:{path,signature,payload_sha256:payload.payload_sha256,units:1}}};await db.query("INSERT INTO fleetsync.app_settings(setting_key,setting_value) VALUES('speed_map_index',$1)",[JSON.stringify(index)]);
  let reads=0;const files={async rows(name){assert.equal(name,path);reads++;return structuredClone(payload);}};
  const loaded=await loadSpeedMap(db,files,day);assert.equal(loaded.status,'ready');assert.equal(loaded.routes.length,1);assert.equal((await loadSpeedMap(db,files,'2026-10-24')).status,'missing');assert.equal(reads,1);
  await db.query("UPDATE fleetsync.speed_daily SET version=version+1 WHERE unit='DT2322' AND work_date=$1",[day]);await assert.rejects(loadSpeedMap(db,files,day),error=>error.status===409);assert.equal(reads,1);
  await db.query("UPDATE fleetsync.speed_daily SET version=1 WHERE unit='DT2322' AND work_date=$1",[day]);await db.query("INSERT INTO fleetsync.speed_gps_overrides(unit,work_date,object_path,row_count,base_count) VALUES('DT2322',$1,$2,10,10)",[day,'speed/'+'c'.repeat(64)+'/0.json.gz']);assert.notEqual(await speedMapSignature(db,day),signature);await assert.rejects(loadSpeedMap(db,files,day),error=>error.status===409);
  await db.query('DELETE FROM fleetsync.speed_gps_overrides');payload.routes[0].points[0][0]=1;await assert.rejects(loadSpeedMap(db,files,day),error=>error.status===503);
  await assert.rejects(loadSpeedMap(db,files,'2026-02-30'),error=>error.status===422);
 }finally{await db.close();}
});
