import {HttpError} from './validation.js';

export const SPEED_LIMIT=80;
export function numericSpeed(value){const raw=String(value??'').trim().replace(/\s*(?:km\/?(?:h|jam)|kph).*$/i,'').replace(',','.');return raw!==''&&/^\d+(?:\.\d+)?$/.test(raw)?Number(raw):null;}
export function verifiedSpeedStats(rows,expected){
 const headers=rows[0]||[],speedIndex=headers.findIndex(h=>/^Speed$/i.test(h));
 if(speedIndex<0||rows.length-1!==Number(expected.total_count))return null;
 const stats={total_count:0,moving_count:0,speed_sum:0,max_speed:0,anomaly_count:0};let sourceSum=0,sourceMax=0,sourceMoving=0;
 for(const row of rows.slice(1)){const n=numericSpeed(row[speedIndex]);if(n===null||!Number.isFinite(n))return null;sourceSum+=n;sourceMax=Math.max(sourceMax,n);if(n>0)sourceMoving++;if(n>=SPEED_LIMIT){stats.anomaly_count++;continue;}stats.total_count++;stats.speed_sum+=n;if(n>0)stats.moving_count++;stats.max_speed=Math.max(stats.max_speed,n);}
 if(Math.abs(sourceSum-Number(expected.speed_sum))>.011||Math.abs(sourceMax-Number(expected.max_speed))>.001||sourceMoving!==Number(expected.moving_count))return null;
 stats.speed_sum=Number(stats.speed_sum.toFixed(4));return stats;
}
export async function rebuildSpeedQuality(db,files){
 const rows=(await db.query('SELECT d.*,u.raw_path,o.object_path FROM fleetsync.speed_daily d JOIN fleetsync.speed_units u USING(unit) LEFT JOIN fleetsync.speed_gps_overrides o USING(unit,work_date) WHERE d.max_speed>=80 AND NOT EXISTS (SELECT 1 FROM fleetsync.speed_quality_daily q WHERE q.unit=d.unit AND q.work_date=d.work_date AND q.source_version=d.version AND q.source_count=d.total_count AND q.source_sum=d.speed_sum AND q.source_max=d.max_speed) ORDER BY d.work_date,d.unit')).rows,result=[];
 for(const row of rows){let stats=null;const archive=row.object_path||row.raw_path;if(archive){const data=await files.rows(archive);const headers=data.rows[0],time=headers.indexOf('Creation Time');const selected=[headers,...data.rows.slice(1).filter(r=>String(r[time]||'').slice(0,10)===row.work_date)];stats=verifiedSpeedStats(selected,row);}
  if(stats)await db.transaction(async tx=>{const saved=await tx.query(`INSERT INTO fleetsync.speed_quality_daily(unit,work_date,source_version,source_count,source_sum,source_max,total_count,moving_count,speed_sum,max_speed,anomaly_count) SELECT unit,work_date,version,total_count,speed_sum,max_speed,$1,$2,$3,$4,$5 FROM fleetsync.speed_daily WHERE unit=$6 AND work_date=$7 AND version=$8 AND total_count=$9 AND speed_sum=$10 AND max_speed=$11 ON CONFLICT(unit,work_date) DO UPDATE SET source_version=excluded.source_version,source_count=excluded.source_count,source_sum=excluded.source_sum,source_max=excluded.source_max,total_count=excluded.total_count,moving_count=excluded.moving_count,speed_sum=excluded.speed_sum,max_speed=excluded.max_speed,anomaly_count=excluded.anomaly_count,verified_at=now() RETURNING unit`,[stats.total_count,stats.moving_count,stats.speed_sum,stats.max_speed,stats.anomaly_count,row.unit,row.work_date,row.version,row.total_count,row.speed_sum,row.max_speed]);if(!saved.rows.length)throw new HttpError(409,'Rekap berubah selama verifikasi speed. Ulangi pemeriksaan.');});
  result.push({unit:row.unit,date:row.work_date,verified:!!stats,anomalies:stats?.anomaly_count??null,source_count:row.total_count});
 }return result;
}
