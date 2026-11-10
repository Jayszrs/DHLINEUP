import {OCC_TEAM} from '../../frontend/assets/js/occ-team.js';
import {HttpError,text,choice} from './validation.js';
import {audit} from './db.js';
export const TEAM_STATUSES=['Belum diperbarui','Aktif','Cuti','Tidak bertugas'];
export class OccTeam{
 constructor(db,actor){this.db=db;this.actor=actor;}
 async all(){
  const [profiles,accounts]=await Promise.all([this.db.query('SELECT * FROM fleetsync.occ_team_profiles'),this.db.query('SELECT name,nik,profile_photo FROM fleetsync.users WHERE upper(nik)=ANY($1::text[]) OR lower(name)=ANY($2::text[])',[OCC_TEAM.map(p=>p.nik),OCC_TEAM.map(p=>p.name.toLowerCase())])]);
  return OCC_TEAM.map(person=>{const profile=profiles.rows.find(p=>p.nik===person.nik),matches=accounts.rows.filter(a=>String(a.nik||'').toUpperCase()===person.nik||a.name.toLowerCase()===person.name.toLowerCase()),photo=profile?.photo_path||(matches.length===1?matches[0].profile_photo:'')||'';return{...person,bio:profile?.bio||'',work_status:profile?.work_status||'Belum diperbarui',version:profile?.version||0,photo_path:photo,own_photo:profile?.photo_path||''};});
 }
 async get(nik){const row=(await this.all()).find(p=>p.nik===nik);if(!row)throw new HttpError(404,'Anggota tim OCC tidak ditemukan.');return row;}
 async save(input,photo){const nik=text(input,'nik',60,true),current=await this.get(nik),bio=text(input,'bio',2000),work_status=choice(input,'work_status',TEAM_STATUSES,'Belum diperbarui'),version=Number(text(input,'version',12,true));if(!Number.isSafeInteger(version)||version<0)throw new HttpError(422,'Versi profil tidak valid.');
  const photo_path=photo!==undefined?photo:current.own_photo;
  await this.db.transaction(async tx=>{const values=[bio,work_status,photo_path,nik,version];const result=version?await tx.query('UPDATE fleetsync.occ_team_profiles SET bio=$1,work_status=$2,photo_path=$3,version=version+1,updated_at=now() WHERE nik=$4 AND version=$5 RETURNING nik',values):await tx.query('INSERT INTO fleetsync.occ_team_profiles(nik,bio,work_status,photo_path) VALUES($4,$1,$2,$3) ON CONFLICT DO NOTHING RETURNING nik',values.slice(0,4));if(!result.rows.length)throw new HttpError(409,'Profil sudah berubah. Buka ulang sebelum menyimpan.');await audit(tx,this.actor,'save','occ-team',nik,{bio,work_status,photo_updated:photo!==undefined});});return nik;
 }
}
