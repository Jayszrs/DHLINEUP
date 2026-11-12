import {OccRepository,occFilters,blankOccAsset,OCC_ITEMS,OCC_CCTV_SITES,OCC_STATUSES,OCC_CCTV_STATUSES,OCC_ASSET_AVAILABILITY,OCC_CONDITIONS,OCC_SOURCE_URL,occStatusSummary,occStatusTone} from './occ.js';
import {canEditData} from './auth.js';
import {HttpError,choice,text,date,recordId} from './validation.js';
import {OccMeetings,meetingLocal,meetingTime} from './occ-meetings.js';
import {occPhotos,driveReference} from './occ-photos.js';
import {one} from './db.js';
import {reportWorkbook} from './report-workbook.js';
import {CctvRepository,cctvFilters,cctvPercent,CCTV_SITES,CCTV_SOURCE_URL} from './cctv.js';
import {OccTeam,TEAM_STATUSES} from './occ-team.js';

const labels={'occ-dashboard':'Dashboard OCC JHO','occ-cctv':'CCTV Availability','occ-availability':'Inventory Availability','occ-assets':'Inventory OCC'};
const defaults={OCC_ITEMS,OCC_CCTV_SITES,occStatuses:OCC_STATUSES,occCctvStatuses:OCC_CCTV_STATUSES,occAssetAvailability:OCC_ASSET_AVAILABILITY,occConditions:OCC_CONDITIONS,occSourceUrl:OCC_SOURCE_URL,occStatusSummary,occStatusTone};
const requireEditor=req=>{if(!canEditData(req.user))throw new HttpError(403,'Akun ini hanya dapat melihat inventory OCC. Hubungi administrator untuk perubahan.');};
const currentDay=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Jakarta'});
const formKind=input=>choice(input,'kind',['asset','cctv','availability'],'asset');
const formLabel=kind=>kind==='asset'?'Form Inventory OCC':kind==='cctv'?'Pengecekan CCTV':'Pengecekan Inventory';
export function occRoutes(app,view,url,upload){
 app.get('/occ-team-photo',async(req,res)=>{const person=await new OccTeam(req.db,req.user.id).get(text(req.query,'nik',60,true));if(!person.photo_path)throw new HttpError(404,'Foto profil belum diunggah.');const photo=person.photo_path;res.type(photo.endsWith('.webp')?'image/webp':photo.endsWith('.png')?'image/png':'image/jpeg').send(await req.storage.get(photo));});
 app.get('/occ-team-form',async(req,res)=>{requireEditor(req);const row=await new OccTeam(req.db,req.user.id).get(text(req.query,'nik',60,true));return view(req,res,'occ-team-form',{label:'Profil tim OCC',occPage:'occ-dashboard',row,teamStatuses:TEAM_STATUSES});});
 app.post('/occ-team-save',(req,_res,next)=>{requireEditor(req);next();},upload||((_req,_res,next)=>next()),async(req,res)=>{
  req.auth.csrf(req);let newPhoto='',temporary='';const repo=new OccTeam(req.db,req.user.id);try{let file=req.files?.profile_photo?.[0];if(req.body.profile_photo_ticket){const item=await req.db.transaction(tx=>req.storage.consume(tx,req.user,text(req.body,'profile_photo_ticket',64,true),'profile_photo'));temporary=item.temporaryPath;file={buffer:item.bytes};}let photo;if(file){photo=await req.storage.image(file.buffer,{avatar:true});newPhoto=photo;}else if(text(req.body,'remove_profile_photo',1)==='1')photo='';const nik=await repo.save(req.body,photo);newPhoto='';await req.auth.flash(req,'Profil tim OCC berhasil disimpan.');res.redirect(303,url('occ-dashboard')+'#occ-team');}catch(error){if(newPhoto)await req.storage.remove(newPhoto);if(!error.status)throw error;const row=await repo.get(text(req.body,'nik',60,true));res.status(error.status);return view(req,res,'occ-team-form',{label:'Periksa profil tim',occPage:'occ-dashboard',row:{...row,bio:text(req.body,'bio',2000),work_status:text(req.body,'work_status',80)},teamStatuses:TEAM_STATUSES,errorMessage:error.message});}finally{if(temporary)await req.storage.remove(temporary).catch(()=>{});}
 });
 app.get('/occ-documentation',async(req,res)=>{const asset=await new OccRepository(req.db,req.user.id).asset(text(req.query,'id',80,true));return view(req,res,'occ-documentation',{...defaults,label:'Dokumentasi OCC',occPage:'occ-assets',occAsset:asset,occPictures:await occPhotos(req.db,asset)});});
 app.get('/occ-photo',async(req,res)=>{const asset=await new OccRepository(req.db,req.user.id).asset(text(req.query,'id',80,true)),pictures=await occPhotos(req.db,asset),index=Number(text(req.query,'index',4)||0);if(!Number.isSafeInteger(index)||index<0||!pictures[index])throw new HttpError(404,'Foto dokumentasi belum tersedia.');res.type('image/webp').send(await req.storage.get(pictures[index].path));});
 app.get('/occ-meeting-form',async(req,res)=>{requireEditor(req);const id=recordId(req.query),repo=new OccMeetings(req.db,req.user.id);const row=id?await repo.get(id):{start_at:'',end_at:'',version:0};return view(req,res,'occ-meeting',{label:id?'Edit meeting OCC':'Jadwalkan meeting OCC',occPage:'occ-dashboard',row:{...row,start_at:meetingLocal(row.start_at),end_at:meetingLocal(row.end_at)}});});
 app.post('/occ-meeting-save',async(req,res)=>{requireEditor(req);req.auth.csrf(req);try{const day=await new OccMeetings(req.db,req.user.id).save(req.body);await req.auth.flash(req,'Jadwal meeting OCC berhasil disimpan.');return res.redirect(303,url('occ-dashboard',{meeting_date:day}));}catch(error){if(!error.status)throw error;res.status(error.status);return view(req,res,'occ-meeting',{label:'Periksa jadwal meeting',occPage:'occ-dashboard',row:Object.fromEntries(['id','version','title','start_at','end_at','meeting_url','notes'].map(k=>[k,typeof req.body[k]==='string'?req.body[k]:''])),errorMessage:error.message});}});
 app.post('/occ-meeting-delete',async(req,res)=>{requireEditor(req);req.auth.csrf(req);const day=await new OccMeetings(req.db,req.user.id).remove(req.body);await req.auth.flash(req,'Jadwal meeting OCC berhasil dihapus.');res.redirect(303,url('occ-dashboard',{meeting_date:day}));});
 app.get('/occ-export',async(req,res)=>{const filters=occFilters(req.query),data=await new OccRepository(req.db,req.user.id).data(filters),kind=choice(req.query,'kind',['assets','cctv','availability'],'assets');const assets=kind==='assets',keys=kind==='cctv'?OCC_CCTV_SITES:OCC_ITEMS,checks=kind==='cctv'?data.cctv:data.availability;const rows=assets?[['Kategori','Aset','Kode setup','Qty','Brand','Model','Penempatan','Ketersediaan','Kondisi','Spesifikasi','Perangkat terkait','Catatan'],...data.assets.map(a=>[a.category,a.name,a.asset_code,a.qty,a.brand,a.model,a.placement,a.availability,a.condition,a.specifications,a.related_device,a.notes])]:[['Tanggal',...keys,'Catatan'],...checks.map(r=>[r.work_date,...keys.map(k=>r.statuses[k]||'Not Checked'),r.notes])];res.attachment('DHOCC_OCC_'+kind+'.xlsx').type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').send(reportWorkbook([{name:assets?'Inventory OCC':kind==='cctv'?'CCTV Availability':'Inventory Availability',title:'DHOCC · '+(assets?'Inventory OCC':kind==='cctv'?'CCTV Availability':'Inventory Availability'),subtitle:`OCC Jakarta Head Office · ${filters.work_date||[filters.from||'Awal data',filters.to||'Akhir data'].join(' s.d. ')} · ${rows.length-1} baris`,note:'Sumber: tiga tab spreadsheet OCC. Seluruh hasil filter diekspor; data asli tidak diubah.',rows}]));});
 for(const page of Object.keys(labels))app.get('/'+page,async(req,res)=>{
  const filters=occFilters(req.query),data=await new OccRepository(req.db,req.user.id).data(filters);
  const cctvData=['occ-dashboard','occ-availability'].includes(page)?await new CctvRepository(req.db).data(cctvFilters({to:filters.work_date||currentDay()})):null;
  const team=page==='occ-dashboard'?await new OccTeam(req.db,req.user.id).all():[];
  const meetingDay=date(req.query,'meeting_date',false)||currentDay(),sceneMeetings=page==='occ-dashboard'?await new OccMeetings(req.db,req.user.id).listWindow(meetingDay):[],start=new Date(meetingDay+'T00:00:00+07:00').valueOf(),end=start+86400000,meetings=sceneMeetings.filter(m=>new Date(m.start_at).valueOf()<end&&new Date(m.end_at).valueOf()>start);
  const photoSetting=await one(req.db,"SELECT setting_value FROM fleetsync.app_settings WHERE setting_key='occ_photos_v1'");let manifest={};try{manifest=JSON.parse(photoSetting?.setting_value||'{}');}catch{}
  for(const asset of data.assets)asset.photo_count=manifest[driveReference(asset.photo_url)]?.length||0;
  return view(req,res,'occ',{...defaults,cctvData,cctvPercent,CCTV_SITES,cctvSourceUrl:CCTV_SOURCE_URL,label:labels[page],occPage:page,occFilters:filters,occAssets:data.assets,occAllAssets:data.allAssets,occCctv:data.cctv,occAvailability:data.availability,occSelectedCctv:data.selectedCctv,occSelectedInventory:data.selectedInventory,occSummary:data.summary,meetings,sceneMeetings,meetingDay,meetingTime,occTeam:team.map(({photo_path,own_photo,...person})=>({...person,photo:photo_path?url('occ-team-photo',{nik:person.nik,v:person.version}):'',href:canEditData(req.user)?url('occ-team-form',{nik:person.nik}):''}))});
 });
 app.get('/occ-form',async(req,res)=>{
  requireEditor(req);const repo=new OccRepository(req.db,req.user.id),kind=formKind(req.query);let row;
  if(kind==='asset'){const id=text(req.query,'id',80);row=id?await repo.asset(id):blankOccAsset();}
  else{const day=date(req.query,'work_date',false)||currentDay();row=await repo.check(kind,day)||{work_date:day,version:0,notes:'',statuses:Object.fromEntries((kind==='cctv'?OCC_CCTV_SITES:OCC_ITEMS).map(key=>[key,'Not Checked']))};}
  return view(req,res,'occ-form',{...defaults,label:formLabel(kind),occPage:'occ-form',occKind:kind,row,occAssets:(await repo.data()).allAssets});
 });
 app.post('/occ-save',async(req,res)=>{
  requireEditor(req);req.auth.csrf(req);const kind=formKind(req.body),repo=new OccRepository(req.db,req.user.id);
  try{
   if(kind==='asset'){await repo.saveAsset(req.body);await req.auth.flash(req,'Inventory OCC berhasil disimpan.');return res.redirect(303,url('occ-assets'));}
   const day=await repo.saveCheck(kind,req.body);await req.auth.flash(req,'Pengecekan OCC berhasil disimpan.');return res.redirect(303,url(kind==='cctv'?'occ-cctv':'occ-availability',{work_date:day}));
  }catch(error){
   if(!error.status)throw error;res.status(error.status);
   const safe=Object.fromEntries(Object.entries(req.body).filter(([,v])=>typeof v==='string'||typeof v==='number'));
   const row=kind==='asset'?{...blankOccAsset(),...safe}:{...safe,statuses:Object.fromEntries((kind==='cctv'?OCC_CCTV_SITES:OCC_ITEMS).map((key,index)=>[key,safe['status_'+index]||'Not Checked']))};
   return view(req,res,'occ-form',{...defaults,label:formLabel(kind),occPage:'occ-form',occKind:kind,row,occAssets:(await repo.data()).allAssets,errorMessage:error.message});
  }
 });
}
