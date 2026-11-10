import express from 'express';
import {readFile} from 'node:fs/promises';
import {versionModuleImports} from './asset-modules.js';
import multer from 'multer';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ejs from 'ejs';
import templates,{assetVersion} from '../../frontend/views.generated.js';
import { database, initialize, audit, one } from './db.js';
import { Auth, ROLE, accountVersion, canEditData } from './auth.js';
import { Mailer } from './mail.js';
import { Recovery } from './recovery.js';
import { equipmentOptions, addEquipmentOption, removeEquipmentOption, suggestedKind } from './catalog.js';
import { speedRoutes } from './speed-routes.js';
import {lineupFleet} from './fleet-data.js';
import {occRoutes} from './occ-routes.js';
import { Repository } from './repository.js';
import { Storage } from './storage.js';
import * as validation from './validation.js';
import { HEADERS,readSpreadsheet,exportRows,xlsx,csv } from './spreadsheet.js';

const ROOT=fileURLToPath(new URL('../../',import.meta.url));
const pages=['lineup','dashboard','detail','lineup-form','master','operator-form','import','audit','profile','accounts','account-reset','account-edit'];
const actions=['lineup-save','lineup-delete','operator-save','operator-delete','profile-save','account-create','logout','import'];
const titles={'lineup':'DH Line Up',dashboard:'Dashboard',detail:'Detail Unit','lineup-form':'Form Line Up',master:'Operator','operator-form':'Form Operator',dokumentasi:'Dokumentasi',import:'Impor Data',audit:'Riwayat Perubahan',profile:'Profil Saya',accounts:'Kelola Akun','account-reset':'Reset Password Akun','account-edit':'Edit Profil & Role',login:'Login',setup:'Buat Akun Pertama','forgot-password':'Lupa Password','reset-password':'Password Baru',error:'Kesalahan'};
const url=(page='lineup',params={})=>'/'+page+(Object.keys(params).length?'?'+new URLSearchParams(Object.entries(params).filter(([,v])=>v!==undefined&&v!==null)).toString():'');
const asset=name=>'/assets/'+name+(/\.(?:js|css)$/.test(name)?'?v='+assetVersion:'');
const dateId=(value,short=false)=>value?new Intl.DateTimeFormat('id-ID',{day:'2-digit',month:short?'short':'long',...(short?{}:{year:'numeric'}),timeZone:'Asia/Jakarta'}).format(new Date(String(value).slice(0,10)+'T00:00:00Z')):'-';
const status=row=>row.dh==='Ya'&&row.mine==='Ya'&&row.ftw==='Ya'?['SESUAI','green']:row.mine==='Belum dicek'||row.ftw==='Belum dicek'?['BELUM DICEK','amber']:['TINDAK LANJUT','red'];
const chipTone=value=>value==='Ya'?'green':value==='Tidak'?'red':value==='Belum dicek'?'amber':'muted';
const evidenceUrl=name=>url('media',{path:name});
const avatarUrl=user=>url('avatar',{id:user.id,v:user.profile_photo?.split('/').at(-1)||''});
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:10*1024*1024,files:2,fields:40,fieldSize:30000}}).fields([{name:'proof_ftw',maxCount:1},{name:'proof_mine',maxCount:1},{name:'profile_photo',maxCount:1},{name:'spreadsheet',maxCount:1}]);

