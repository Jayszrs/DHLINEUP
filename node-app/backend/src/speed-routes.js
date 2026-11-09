import {SpeedRepository,SpeedFiles,speedFilters,speedUnit,speedNumber,withAverages} from './speed.js';
import {canEditData} from './auth.js';
import {HttpError,text,date} from './validation.js';
import {csv} from './spreadsheet.js';
import {SpeedImporter} from './speed-import.js';
import {speedPeriods} from './speed-periods.js';
const labels={'speed-dashboard':'Dashboard Speed','speed-daily':'Rekap Harian','speed-monthly':'Rekap Bulanan','speed-units':'Daftar Unit','speed-unit':'Laporan Speed Unit'};
export function speedRoutes(app,view,url,upload) {
 const archives=new WeakMap();
 const sourceFiles=storage=>{if(!archives.has(storage))archives.set(storage,new SpeedFiles(storage));return archives.get(storage);};
 const requireEditor=req=>{if(!canEditData(req.user))throw new HttpError(403,'Akun ini memiliki akses lihat laporan speed. Hubungi administrator untuk perubahan rekap.');};
 const importer=req=>new SpeedImporter(req.db,req.storage,sourceFiles(req.storage),req.user);
 const importView=(req,res,job=null,data={})=>view(req,res,'speed-import',{label:'Impor Speed MDVR',speedPage:'speed-import',job,speedNumber,withAverages,unit:'',...data});
 app.get('/speed-import',async(req,res)=>{requireEditor(req);const id=text(req.query,'job',64);return importView(req,res,id?await importer(req).job(id):null);});
 app.get('/speed-import-plan',async(req,res)=>{requireEditor(req);const job=await importer(req).job(text(req.query,'job',64,true));res.attachment('pratinjau-speed.csv').type('text/csv').send(csv([['Unit','Tanggal','Catatan','Bergerak','Jumlah Speed','Speed Tertinggi','Tindakan'],...job.metadata.daily.map(r=>[r.unit,r.work_date,r.total_count,r.moving_count,r.speed_sum,r.max_speed,r.version?'Perbarui':'Tambah'])]));});
 app.post('/speed-import-preview',(req,_res,next)=>{requireEditor(req);next();},upload,async(req,res)=>{
  req.auth.csrf(req);let temporary='';
  try{
   let file=req.files?.spreadsheet?.[0],extension=file?.originalname.split('.').at(-1).toLowerCase(),filename=file?.originalname||text(req.body,'filename',180)||'MDVR';
   if(req.body.spreadsheet_ticket){const item=await req.db.transaction(tx=>req.storage.consume(tx,req.user,text(req.body,'spreadsheet_ticket',64,true),'spreadsheet'));temporary=item.temporaryPath;file={buffer:item.bytes};extension=item.extension;}
   if(!file)throw new HttpError(422,'Pilih file XLSX atau CSV maksimal 10 MB.');
   const job=await importer(req).preview(file.buffer,extension,{unit:text(req.body,'unit',60),filename});
   return res.redirect(303,url('speed-import',{job:job.id}));
  }catch(error){if(!error.status)throw error;res.status(error.status);return importView(req,res,null,{errorMessage:error.message,unit:text(req.body,'unit',60)});}
  finally{if(temporary)await req.storage.remove(temporary).catch(()=>{});}
 });
 app.post('/speed-import-apply',async(req,res)=>{
  requireEditor(req);req.auth.csrf(req);
  try{if(req.body.confirm_replace!=='1')throw new HttpError(422,'Konfirmasi bahwa file memuat data lengkap untuk setiap DT/tanggal yang diperbarui.');const result=await importer(req).apply(text(req.body,'job',64,true));await req.auth.flash(req,result.already?'Impor ini sudah tersimpan. Data tidak digandakan.':`Impor speed selesai: ${result.added} rekap ditambahkan, ${result.replaced} diperbarui. Tanggal lain tetap tersimpan.`);return res.redirect(303,url('speed-dashboard'));}
  catch(error){if(!error.status)throw error;res.status(error.status);return importView(req,res,null,{errorMessage:error.message});}
 });
 for(const page of Object.keys(labels))app.get('/'+page,async(req,res)=>{
  const repo=new SpeedRepository(req.db,req.user.id),filters=speedFilters(req.query),data={speedPage:page,label:labels[page],speedFilters:filters,speedNumber};
  if(page==='speed-unit'){filters.unit=speedUnit(req.query,true);data.speedUnit=await repo.unit(filters.unit);const rawPage=Number(text(req.query,'raw_page',8)||1);if(!Number.isSafeInteger(rawPage)||rawPage<1)throw new HttpError(422,'Halaman GPS tidak valid.');data.tab=text(req.query,'tab',10)==='gps'?'gps':'recap';data.gps=data.tab==='gps'?await repo.records(filters.unit,filters,sourceFiles(req.storage),rawPage):{total:data.speedUnit.raw_count,rows:[],headers:[],page:1,pages:1};data.label='Speed '+filters.unit;}
  [data.speedSummary,data.speedDaily,data.speedUnits]=await Promise.all([repo.summary(filters),repo.daily(filters),repo.units(filters)]);
  if(page==='speed-dashboard')data.speedPeriods=speedPeriods(data.speedDaily);
  if(['speed-dashboard','speed-monthly'].includes(page))data.speedMonthly=await repo.monthly(filters);
  return view(req,res,'speed',data);
 });
 app.get('/speed-form',async(req,res)=>{requireEditor(req);const repo=new SpeedRepository(req.db,req.user.id),unit=speedUnit(req.query),day=date(req.query,'work_date',false);const row=unit&&day?await repo.record(unit,day):null;return view(req,res,'speed-form',{label:row?'Edit Rekap Speed':'Input Rekap Speed',speedPage:'speed-form',speedUnits:await repo.units(),row:row||{unit,work_date:day||new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Jakarta'}),version:0,total_count:'',moving_count:'',speed_sum:'',max_speed:''}});});
 for(const action of ['speed-save','speed-delete'])app.post('/'+action,async(req,res)=>{
  requireEditor(req);req.auth.csrf(req);const repo=new SpeedRepository(req.db,req.user.id);
  try{const unit=await repo[action==='speed-save'?'save':'delete'](req.body);await req.auth.flash(req,action==='speed-save'?'Rekap speed berhasil disimpan.':'Rekap speed berhasil dihapus.');res.redirect(303,url('speed-unit',{unit}));}
  catch(error){if(!error.status)throw error;res.status(error.status);return view(req,res,'speed-form',{label:'Periksa Rekap Speed',speedPage:'speed-form',speedUnits:await repo.units(),row:Object.fromEntries(['unit','work_date','version','total_count','moving_count','speed_sum','max_speed'].map(k=>[k,typeof req.body[k]==='string'?req.body[k]:''])),errorMessage:error.message});}
 });
 app.get('/speed-export',async(req,res)=>{const repo=new SpeedRepository(req.db,req.user.id),filters=speedFilters(req.query),kind=text(req.query,'kind',20)||'daily';let rows,first;if(kind==='units'){rows=await repo.units(filters);first='Unit';}else if(kind==='monthly'){rows=await repo.monthly(filters);first='Bulan';}else{rows=await repo.daily(filters);first='Tanggal';}const output=[[first,'Catatan','Bergerak','Berhenti (0)','Jumlah Speed','Rata-rata Semua','Rata-rata Bergerak','Speed Tertinggi','% Bergerak'],...rows.map(r=>[r.unit||r.month||r.work_date,r.total_count,r.moving_count,r.stopped_count,r.speed_sum,r.average??'',r.moving_average??'',r.max_speed??'',r.moving_ratio??''])];res.attachment('DHOCC_Speed_'+kind+'.csv').type('text/csv; charset=utf-8').send(csv(output));});
}
