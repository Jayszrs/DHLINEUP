import {OccRepository,occFilters,blankOccAsset,OCC_ITEMS,OCC_CCTV_SITES,OCC_STATUSES,OCC_CCTV_STATUSES,OCC_ASSET_AVAILABILITY,OCC_CONDITIONS,OCC_SOURCE_URL,occStatusSummary,occStatusTone} from './occ.js';
import {canEditData} from './auth.js';
import {HttpError,choice,text,date,recordId} from './validation.js';
import {OccMeetings,meetingLocal,meetingTime} from './occ-meetings.js';
import {occPhotos,driveReference} from './occ-photos.js';
import {one} from './db.js';
import {reportWorkbook} from './report-workbook.js';

const labels={'occ-dashboard':'Dashboard OCC JHO','occ-cctv':'CCTV Availability','occ-availability':'Inventory Availability','occ-assets':'Inventory OCC'};
const defaults={OCC_ITEMS,OCC_CCTV_SITES,occStatuses:OCC_STATUSES,occCctvStatuses:OCC_CCTV_STATUSES,occAssetAvailability:OCC_ASSET_AVAILABILITY,occConditions:OCC_CONDITIONS,occSourceUrl:OCC_SOURCE_URL,occStatusSummary,occStatusTone};
const requireEditor=req=>{if(!canEditData(req.user))throw new HttpError(403,'Akun ini hanya dapat melihat inventory OCC. Hubungi administrator untuk perubahan.');};
const currentDay=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Jakarta'});
const formKind=input=>choice(input,'kind',['asset','cctv','availability'],'asset');
const formLabel=kind=>kind==='asset'?'Form Inventory OCC':kind==='cctv'?'Pengecekan CCTV':'Pengecekan Inventory';
export function occRoutes(app,view,url){
 app.get('/occ-documentation',async(req,res)=>{const asset=await new OccRepository(req.db,req.user.id).asset(text(req.query,'id',80,true));return view(req,res,'occ-documentation',{...defaults,label:'Dokumentasi OCC',occPage:'occ-assets',occAsset:asset,occPictures:await occPhotos(req.db,asset)});});
 app.get('/occ-photo',async(req,res)=>{const asset=await new OccRepository(req.db,req.user.id).asset(text(req.query,'id',80,true)),pictures=await occPhotos(req.db,asset),index=Number(text(req.query,'index',4)||0);if(!Number.isSafeInteger(index)||index<0||!pictures[index])throw new HttpError(404,'Foto dokumentasi belum tersedia.');res.type('image/webp').send(await req.storage.get(pictures[index].path));});
 app.get('/occ-meeting-form',async(req,res)=>{requireEditor(req);const id=recordId(req.query),repo=new OccMeetings(req.db,req.user.id);const row=id?await repo.get(id):{start_at:'',end_at:'',version:0};return view(req,res,'occ-meeting',{label:id?'Edit meeting OCC':'Jadwalkan meeting OCC',occPage:'occ-dashboard',row:{...row,start_at:meetingLocal(row.start_at),end_at:meetingLocal(row.end_at)}});});
 app.post('/occ-meeting-save',async(req,res)=>{requireEditor(req);req.auth.csrf(req);try{const day=await new OccMeetings(req.db,req.user.id).save(req.body);await req.auth.flash(req,'Jadwal meeting OCC berhasil disimpan.');return res.redirect(303,url('occ-dashboard',{meeting_date:day}));}catch(error){if(!error.status)throw error;res.status(error.status);return view(req,res,'occ-meeting',{label:'Periksa jadwal meeting',occPage:'occ-dashboard',row:Object.fromEntries(['id','version','title','start_at','end_at','meeting_url','notes'].map(k=>[k,typeof req.body[k]==='string'?req.body[k]:''])),errorMessage:error.message});}});
 app.post('/occ-meeting-delete',async(req,res)=>{requireEditor(req);req.auth.csrf(req);const day=await new OccMeetings(req.db,req.user.id).remove(req.body);await req.auth.flash(req,'Jadwal meeting OCC berhasil dihapus.');res.redirect(303,url('occ-dashboard',{meeting_date:day}));});
 app.get('/occ-export',async(req,res)=>{const filters=occFilters(req.query),data=await new OccRepository(req.db,req.user.id).data(filters),kind=choice(req.query,'kind',['assets','cctv','availability'],'assets');const assets=kind==='assets',keys=kind==='cctv'?OCC_CCTV_SITES:OCC_ITEMS,checks=kind==='cctv'?data.cctv:data.availability;const rows=assets?[['Kategori','Aset','Kode setup','Qty','Brand','Model','Penempatan','Ketersediaan','Kondisi','Spesifikasi','Perangkat terkait','Catatan'],...data.assets.map(a=>[a.category,a.name,a.asset_code,a.qty,a.brand,a.model,a.placement,a.availability,a.condition,a.specifications,a.related_device,a.notes])]:[['Tanggal',...keys,'Catatan'],...checks.map(r=>[r.work_date,...keys.map(k=>r.statuses[k]||'Not Checked'),r.notes])];res.attachment('DHOCC_OCC_'+kind+'.xlsx').type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').send(reportWorkbook([{name:assets?'Inventory OCC':kind==='cctv'?'CCTV Availability':'Inventory Availability',title:'DHOCC · '+(assets?'Inventory OCC':kind==='cctv'?'CCTV Availability':'Inventory Availability'),subtitle:`OCC Jakarta Head Office · ${filters.work_date||[filters.from||'Awal data',filters.to||'Akhir data'].join(' s.d. ')} · ${rows.length-1} baris`,note:'Sumber: tiga tab spreadsheet OCC. Seluruh hasil filter diekspor; data asli tidak diubah.',rows}]));});
 for(const page of Object.keys(labels))app.get('/'+page,async(req,res)=>{
  const filters=occFilters(req.query),data=await new OccRepository(req.db,req.user.id).data(filters);
  const meetingDay=date(req.query,'meeting_date',false)||currentDay(),meetings=page==='occ-dashboard'?await new OccMeetings(req.db,req.user.id).list(meetingDay):[];
  const photoSetting=await one(req.db,"SELECT setting_value FROM fleetsync.app_settings WHERE setting_key='occ_photos_v1'");let manifest={};try{manifest=JSON.parse(photoSetting?.setting_value||'{}');}catch{}
  for(const asset of data.assets)asset.photo_count=manifest[driveReference(asset.photo_url)]?.length||0;
  return view(req,res,'occ',{...defaults,label:labels[page],occPage:page,occFilters:filters,occAssets:data.assets,occAllAssets:data.allAssets,occCctv:data.cctv,occAvailability:data.availability,occSelectedCctv:data.selectedCctv,occSelectedInventory:data.selectedInventory,occSummary:data.summary,meetings,meetingDay,meetingTime});
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
