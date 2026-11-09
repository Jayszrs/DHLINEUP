import {createHash} from 'node:crypto';
import {one} from './db.js';
import {date,HttpError} from './validation.js';

export const SPEED_MAP_MAX_POINTS=240;
export const SPEED_MAP_MAX_GAP=900;
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const dayValue=day=>date({day},'day');
const number=value=>typeof value==='number'?value:typeof value==='string'&&/^[-+]?\d+(?:\.\d+)?$/.test(value.trim())?Number(value):NaN;
export function parseGpsSpeed(value){
 if(typeof value==='number')return value;
 if(typeof value!=='string')return NaN;
 const raw=value.trim().replace(/\s*km\/?(?:h|jam)\s*$/i,'').replace(',','.');
 return number(raw);
}
export function parseGpsLocation(value){
 if(typeof value!=='string')return null;
 const match=value.trim().match(/^\s*([-+]?\d+(?:\.\d+)?)\s*[,;]\s*([-+]?\d+(?:\.\d+)?)\s*$/);if(!match)return null;
 const longitude=Number(match[1]),latitude=Number(match[2]);
 if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180||(!latitude&&!longitude))return null;
 return[latitude,longitude];
}
export function gpsWibSeconds(value,day){
 if(typeof value!=='string')return null;
 const match=value.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{1,2}):(\d{2}):(\d{2})(?:\.\d+)?$/);
 if(!match||match[1]!==day||Number(match[2])>23||Number(match[3])>59||Number(match[4])>59)return null;
 return Number(match[2])*3600+Number(match[3])*60+Number(match[4]);
}
export function gpsDistanceMeters(a,b){
 const radians=Math.PI/180,dLat=(b[0]-a[0])*radians,dLon=(b[1]-a[1])*radians;
 const h=Math.sin(dLat/2)**2+Math.cos(a[0]*radians)*Math.cos(b[0]*radians)*Math.sin(dLon/2)**2;
 return 6371008.8*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
}
// A break is an observation boundary, never a synthetic movement between fixes.
export function gpsContinuous(a,b,maxGapSeconds=SPEED_MAP_MAX_GAP){
 const seconds=b[2]-a[2];if(seconds<=0||seconds>maxGapSeconds)return false;
 const meters=gpsDistanceMeters(a,b),limit=Math.min(250,Math.max(80,Math.max(a[3],b[3])*2+30));
 return meters<=100||meters/seconds*3.6<=limit;
}
function selectPoints(segment,budget){
 if(segment.length<=budget)return segment;
 if(budget===1)return[segment[0]];
 const selected=new Set([0,segment.length-1]),start=segment[0][2],duration=segment.at(-1)[2]-start;let cursor=0;
 for(let index=1;index<budget-1;index++){
  const target=start+duration*index/(budget-1);
  while(cursor+1<segment.length&&segment[cursor+1][2]<=target)cursor++;
  const next=Math.min(cursor+1,segment.length-1),closest=Math.abs(segment[cursor][2]-target)<=Math.abs(segment[next][2]-target)?cursor:next;selected.add(closest);
 }
 // Equal-timestamp stationary readings may collapse time targets. Fill with original observations.
 if(selected.size<budget)for(let index=1;index<budget-1;index++){selected.add(Math.round(index*(segment.length-1)/(budget-1)));if(selected.size>=budget)break;}
 return[...selected].sort((a,b)=>a-b).map(index=>segment[index]);
}
export function sampleSpeedRoute(unit,rows,headers,day,{maxPoints=SPEED_MAP_MAX_POINTS,maxGapSeconds=SPEED_MAP_MAX_GAP}={}){
 if(!/^DT\d{1,8}$/.test(unit)||!Array.isArray(rows)||!Array.isArray(headers))throw new HttpError(422,'Sumber jalur GPS tidak valid.');dayValue(day);
 if(!Number.isInteger(maxPoints)||maxPoints<2||maxPoints>1000)throw new HttpError(422,'Batas titik jalur GPS tidak valid.');
 const locationIndex=headers.indexOf('Location'),timeIndex=headers.indexOf('Creation Time'),speedIndex=headers.indexOf('Speed Numeric (km/jam)'),fallbackSpeed=headers.indexOf('Speed'),unitIndex=headers.indexOf('Device Name');
 if(locationIndex<0||timeIndex<0||(speedIndex<0&&fallbackSpeed<0))throw new HttpError(422,'Kolom koordinat sumber GPS belum lengkap.');
 const source=[];let source_count=0,invalid_count=0;const invalid_reasons={location:0,time:0,speed:0};
 for(const row of rows){
  if(!Array.isArray(row)||String(row[timeIndex]||'').slice(0,10)!==day)continue;
  if(unitIndex>=0&&String(row[unitIndex]||'').trim().toUpperCase().replace(/^DH(?=DT)/,'')!==unit)continue;
  source_count++;const location=parseGpsLocation(row[locationIndex]),seconds=gpsWibSeconds(row[timeIndex],day),speed=parseGpsSpeed(speedIndex>=0?row[speedIndex]:row[fallbackSpeed]);
  if(!location||seconds===null||!Number.isFinite(speed)||speed<0||speed>500){invalid_count++;invalid_reasons[!location?'location':seconds===null?'time':'speed']++;continue;}
  source.push([...location,seconds,speed]);
 }
 source.sort((a,b)=>a[2]-b[2]);
 const segments=[];let active=[];let duplicate_count=0;
 for(const point of source){const previous=active.at(-1);
  if(previous&&point.every((v,i)=>v===previous[i])){duplicate_count++;continue;}
  if(previous&&!gpsContinuous(previous,point,maxGapSeconds)){segments.push(active);active=[];}
  active.push(point);
 }if(active.length)segments.push(active);
 // Retain segment endpoints. If extreme discontinuities exceed the display budget,
 // retain longest observed segments and explicitly count the omitted fixes.
 const prioritized=segments.map((points,index)=>({points,index,budget:Math.min(2,points.length)})).sort((a,b)=>(b.points.at(-1)[2]-b.points[0][2])-(a.points.at(-1)[2]-a.points[0][2])||b.points.length-a.points.length);
 const kept=[];let used=0;for(const segment of prioritized){if(used+segment.budget<=maxPoints){kept.push(segment);used+=segment.budget;}}
 while(used<maxPoints){let best=null,weight=-1;for(const segment of kept){if(segment.budget>=segment.points.length)continue;const candidate=segment.points.length/segment.budget;if(candidate>weight){best=segment;weight=candidate;}}if(!best)break;best.budget++;used++;}
 kept.sort((a,b)=>a.index-b.index);const points=[],breaks=[],ranges=[];
 for(const segment of kept){const selected=selectPoints(segment.points,segment.budget);if(points.length)breaks.push(points.length);const start=points.length;points.push(...selected);ranges.push({start,end:points.length-1});}
 return{unit,points,breaks,segments:ranges,source_count,valid_count:source.length,invalid_count,invalid_reasons,duplicate_count,omitted_count:source.length-duplicate_count-points.length};
}
export function speedMapViewBounds(routes){
 const points=routes.flatMap(route=>route.points);if(!points.length)return{viewBounds:null,outlierCount:0,outlierSampleCount:0,outlierUnitCount:0,outlierBasis:'sampled-fixes'};
 const latitudes=points.map(point=>point[0]).sort((a,b)=>a-b),longitudes=points.map(point=>point[1]).sort((a,b)=>a-b),center=[latitudes[Math.floor(points.length/2)],longitudes[Math.floor(points.length/2)]];
 const distances=points.map(point=>gpsDistanceMeters(center,point)).sort((a,b)=>a-b),radius=Math.min(100000,Math.max(10000,distances[Math.min(distances.length-1,Math.floor(distances.length*.99))]*1.5));
 const core=points.filter(point=>gpsDistanceMeters(center,point)<=radius);
 const bounds=[[Math.min(...core.map(point=>point[0])),Math.min(...core.map(point=>point[1]))],[Math.max(...core.map(point=>point[0])),Math.max(...core.map(point=>point[1]))]];
 const outside=point=>point[0]<bounds[0][0]||point[0]>bounds[1][0]||point[1]<bounds[0][1]||point[1]>bounds[1][1];
 const count=points.filter(outside).length;
 return{viewBounds:bounds,outlierCount:count,outlierSampleCount:count,outlierUnitCount:routes.filter(route=>route.points.some(outside)).length,outlierBasis:'sampled-fixes'};
}
export function speedMapPayloadDigest(payload){const {payload_sha256,...data}=payload;return digest(data);}
export async function speedMapSignature(db,day){
 dayValue(day);
 const rows=(await db.query(`SELECT d.unit,d.version,d.total_count,d.moving_count,d.speed_sum::text AS speed_sum,d.max_speed::text AS max_speed,u.raw_path,u.raw_count,coalesce(o.object_path,'') AS overlay_path,coalesce(o.row_count,0)::int AS overlay_count,coalesce(o.base_count,0)::int AS overlay_base_count FROM fleetsync.speed_daily d JOIN fleetsync.speed_units u ON u.unit=d.unit LEFT JOIN fleetsync.speed_gps_overrides o ON o.unit=d.unit AND o.work_date=d.work_date WHERE d.work_date=$1 ORDER BY d.unit`,[day])).rows;
 return digest(rows.map(row=>({unit:row.unit,version:Number(row.version),total_count:Number(row.total_count),moving_count:Number(row.moving_count),speed_sum:Number(row.speed_sum),max_speed:Number(row.max_speed),raw_path:row.raw_path||'',raw_count:Number(row.raw_count||0),overlay_path:row.overlay_path||'',overlay_count:Number(row.overlay_count||0),overlay_base_count:Number(row.overlay_base_count||0)})));
}
function missing(day){return{rows:[],date:day,routes:[],bounds:null,viewBounds:null,outlierCount:0,outlierSampleCount:0,outlierUnitCount:0,maxGapSeconds:SPEED_MAP_MAX_GAP,rawCount:0,invalidCount:0,status:'missing'};}
export async function loadSpeedMap(db,files,day){
 dayValue(day);const setting=await one(db,"SELECT setting_value FROM fleetsync.app_settings WHERE setting_key='speed_map_index'");if(!setting)return missing(day);
 let index;try{index=JSON.parse(setting.setting_value);}catch{throw new HttpError(503,'Indeks peta GPS belum dapat dibaca.');}
 const entry=index.dates?.[day];if(!entry)return missing(day);
 if(!/^[a-f0-9]{64}$/.test(index.revision||'')||!new RegExp('^speed/'+index.revision+'/[0-9]+\\.json\\.gz$').test(entry.path||'')||!/^[a-f0-9]{64}$/.test(entry.signature||'')||!/^[a-f0-9]{64}$/.test(entry.payload_sha256||''))throw new HttpError(503,'Indeks peta GPS tidak valid.');
 if(await speedMapSignature(db,day)!==entry.signature)throw new HttpError(409,'GPS atau rekap tanggal ini baru diperbarui. Peta rekaman perlu diperbarui; laporan unit tetap dapat dibuka.');
 const payload=await files.rows(entry.path);
 if(payload.date!==day||!Array.isArray(payload.routes)||!Array.isArray(payload.rows)||speedMapPayloadDigest(payload)!==entry.payload_sha256)throw new HttpError(503,'Arsip peta GPS belum lolos pemeriksaan integritas.');
 return{...payload,status:payload.routes.length?'ready':'empty'};
}