export function createApp({ db:providedDb, storage:providedStorage, mailer:providedMailer, production=Boolean(process.env.VERCEL), activationHash=process.env.BOOTSTRAP_CODE_HASH || '' }={}, app=express()) {
  app.disable('x-powered-by');app.set('trust proxy',production?1:false);app.set('views',path.join(ROOT,'frontend/views'));app.set('view engine','ejs');
  app.use((req,res,next)=>{res.set({'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'same-origin','Cache-Control':'no-store',"Content-Security-Policy":"default-src 'self'; img-src 'self' blob: data: https://*.supabase.co https://services.arcgisonline.com https://server.arcgisonline.com https://tile.openstreetmap.org; connect-src 'self' https://*.supabase.co; style-src 'self' 'unsafe-inline'; script-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"});next();});
  const scriptRoot=path.join(ROOT,'frontend/assets/js'),scriptCache=new Map();
  app.get(/^\/assets\/js\/(.+\.js)$/,async(req,res,next)=>{
    const filename=path.resolve(scriptRoot,req.params[0]);if(!filename.startsWith(scriptRoot+path.sep))return next();
    try{if(!scriptCache.has(filename))scriptCache.set(filename,versionModuleImports(await readFile(filename,'utf8'),assetVersion));res.type('text/javascript').send(scriptCache.get(filename));}
    catch(error){if(['ENOENT','ENOTDIR'].includes(error.code))return next();throw error;}
  });
  app.use('/assets',express.static(path.join(ROOT,'frontend/assets'),{dotfiles:'deny',index:false,maxAge:0}));
  app.get('/health',(_req,res)=>res.json({status:'ok',runtime:'node',version:'2.0.0'}));
  app.use(express.urlencoded({extended:false,limit:'100kb'}));app.use(express.json({limit:'100kb'}));
  let services;
  async function getServices() {
    if(!services) services=(async()=>{const db=providedDb || await database();if(!production&&!providedDb) await initialize(db);const auth=new Auth(db,{production,activationHash}),mail=providedMailer || new Mailer();return {db,storage:providedStorage || new Storage(),auth,recovery:new Recovery(db,auth,mail),mail};})().catch(error=>{services=null;throw error;});
    return services;
  }
  app.use(async(req,res,next)=>{const service=await getServices();Object.assign(req,service);await req.auth.session(req,res);next();});
  const view=async(req,res,page,data={})=>{
    const flash=await req.auth.takeFlash(req);
    if(['lineup-form','operator-form'].includes(page)) {data.equipmentCatalog=await equipmentOptions(req.db);if(data.row&&!data.row.equipment_kind){const suggestion=suggestedKind(data.row.unit);const available=data.equipmentCatalog.kind.find(value=>value.toLocaleLowerCase('id-ID')===suggestion.toLocaleLowerCase('id-ID'));if(available)data.row.equipment_kind=available;}}
    const locals={page,label:titles[page],user:req.user,canEditData:canEditData(req.user),csrf:req.session.csrf,flash,errorMessage:'',retryAfter:0,recoverySettings:{},mailReady:req.mail.ready,values:{},row:{},rows:[],filters:{},total:0,accounts:[],title:'',message:'',activationRequired:production,speedPage:'',occPage:'',storageMode:req.storage.client?'signed':'local',url,asset,dateId,status,chipTone,evidenceUrl,avatarUrl,ROLE,accountVersion,...validation,...data};
    const html=ejs.render(templates['layout.ejs'],locals,{filename:'fleetsync/layout.ejs',cache:production,includer(name){
      const key=name.replace(/^(\.\.\/)+/,'').replace(/\.ejs$/,'')+'.ejs';
      if(!Object.hasOwn(templates,key)) throw new Error('Template tidak ditemukan.');
      return {filename:'fleetsync/'+key,template:templates[key]};
    }});
    res.type('html').send(html);
  };
  app.get('/',(_req,res)=>res.redirect(303,url('lineup')));
  app.use(async(req,res,next)=>{
    const page=req.path.slice(1);
    if(await req.auth.needsSetup()) { if(page!=='setup') return res.redirect(303,url('setup')); }
    else if(page==='setup') return res.redirect(303,url(req.user?'lineup':'login'));
    if(!req.user&&!['login','setup','forgot-password','reset-password'].includes(page)) { if(['/upload-ticket','/equipment-option','/equipment-option-delete'].includes(req.path)) return res.status(401).json({error:'Silakan masuk kembali.'});return res.redirect(303,url('login')); }
    if(req.user&&['login','forgot-password','reset-password'].includes(page)) return res.redirect(303,url('lineup'));
    if(req.user?.must_change_password&&!['profile','password-change','logout','avatar'].includes(page)) {
      if(['upload-ticket','equipment-option','equipment-option-delete'].includes(page)) return res.status(403).json({error:'Ganti password sementara di Profil sebelum melanjutkan.'});
      return res.redirect(303,url('profile'));
    }
    const mutation=['lineup-save','lineup-delete','operator-save','operator-delete','import','upload-ticket','equipment-option','equipment-option-delete'].includes(page)&&req.method==='POST';
    const editor=['lineup-form','import'].includes(page)||(page==='operator-form'&&!req.query.id);
    if(req.user&&!canEditData(req.user)&&((mutation&&!(page==='upload-ticket'&&req.body.kind==='profile_photo'))||editor)) {
      if(['upload-ticket','equipment-option','equipment-option-delete'].includes(page)) return res.status(403).json({error:'Akun ini hanya memiliki akses lihat data.'});
      throw new validation.HttpError(403,'Akun ini hanya dapat melihat dan mengekspor data. Hubungi administrator untuk perubahan Line Up atau Operator.');
    }
    req.repo=new Repository(req.db,req.user?.id);next();
  });
  for(const page of ['setup','login','forgot-password','reset-password']) app.all('/'+page,async(req,res)=>{
    if(!['GET','POST','HEAD'].includes(req.method)) throw new validation.HttpError(405,'Metode tidak didukung.');
    if(page==='reset-password'&&!req.mail.ready) return res.redirect(303,url('forgot-password'));
    let errorMessage='',retryAfter=0;
    if(req.method==='POST') {
      req.auth.csrf(req);
      try {
        if(page==='forgot-password') {
          await req.recovery.request(req);
          await req.auth.flash(req,'Jika username dan email cocok dengan email yang sudah diverifikasi, kode reset dikirim. Periksa inbox atau spam. Kode berlaku 10 menit.');
          return res.redirect(303,url('reset-password'));
        }
        if(page==='reset-password') await req.recovery.reset(req,res);else await req.auth[page](req,res);
        await req.auth.flash(req,page==='setup'?'Akun pertama berhasil dibuat.':page==='reset-password'?'Password berhasil diganti. Masuk dengan password baru.':'Login berhasil.');
        return res.redirect(303,url(page==='reset-password'?'login':'lineup'));
      }
      catch(error) { if(!error.status&&error.code!=='23505') throw error;res.status(error.status||409);retryAfter=error.retryAfter||0;if(retryAfter) res.set('Retry-After',String(retryAfter));errorMessage=error.code==='23505'?'Username sudah digunakan.':error.message; }
    }
    return view(req,res,page,{errorMessage,retryAfter,values:{name:typeof req.body?.name==='string'?req.body.name:'',username:typeof req.body?.username==='string'?req.body.username:'',email:typeof req.body?.email==='string'?req.body.email:''}});
  });
  app.post('/password-change',async(req,res)=>{
    req.auth.csrf(req);
    try {
      await req.auth.changePassword(req,res);
      await req.auth.flash(req,'Password berhasil diganti. Semua sesi lama sudah keluar. Masuk kembali dengan password baru.');
      return res.redirect(303,url('login'));
    } catch(error) {
      if(!error.status) throw error;
      res.status(error.status);if(error.retryAfter) res.set('Retry-After',String(error.retryAfter));
      return view(req,res,'profile',{values:req.user,errorMessage:error.message,recoverySettings:await req.recovery.settings(req.user.id)});
    }
  });
  app.post('/account-password-reset',async(req,res)=>{
    if(!req.user.is_admin) throw new validation.HttpError(403,'Hanya administrator yang dapat mereset password akun lain.');
    req.auth.csrf(req);
    try {
      const username=await req.auth.resetAccountPassword(req);
      await req.auth.flash(req,`Password sementara untuk @${username} sudah disimpan. Sampaikan secara pribadi; pengguna wajib menggantinya setelah masuk.`);
      return res.redirect(303,url('accounts'));
    } catch(error) {
      if(!error.status) throw error;
      const id=validation.recordId(req.body,'id',true),row=await one(req.db,'SELECT id,name,username FROM fleetsync.users WHERE id=$1',[id]);
      if(!row) throw new validation.HttpError(404,'Akun tidak ditemukan.');
      res.status(error.status);if(error.retryAfter) res.set('Retry-After',String(error.retryAfter));
      return view(req,res,'account-reset',{row,errorMessage:error.message});
    }
  });
  app.post('/account-update',async(req,res)=>{
    if(!req.user.is_admin) throw new validation.HttpError(403,'Hanya administrator yang dapat mengubah profil dan role akun lain.');
    req.auth.csrf(req);
    try {
      const result=await req.auth.editAccount(req,res);
      await req.auth.flash(req,`Profil dan role @${result.username} berhasil disimpan.${result.credentialsChanged?' Sesi akun tersebut sudah dikeluarkan.':''}${result.relogin?' Masuk kembali untuk melanjutkan.':''}`);
      return res.redirect(303,url(result.relogin?'login':'accounts'));
    } catch(error) {
      if(!error.status&&error.code!=='23505') throw error;
      const id=validation.recordId(req.body,'id',true),row=await one(req.db,'SELECT id,name,username,is_admin,nik,site,profile_photo FROM fleetsync.users WHERE id=$1',[id]);
      if(!row) throw new validation.HttpError(404,'Akun tidak ditemukan.');
      res.status(error.status||409);if(error.retryAfter) res.set('Retry-After',String(error.retryAfter));
      const values=Object.fromEntries(Object.entries(req.body).filter(([key,value])=>['name','username','nik','site','role','account_version'].includes(key)&&typeof value==='string'));
      return view(req,res,'account-edit',{row,values,errorMessage:error.code==='23505'?'Username sudah digunakan akun lain.':error.message});
    }
  });
  for(const action of ['recovery-email-save','recovery-email-verify']) app.post('/'+action,async(req,res)=>{
    req.auth.csrf(req);
    try {
      await req.recovery[action==='recovery-email-save'?'enroll':'verify'](req);
      await req.auth.flash(req,action==='recovery-email-save'?'Kode verifikasi sudah dikirim. Periksa inbox atau spam, lalu masukkan kodenya di Profil.':'Email pemulihan berhasil diverifikasi.');
      return res.redirect(303,url('profile'));
    }
    catch(error) {
      if(!error.status) throw error;
      res.status(error.status);if(error.retryAfter) res.set('Retry-After',String(error.retryAfter));
      return view(req,res,'profile',{values:req.user,recoverySettings:await req.recovery.settings(req.user.id),errorMessage:error.message});
    }
  });
  app.post('/equipment-option',async(req,res)=>{
    req.auth.csrf(req);
    try {res.json({value:await addEquipmentOption(req.db,req.user.id,req.body)});} catch(error) {if(!error.status) throw error;res.status(error.status).json({error:error.message});}
  });
  app.post('/equipment-option-delete',async(req,res)=>{
    req.auth.csrf(req);
    try {res.json(await removeEquipmentOption(req.db,req.user.id,req.body));} catch(error) {if(!error.status)throw error;res.status(error.status).json({error:error.message});}
  });
  app.post('/upload-ticket',async(req,res)=>{req.auth.csrf(req);const ticket=await req.storage.issue(req.db,req.user,req.body);res.json(ticket);});
  app.get('/avatar',async(req,res)=>{
    const id=validation.recordId(req.query,'id',true);
    if(String(id)!==String(req.user.id)&&!req.user.is_admin) throw new validation.HttpError(403,'Foto profil hanya tersedia untuk pemilik akun dan administrator.');
    const account=await one(req.db,'SELECT profile_photo FROM fleetsync.users WHERE id=$1',[id]);
    if(!account?.profile_photo) throw new validation.HttpError(404,'Foto profil belum tersedia.');
    const signed=await req.storage.signedMedia(account.profile_photo);if(signed)return res.redirect(302,signed);
    const name=account.profile_photo;res.type(name.endsWith('.webp')?'image/webp':name.endsWith('.jpg')?'image/jpeg':'image/png').send(await req.storage.get(name));
  });
  app.get('/media',async(req,res)=>{
    const name=validation.text(req.query,'path',255,true);req.storage.valid(name);
    if(name.startsWith('incoming/')) throw new validation.HttpError(404,'Gambar tidak ditemukan.');
    const signed=await req.storage.signedMedia(name);if(signed) return res.redirect(302,signed);
    res.type(name.endsWith('.jpg')?'image/jpeg':name.endsWith('.webp')?'image/webp':'image/png').send(await req.storage.get(name));
  });
  app.get('/export',async(req,res)=>{
    const filters=validation.filters(req.query),kind=validation.choice(req.query,'kind',['lineup','master','template'],'lineup'),format=validation.choice(req.query,'format',['xlsx','csv'],'xlsx');
    const rows=kind==='template'?[HEADERS]:exportRows(kind==='master'?await req.repo.operators(filters):await req.repo.lineups(filters),kind);
    res.attachment(`DHOCC_${kind}.${format}`).type(format==='csv'?'text/csv; charset=utf-8':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').send(format==='csv'?csv(rows):xlsx(rows,kind==='template'?{}:{name:kind==='master'?'Operator':'DH Line Up',title:kind==='master'?'DHOCC · Operator':'DHOCC · DH Line Up',subtitle:`Site ${filters.site} · ${filters.work_date||'Semua tanggal'} · ${rows.length-1} baris`,note:'Ekspor seluruh hasil sesuai filter aktif. Nomor identitas disimpan sebagai teks.'}));
  });
  app.get('/dokumentasi',(_req,res)=>res.redirect(303,url('lineup')));
  speedRoutes(app,view,url,upload);
  occRoutes(app,view,url,upload);
  for(const page of pages) app.get('/'+page,async(req,res)=>{
    const filters=validation.filters(req.query),data={filters};
    if(page==='lineup') {data.rows=await req.repo.lineups(filters);data.total=Number((await one(req.db,'SELECT count(*) AS n FROM fleetsync.lineups')).n);}
    if(page==='dashboard') {
      data.historyRows=await req.repo.lineups({site:filters.site,shift:filters.shift});
      filters.work_date=filters.work_date||validation.date(req.query,'scene_date',false)||'';
      data.rows=filters.work_date?data.historyRows.filter(row=>row.work_date===filters.work_date):data.historyRows;
      data.lineupSceneDate=filters.work_date||data.historyRows.at(-1)?.work_date||new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Jakarta'});
      data.lineupSceneData=lineupFleet(data.historyRows,data.lineupSceneDate,url);
    }
    if(page==='import')data.importShift=filters.shift==='All'?'Belum ditentukan':filters.shift;
    if(page==='master') data.rows=await req.repo.operators(filters);
    if(page==='detail') data.row=await req.repo.lineup(validation.text(req.query,'id',80,true));
    if(page==='lineup-form'){data.row=req.query.id?await req.repo.lineup(validation.text(req.query,'id',80,true)):validation.blankLineup();if(!req.query.id){data.row.site=filters.site;data.row.work_date=filters.work_date||data.row.work_date;data.row.shift=filters.shift==='All'?data.row.shift:filters.shift;}}
    if(page==='operator-form') data.row=req.query.id?await req.repo.operator(validation.recordId(req.query,'id',true)):{id:'',version:0,site:'BCP',name:'',nik:'',unit:'',equipment:'',last_date:new Date().toISOString().slice(0,10)};
    if(page==='operator-form'&&!canEditData(req.user)) data.label='Profil Operator';
    if(page==='audit') data.rows=await req.repo.auditRows();
    if(page==='profile') {data.values=req.user;data.recoverySettings=await req.recovery.settings(req.user.id);}
    if(page==='accounts') data.accounts=(await req.db.query('SELECT id,name,username,created_at,is_admin,must_change_password,can_edit_data FROM fleetsync.users ORDER BY created_at,id')).rows;
    if(page==='account-reset') {
      if(!req.user.is_admin) throw new validation.HttpError(403,'Hanya administrator yang dapat mereset password akun lain.');
      const id=validation.recordId(req.query,'id',true);
      if(String(id)===String(req.user.id)) return res.redirect(303,url('profile')+'#password-title');
      data.row=await one(req.db,'SELECT id,name,username FROM fleetsync.users WHERE id=$1',[id]);
      if(!data.row) throw new validation.HttpError(404,'Akun tidak ditemukan.');
    }
    if(page==='account-edit') {
      if(!req.user.is_admin) throw new validation.HttpError(403,'Hanya administrator yang dapat mengubah profil dan role akun lain.');
      data.row=await one(req.db,'SELECT id,name,username,is_admin,nik,site,profile_photo FROM fleetsync.users WHERE id=$1',[validation.recordId(req.query,'id',true)]);
      if(!data.row) throw new validation.HttpError(404,'Akun tidak ditemukan.');
      data.values={name:data.row.name,username:data.row.username,role:data.row.is_admin?'Administrator':ROLE,account_version:accountVersion(data.row)};
    }
    return view(req,res,page,data);
  });
  for(const action of actions) app.post('/'+action,upload,async(req,res)=>{
    req.auth.csrf(req);const newFiles=[],temporary=[];
    try {
      if(action==='logout') {await req.auth.logout(req,res);return res.redirect(303,url('login'));}
      if(action==='profile-save'||action==='account-create') {
        if(action==='profile-save') {
          await req.auth.saveProfile(req,async tx=>{
            let file=req.files?.profile_photo?.[0];
            if(req.body.profile_photo_ticket) {const item=await req.storage.consume(tx,req.user,validation.text(req.body,'profile_photo_ticket',64,true),'profile_photo');temporary.push(item.temporaryPath);file={buffer:item.bytes};}
            if(file) {const photo=await req.storage.image(file.buffer,{avatar:true});newFiles.push(photo);return photo;}
            return validation.text(req.body,'remove_profile_photo',1)==='1'?'':undefined;
          });
          await Promise.allSettled(temporary.map(name=>req.storage.remove(name)));
        } else await req.auth.createAccount(req);
        await req.auth.flash(req,action==='profile-save'?'Profil berhasil diperbarui.':'Akun Pengelola berhasil dibuat.');return res.redirect(303,url(action==='profile-save'?'profile':'accounts'));
      }
      let target='lineup',params={},message='Data berhasil disimpan.';
      await req.db.transaction(async tx=>{
        const id=validation.text(req.body,'id',80);
        if(action==='lineup-save') {
          const row=validation.lineup(req.body),old=id?await new Repository(tx,req.user.id).lineup(id):validation.blankLineup();
          for(const field of ['note','source_status','equipment_kind']) if(!Object.hasOwn(req.body,field)) row[field]=old[field]||'';
          for(const field of ['proof_ftw','proof_mine']) {
            let file=req.files?.[field]?.[0];
            if(req.body[field+'_ticket']) {const item=await req.storage.consume(tx,req.user,validation.text(req.body,field+'_ticket',64,true),field);temporary.push(item.temporaryPath);file={buffer:item.bytes};}
            const uploaded=file?await req.storage.image(file.buffer):null;if(uploaded) newFiles.push(uploaded);
            row[field]=uploaded||(req.body['remove_'+field]?'':old[field]);
          }
          let saved=id;
          if(id) await req.repo.update(tx,id,validation.version(req.body),row);else saved=await req.repo.insert(tx,row);
          target='detail';params={id:saved};message='Line Up berhasil disimpan.';
        } else if(action==='lineup-delete') { await req.repo.delete(tx,id,validation.version(req.body));message='Line Up dihapus. Bukti arsip tetap tersimpan.'; }
        else if(action==='operator-save') {const row=validation.operator(req.body);if(!Object.hasOwn(req.body,'equipment_kind')&&id) row.equipment_kind=(await new Repository(tx,req.user.id).operator(id)).equipment_kind;await req.repo.saveOperator(tx,row,validation.recordId(req.body),validation.version(req.body));target='master';params={site:row.site};message='Operator berhasil disimpan.';}
        else if(action==='operator-delete') {await req.repo.deleteOperator(tx,validation.recordId(req.body,'id',true),validation.version(req.body));target='master';message='Operator berhasil dihapus.';}
        else if(action==='import') {
          let file=req.files?.spreadsheet?.[0],extension=file?path.extname(file.originalname).slice(1).toLowerCase():'';
          if(req.body.spreadsheet_ticket) {const item=await req.storage.consume(tx,req.user,validation.text(req.body,'spreadsheet_ticket',64,true),'spreadsheet');temporary.push(item.temporaryPath);file={buffer:item.bytes};extension=item.extension;}
          if(!file) throw new validation.HttpError(422,'Pilih file XLSX/CSV maksimal 10 MB.');
          const fallbackShift=validation.choice(req.body,'fallback_shift',validation.SHIFTS,'Belum ditentukan'),rows=readSpreadsheet(file.buffer,extension,{fallbackShift});let inserted=0,skipped=0;
          for(const row of rows) {if(await req.repo.insert(tx,row,undefined,{skipDuplicate:true})) inserted++;else skipped++;}
          await audit(tx,req.user.id,'import','lineup','',{inserted,skipped});message=`Impor selesai: ${inserted} data ditambahkan, ${skipped} duplikat dilewati.`;
        }
      });
      await Promise.allSettled(temporary.map(name=>req.storage.remove(name)));await req.auth.flash(req,message);return res.redirect(303,url(target,params));
    } catch(error) {
      await Promise.allSettled(newFiles.map(name=>req.storage.remove(name)));
      if(!error.status&&error.code!=='23505') throw error;
      res.status(error.status||409);if(error.retryAfter) res.set('Retry-After',String(error.retryAfter));const errorMessage=error.code==='23505'?(action.includes('account')||action==='profile-save'?'Username sudah digunakan.':'Data duplikat. Periksa identitas operator atau penugasan.'):error.message;
      const values=Object.fromEntries(Object.entries(req.body).filter(([key,value])=>['name','username','nik','site'].includes(key)&&typeof value==='string'));
      if(action==='profile-save') return view(req,res,'profile',{values:{...req.user,...values},errorMessage,recoverySettings:await req.recovery.settings(req.user.id)});
      if(action==='account-create') return view(req,res,'accounts',{values,errorMessage,accounts:(await req.db.query('SELECT id,name,username,created_at,is_admin,must_change_password,can_edit_data FROM fleetsync.users ORDER BY created_at,id')).rows});
      if(action==='import') return view(req,res,'import',{errorMessage,importShift:validation.SHIFTS.includes(req.body.fallback_shift)?req.body.fallback_shift:'Belum ditentukan'});
      if(['lineup-save','operator-save'].includes(action)) {
        const isLineup=action==='lineup-save',safeKeys=isLineup?['site','work_date','shift','type_category','unit','equipment','equipment_kind','operator_name','nik','dh','mine','ftw','source_status','note']:['site','name','nik','unit','equipment','equipment_kind','last_date'];
        const id=validation.text(req.body,'id',80),base=id?await req.repo[isLineup?'lineup':'operator'](id):isLineup?validation.blankLineup():{id:'',version:0};
        const row={...base,...Object.fromEntries(Object.entries(req.body).filter(([key,value])=>safeKeys.includes(key)&&typeof value==='string')),version:req.body.version};
        return view(req,res,isLineup?'lineup-form':'operator-form',{row,errorMessage});
      }
      throw new validation.HttpError(error.status||409,errorMessage);
    }
  });
  app.use((req,_res,next)=>next(new validation.HttpError(actions.includes(req.path.slice(1))?405:404,actions.includes(req.path.slice(1))?'Aksi ini harus dikirim melalui formulir.':'Halaman tidak ditemukan.')));
  app.use(async(error,req,res,_next)=>{
    const status=error instanceof multer.MulterError?422:(error.status||503),message=error instanceof multer.MulterError?'Unggahan melebihi batas atau berisi kolom file yang tidak dikenal.':error.status?error.message:'Layanan belum siap. Periksa konfigurasi database dan penyimpanan.';
    if(!error.status&&!(error instanceof multer.MulterError)) console.error('DHOCC request failed:',error.code||error.name);
    if(res.headersSent) return res.end();
    res.status(status);
    if(['/upload-ticket','/equipment-option','/equipment-option-delete'].includes(req.path)) return res.json({error:message});
    try { return await view(req,res,'error',{title:'Permintaan belum dapat diproses',message}); }
    catch { return res.type('html').send('<!doctype html><html lang="id"><meta charset="utf-8"><title>DHOCC</title><h1>Layanan belum siap</h1><p>Periksa konfigurasi database dan penyimpanan.</p></html>'); }
  });
  return app;
}
