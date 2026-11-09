import {OccRepository,occFilters,blankOccAsset,OCC_ITEMS,OCC_CCTV_SITES,OCC_STATUSES,OCC_CCTV_STATUSES,OCC_ASSET_AVAILABILITY,OCC_CONDITIONS,OCC_SOURCE_URL,occStatusSummary,occStatusTone} from './occ.js';
import {canEditData} from './auth.js';
import {HttpError,choice,text,date} from './validation.js';

const labels={'occ-dashboard':'Dashboard OCC JHO','occ-cctv':'CCTV Availability','occ-availability':'Inventory Availability','occ-assets':'Inventory OCC'};
const defaults={OCC_ITEMS,OCC_CCTV_SITES,occStatuses:OCC_STATUSES,occCctvStatuses:OCC_CCTV_STATUSES,occAssetAvailability:OCC_ASSET_AVAILABILITY,occConditions:OCC_CONDITIONS,occSourceUrl:OCC_SOURCE_URL,occStatusSummary,occStatusTone};
const requireEditor=req=>{if(!canEditData(req.user))throw new HttpError(403,'Akun ini hanya dapat melihat inventory OCC. Hubungi administrator untuk perubahan.');};
const currentDay=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Jakarta'});
const formKind=input=>choice(input,'kind',['asset','cctv','availability'],'asset');
const formLabel=kind=>kind==='asset'?'Form Inventory OCC':kind==='cctv'?'Pengecekan CCTV':'Pengecekan Inventory';
export function occRoutes(app,view,url){
 for(const page of Object.keys(labels))app.get('/'+page,async(req,res)=>{
  const filters=occFilters(req.query),data=await new OccRepository(req.db,req.user.id).data(filters);
  return view(req,res,'occ',{...defaults,label:labels[page],occPage:page,occFilters:filters,occAssets:data.assets,occAllAssets:data.allAssets,occCctv:data.cctv,occAvailability:data.availability,occSelectedCctv:data.selectedCctv,occSelectedInventory:data.selectedInventory,occSummary:data.summary});
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
