import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {gunzipSync,gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {database,one,audit} from '../src/db.js';
import {Storage} from '../src/storage.js';
import {SpeedFiles} from '../src/speed.js';
import {sampleSpeedRoute,SPEED_MAP_MAX_GAP,SPEED_MAP_MAX_POINTS,speedMapPayloadDigest,speedMapSignature,speedMapViewBounds} from '../src/speed-map.js';

const args=process.argv.slice(2),apply=args.includes('--apply');
const oldDirectory=path.resolve('.private/speed-package'),newDirectory=path.resolve('.private/october-package'),output=path.resolve('.private/speed-map-package');
const old=JSON.parse(await readFile(path.join(oldDirectory,'manifest.json'),'utf8')),recent=JSON.parse(await readFile(path.join(newDirectory,'manifest.json'),'utf8'));
if(recent.errors?.length||!recent.provider_checksums_verified)throw new Error('Source GPS validation is incomplete.');
const revision=createHash('sha256').update(JSON.stringify({builder:3,old:old.revision,recent:recent.revision,maxPoints:SPEED_MAP_MAX_POINTS,maxGap:SPEED_MAP_MAX_GAP})).digest('hex');
const maps=new Map(),expected=new Map(),sourceUnits=new Map(old.units.map(unit=>[unit.unit,unit]));
for(const row of old.daily)expected.set(row.unit+':'+row.work_date,{...row,overlay_path:'',overlay_count:0,raw_path:sourceUnits.get(row.unit)?.source_gid?`speed/${old.revision}/${sourceUnits.get(row.unit).source_gid}.json.gz`:''});
for(const [index,row]of recent.daily.entries()){
 const key=row.unit+':'+row.work_date;if(expected.has(key))throw new Error('Source manifests overlap on the same unit/date.');
 expected.set(key,{...row,overlay_path:`speed/${recent.revision}/${index}.json.gz`,overlay_count:row.total_count,raw_path:sourceUnits.get(row.unit)?.source_gid?`speed/${old.revision}/${sourceUnits.get(row.unit).source_gid}.json.gz`:''});
}
function add(route,day){
 if(!maps.has(day))maps.set(day,{rows:[],date:day,routes:[],bounds:null,maxGapSeconds:SPEED_MAP_MAX_GAP,rawCount:0,invalidCount:0,invalidReasons:{location:0,time:0,speed:0},sampledCount:0,recapCount:0,recapUnits:0,source_count_note:'GPS yang tersedia pada arsip asli; jumlahnya dapat berbeda dari rekap harian.'});
 const map=maps.get(day);map.rawCount+=route.source_count;map.invalidCount+=route.invalid_count;map.sampledCount+=route.points.length;
 for(const key of['location','time','speed'])map.invalidReasons[key]+=route.invalid_reasons?.[key]||0;
 if(route.points.length)map.routes.push(route);
}
await mkdir(output,{recursive:true});let processed=0;
for(const unit of old.units){
 if(!unit.source_gid)continue;
 const packed=await readFile(path.join(oldDirectory,unit.source_gid+'.json.gz')),sheet=old.sheets.find(s=>s.gid===unit.source_gid||String(s.gid)===String(unit.source_gid));
 if(sheet?.checksum&&createHash('sha256').update(packed).digest('hex')!==sheet.checksum)throw new Error('Old GPS checksum mismatch.');
 const chunk=JSON.parse(gunzipSync(packed)),headers=chunk.rows[0],timeIndex=headers.indexOf('Creation Time'),groups=new Map();
 if(timeIndex<0)continue;
 for(const row of chunk.rows.slice(1)){const day=String(row[timeIndex]||'').slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!expected.has(unit.unit+':'+day))continue;if(!groups.has(day))groups.set(day,[]);groups.get(day).push(row);}
 for(const [day,rows]of groups)add(sampleSpeedRoute(unit.unit,rows,headers,day),day);
 if(++processed%30===0)console.log(JSON.stringify({processedOldUnits:processed}));
}
for(const [index,row]of recent.daily.entries()){
 if(!/^DT\d+-\d{4}-\d{2}-\d{2}\.json\.gz$/.test(row.file))throw new Error('Invalid GPS archive name.');
 const packed=await readFile(path.join(newDirectory,row.file));if(createHash('sha256').update(packed).digest('hex')!==row.checksum)throw new Error('Recent GPS checksum mismatch.');
 const chunk=JSON.parse(gunzipSync(packed));add(sampleSpeedRoute(row.unit,chunk.rows.slice(1),chunk.rows[0],row.work_date),row.work_date);
 if(index%500===0)console.log(JSON.stringify({processedRecentDays:index+1,total:recent.daily.length}));
}
for(const row of expected.values()){
 if(!maps.has(row.work_date))add({source_count:0,invalid_count:0,points:[]},row.work_date);
 const map=maps.get(row.work_date);map.recapCount+=Number(row.total_count);if(Number(row.total_count)>0)map.recapUnits++;
}
const manifest={revision,maxGapSeconds:SPEED_MAP_MAX_GAP,maxPoints:SPEED_MAP_MAX_POINTS,sourceRevisions:[old.revision,recent.revision],dates:{},expected:[...expected.values()].map(({unit,work_date,total_count,moving_count,speed_sum,max_speed,overlay_path,overlay_count,raw_path})=>({unit,work_date,total_count,moving_count,speed_sum,max_speed,overlay_path,overlay_count,raw_path}))};
for(const [index,day]of [...maps.keys()].sort().entries()){
 const map=maps.get(day);map.routes.sort((a,b)=>a.unit.localeCompare(b.unit));
 const points=map.routes.flatMap(route=>route.points);if(points.length)map.bounds=[[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1]))],[Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))]];
 Object.assign(map,speedMapViewBounds(map.routes));map.mapUnits=map.routes.length;map.payload_sha256=speedMapPayloadDigest(map);const packed=gzipSync(Buffer.from(JSON.stringify(map)),{level:6});
 if(packed.length>10*1024*1024)throw new Error('Daily map archive exceeds storage limit.');
 const file=day+'.json.gz';await writeFile(path.join(output,file),packed);
 manifest.dates[day]={file,path:`speed/${revision}/${index}.json.gz`,checksum:createHash('sha256').update(packed).digest('hex'),payload_sha256:map.payload_sha256,units:map.routes.length,rawCount:map.rawCount,invalidCount:map.invalidCount,sampledCount:map.sampledCount};
}
await writeFile(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2));
console.log(JSON.stringify({built:true,dates:Object.keys(manifest.dates).length,rawCount:[...maps.values()].reduce((n,m)=>n+m.rawCount,0),invalidCount:[...maps.values()].reduce((n,m)=>n+m.invalidCount,0),invalidReasons:Object.fromEntries(['location','time','speed'].map(key=>[key,[...maps.values()].reduce((n,m)=>n+m.invalidReasons[key],0)])),sampledCount:[...maps.values()].reduce((n,m)=>n+m.sampledCount,0),outlierSampleCount:[...maps.values()].reduce((n,m)=>n+m.outlierSampleCount,0),apply}));
if(apply){
 const db=await database();
 try{
  const actual=(await db.query('SELECT d.unit,d.work_date,d.version,d.total_count,d.moving_count,d.speed_sum,d.max_speed,u.raw_path,coalesce(o.object_path,\'\') AS overlay_path,coalesce(o.row_count,0)::int AS overlay_count FROM fleetsync.speed_daily d JOIN fleetsync.speed_units u ON u.unit=d.unit LEFT JOIN fleetsync.speed_gps_overrides o ON o.unit=d.unit AND o.work_date=d.work_date WHERE d.work_date BETWEEN $1 AND $2 ORDER BY d.unit,d.work_date',[[...maps.keys()].sort()[0],[...maps.keys()].sort().at(-1)])).rows;
  if(actual.length!==expected.size)throw new Error('Database dates or units differ from the source package. Build from updated GPS before applying.');
  for(const row of actual){const day=row.work_date instanceof Date?row.work_date.toISOString().slice(0,10):row.work_date,source=expected.get(row.unit+':'+day);if(!source||Number(row.version)!==1||row.raw_path!==source.raw_path||row.overlay_path!==source.overlay_path||Number(row.overlay_count)!==source.overlay_count)throw new Error('GPS source or manual version differs from the verified local package.');for(const key of['total_count','moving_count','speed_sum','max_speed'])if(Math.abs(Number(row[key])-Number(source[key]))>.0001)throw new Error('Stored recap differs from source package.');}
  const current=await one(db,"SELECT setting_value FROM fleetsync.app_settings WHERE setting_key='speed_map_index'");let currentIndex;try{currentIndex=JSON.parse(current?.setting_value||'{}');}catch{currentIndex={};}
  const index={revision,dates:{}};
  for(const [day,item]of Object.entries(manifest.dates))index.dates[day]={path:item.path,signature:await speedMapSignature(db,day),payload_sha256:item.payload_sha256,units:item.units};
  if(JSON.stringify(index)===JSON.stringify(currentIndex))console.log(JSON.stringify({already:true,revision}));
  else{
   const files=new SpeedFiles(new Storage());let count=0;
   for(const item of Object.values(manifest.dates)){
    const bytes=await readFile(path.join(output,item.file));if(createHash('sha256').update(bytes).digest('hex')!==item.checksum)throw new Error('Local map checksum mismatch.');
    for(let attempt=0;;attempt++){try{await files.put(item.path,bytes);break;}catch(error){if(attempt>=3)throw error;await new Promise(resolve=>setTimeout(resolve,500*2**attempt));}}
    if(++count%10===0)console.log(JSON.stringify({uploadedMapDays:count}));
   }
   await db.transaction(async tx=>{
    await tx.query("SELECT setting_value FROM fleetsync.app_settings WHERE setting_key='bootstrap' FOR UPDATE");
    for(const [day,item]of Object.entries(index.dates))if(await speedMapSignature(tx,day)!==item.signature)throw new Error('GPS changed during map upload. Retry after rebuilding sources.');
    await tx.query("INSERT INTO fleetsync.app_settings(setting_key,setting_value) VALUES('speed_map_index',$1) ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value",[JSON.stringify(index)]);
    await audit(tx,null,'import','speed-map',revision,{dates:Object.keys(index.dates).length,sourceRevisions:manifest.sourceRevisions});
   });console.log(JSON.stringify({applied:true,revision,dates:Object.keys(index.dates).length}));
  }
 }finally{await db.close();}
}
