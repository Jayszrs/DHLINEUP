import{audit}from'./db.js';
export async function classifySourceDayShift(db,seeds,{apply=false}={}){
 const expected=new Map(seeds.filter(r=>/^src-[0-9]+$/.test(r.id)).map(r=>[r.id,{site:r.site,day:r.date,unit:String(r.unit).trim().toUpperCase(),nik:String(r.nik||'')}]));
 return db.transaction(async tx=>{
 const rows=(await tx.query('SELECT * FROM fleetsync.lineups WHERE id=ANY($1::varchar[]) ORDER BY id FOR UPDATE',[[...expected.keys()]])).rows,result={candidates:[],changed:[],conflicts:[],skipped:[]};
 for(const row of rows){const source=expected.get(row.id);if(row.site!==source.site||row.work_date!==source.day||row.unit!==source.unit||row.nik!==source.nik||row.shift!=='Belum ditentukan'){result.skipped.push(row.id);continue;}
 const collision=(await tx.query("SELECT id FROM fleetsync.lineups WHERE site=$1 AND work_date=$2 AND shift='D' AND unit=$3 AND nik=$4 AND id<>$5",[row.site,row.work_date,row.unit,row.nik,row.id])).rows[0];if(collision){result.conflicts.push(row.id);continue;}result.candidates.push(row.id);
 if(apply){await tx.query("UPDATE fleetsync.lineups SET shift='D',version=version+1,updated_at=now() WHERE id=$1 AND version=$2",[row.id,row.version]);result.changed.push(row.id);}
 }
 if(result.changed.length)await audit(tx,null,'classify-shift','lineup-source','day-shift',{source:'User-confirmed Day Shift spreadsheet',ids:result.changed,from:'Belum ditentukan',to:'D',night_records_created:0});return result;
 });
}
