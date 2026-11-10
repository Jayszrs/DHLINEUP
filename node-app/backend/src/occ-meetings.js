import {text,date,recordId,HttpError} from './validation.js';
import {one,audit} from './db.js';

export const meetingLocal=value=>value?new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(value)).replace(' ','T'):'';
export const meetingTime=value=>new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(value));
export function meetingInput(input){
 const title=text(input,'title',180,true),start=text(input,'start_at',16,true),end=text(input,'end_at',16,true),meeting_url=text(input,'meeting_url',2048),notes=text(input,'notes',10000);
 const timestamp=v=>{if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v))throw new HttpError(422,'Waktu meeting wajib valid.');date({day:v.slice(0,10)},'day');const d=new Date(v+':00+07:00');if(!Number.isFinite(d.valueOf())||meetingLocal(d)!==v)throw new HttpError(422,'Waktu meeting tidak valid.');return d.toISOString();};
 const start_at=timestamp(start),end_at=timestamp(end);if(end_at<=start_at)throw new HttpError(422,'Meeting harus selesai setelah waktu mulai.');
 if(meeting_url){try{const u=new URL(meeting_url);if(u.protocol!=='https:'||u.username||u.password)throw Error();}catch{throw new HttpError(422,'Gunakan link meeting HTTPS yang valid.');}}
 return{title,start_at,end_at,meeting_url,notes};
}
export class OccMeetings{
 constructor(db,actor){this.db=db;this.actor=actor;}
 async get(id){const row=await one(this.db,'SELECT * FROM fleetsync.occ_meetings WHERE id=$1',[id]);if(!row)throw new HttpError(404,'Meeting tidak ditemukan.');return row;}
 async list(day){date({day},'day');const start=new Date(day+'T00:00:00+07:00'),end=new Date(start.valueOf()+86400000);return(await this.db.query('SELECT * FROM fleetsync.occ_meetings WHERE start_at<$1 AND end_at>$2 ORDER BY start_at,id',[end.toISOString(),start.toISOString()])).rows;}
 async save(input){const row=meetingInput(input),id=recordId(input),version=Number(text(input,'version',12)||0);if(!Number.isSafeInteger(version)||version<0)throw new HttpError(422,'Versi meeting tidak valid.');
  return this.db.transaction(async tx=>{await tx.query("SELECT setting_value FROM fleetsync.app_settings WHERE setting_key='bootstrap' FOR UPDATE");const conflict=await one(tx,'SELECT title FROM fleetsync.occ_meetings WHERE start_at<$1 AND end_at>$2 AND ($3::bigint IS NULL OR id<>$3) LIMIT 1',[row.end_at,row.start_at,id]);if(conflict)throw new HttpError(409,'Ruang OCC sudah dijadwalkan pada waktu ini. Pilih waktu lain.');
   const values=[row.title,row.start_at,row.end_at,row.meeting_url,row.notes];const saved=id?await tx.query('UPDATE fleetsync.occ_meetings SET title=$1,start_at=$2,end_at=$3,meeting_url=$4,notes=$5,version=version+1,updated_at=now() WHERE id=$6 AND version=$7 RETURNING id',[...values,id,version]):await tx.query('INSERT INTO fleetsync.occ_meetings(title,start_at,end_at,meeting_url,notes,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',[...values,this.actor]);if(!saved.rows.length)throw new HttpError(409,'Jadwal berubah. Buka ulang sebelum menyimpan.');await audit(tx,this.actor,id?'update':'create','occ-meeting',saved.rows[0].id,row);return meetingLocal(row.start_at).slice(0,10);});
 }
 async remove(input){const id=recordId(input,'id',true),version=Number(text(input,'version',12,true));if(!Number.isSafeInteger(version)||version<1)throw new HttpError(422,'Versi meeting tidak valid.');return this.db.transaction(async tx=>{const row=await one(tx,'DELETE FROM fleetsync.occ_meetings WHERE id=$1 AND version=$2 RETURNING *',[id,version]);if(!row)throw new HttpError(409,'Jadwal berubah atau sudah dihapus. Muat ulang halaman.');await audit(tx,this.actor,'delete','occ-meeting',id,{title:row.title,start_at:row.start_at});return meetingLocal(row.start_at).slice(0,10);});}
}
