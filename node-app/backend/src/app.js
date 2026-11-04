import express from 'express';
import multer from 'multer';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ejs from 'ejs';
import templates from '../../frontend/views.generated.js';
import { database, initialize, audit, one } from './db.js';
import { Auth, ROLE } from './auth.js';
import { Repository } from './repository.js';
import { Storage } from './storage.js';
import * as validation from './validation.js';
import { HEADERS,readSpreadsheet,exportRows,xlsx,csv } from './spreadsheet.js';

const ROOT=fileURLToPath(new URL('../../',import.meta.url));
const pages=['lineup','dashboard','detail','lineup-form','master','operator-form','dokumentasi','import','audit','profile','accounts'];
const actions=['lineup-save','lineup-delete','operator-save','operator-delete','profile-save','account-create','logout','import'];
const titles={'lineup':'DH Line Up',dashboard:'Dashboard',detail:'Detail Unit','lineup-form':'Form Line Up',master:'Master Operator','operator-form':'Form Operator',dokumentasi:'Dokumentasi',import:'Impor Data',audit:'Riwayat Perubahan',profile:'Profil Saya',accounts:'Kelola Akun',login:'Login',setup:'Buat Akun Pertama',error:'Kesalahan'};
const url=(page='lineup',params={})=>'/'+page+(Object.keys(params).length?'?'+new URLSearchParams(Object.entries(params).filter(([,v])=>v!==undefined&&v!==null)).toString():'');
const asset=name=>'/assets/'+name;
const dateId=(value,short=false)=>value?new Intl.DateTimeFormat('id-ID',{day:'2-digit',month:short?'short':'long',...(short?{}:{year:'numeric'}),timeZone:'Asia/Jakarta'}).format(new Date(String(value).slice(0,10)+'T00:00:00Z')):'-';
const status=row=>row.dh==='Ya'&&row.mine==='Ya'&&row.ftw==='Ya'?['SESUAI','green']:row.mine==='Belum dicek'||row.ftw==='Belum dicek'?['BELUM DICEK','amber']:['TINDAK LANJUT','red'];
const chipTone=value=>value==='Ya'?'green':value==='Tidak'?'red':value==='Belum dicek'?'amber':'muted';
const evidenceUrl=name=>url('media',{path:name});
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:10*1024*1024,files:2,fields:40,fieldSize:30000}}).fields([{name:'proof_ftw',maxCount:1},{name:'proof_mine',maxCount:1},{name:'spreadsheet',maxCount:1}]);

export function createApp({ db:providedDb, storage:providedStorage, production=Boolean(process.env.VERCEL), activationHash=process.env.BOOTSTRAP_CODE_HASH || '' }={}, app=express()) {
  app.disable('x-powered-by');app.set('trust proxy',production?1:false);app.set('views',path.join(ROOT,'frontend/views'));app.set('view engine','ejs');
  app.use((req,res,next)=>{res.set({'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'same-origin','Cache-Control':'no-store',"Content-Security-Policy":"default-src 'self'; img-src 'self' https://*.supabase.co; connect-src 'self' https://*.supabase.co; style-src 'self' 'unsafe-inline'; script-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"});next();});
  app.use('/assets',express.static(path.join(ROOT,'frontend/assets'),{dotfiles:'deny',index:false,maxAge:0}));
  app.get('/health',(_req,res)=>res.json({status:'ok',runtime:'node',version:'2.0.0'}));
  app.use(express.urlencoded({extended:false,limit:'100kb'}));app.use(express.json({limit:'100kb'}));
  let services;
  async function getServices() {
    if(!services) services=(async()=>{const db=providedDb || await database();if(!production&&!providedDb) await initialize(db);return {db,storage:providedStorage || new Storage(),auth:new Auth(db,{production,activationHash})};})().catch(error=>{services=null;throw error;});
    return services;
  }
  app.use(async(req,res,next)=>{const service=await getServices();Object.assign(req,service);await req.auth.session(req,res);next();});
  const view=async(req,res,page,data={})=>{
    const flash=await req.auth.takeFlash(req);
    const locals={page,label:titles[page],user:req.user,csrf:req.session.csrf,flash,errorMessage:'',values:{},row:{},rows:[],filters:{},total:0,accounts:[],title:'',message:'',activationRequired:production,storageMode:req.storage.client?'signed':'local',url,asset,dateId,status,chipTone,evidenceUrl,ROLE,...validation,...data};
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
    if(!req.user&&!['login','setup'].includes(page)) { if(req.path==='/upload-ticket') return res.status(401).json({error:'Silakan masuk kembali.'});return res.redirect(303,url('login')); }
    if(req.user&&page==='login') return res.redirect(303,url('lineup'));
    req.repo=new Repository(req.db,req.user?.id);next();
  });
  for(const page of ['setup','login']) app.all('/'+page,async(req,res)=>{
    if(!['GET','POST','HEAD'].includes(req.method)) throw new validation.HttpError(405,'Metode tidak didukung.');
    let errorMessage='';
    if(req.method==='POST') {
      req.auth.csrf(req);
      try { await req.auth[page](req,res);await req.auth.flash(req,page==='setup'?'Akun pertama berhasil dibuat.':'Login berhasil.');return res.redirect(303,url('lineup')); }
      catch(error) { if(!error.status&&error.code!=='23505') throw error;res.status(error.status||409);errorMessage=error.code==='23505'?'Username sudah digunakan.':error.message; }
    }
    return view(req,res,page,{errorMessage,values:{name:typeof req.body?.name==='string'?req.body.name:'',username:typeof req.body?.username==='string'?req.body.username:''}});
  });
  app.post('/upload-ticket',async(req,res)=>{req.auth.csrf(req);const ticket=await req.storage.issue(req.db,req.user,req.body);res.json(ticket);});
  app.get('/media',async(req,res)=>{
    const name=validation.text(req.query,'path',255,true);req.storage.valid(name);
    if(name.startsWith('incoming/')) throw new validation.HttpError(404,'Gambar tidak ditemukan.');
    const signed=await req.storage.signedMedia(name);if(signed) return res.redirect(302,signed);
    res.type(name.endsWith('.jpg')?'image/jpeg':name.endsWith('.webp')?'image/webp':'image/png').send(await req.storage.get(name));
  });
  app.get('/export',async(req,res)=>{
    const filters=validation.filters(req.query),kind=validation.choice(req.query,'kind',['lineup','master','template'],'lineup'),format=validation.choice(req.query,'format',['xlsx','csv'],'xlsx');
    const rows=kind==='template'?[HEADERS]:exportRows(kind==='master'?await req.repo.operators(filters):await req.repo.lineups(filters),kind);
    res.attachment(`DH_FleetSync_${kind}.${format}`).type(format==='csv'?'text/csv; charset=utf-8':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').send(format==='csv'?csv(rows):xlsx(rows));
  });
  for(const page of pages) app.get('/'+page,async(req,res)=>{
    const filters=validation.filters(req.query),data={filters};
    if(['lineup','dokumentasi'].includes(page)) {data.rows=await req.repo.lineups(filters);data.total=Number((await one(req.db,'SELECT count(*) AS n FROM fleetsync.lineups')).n);}
    if(page==='dashboard') data.rows=await req.repo.lineups({site:filters.site});
    if(page==='master') data.rows=await req.repo.operators(filters);
    if(page==='detail') data.row=await req.repo.lineup(validation.text(req.query,'id',80,true));
    if(page==='lineup-form') data.row=req.query.id?await req.repo.lineup(validation.text(req.query,'id',80,true)):validation.blankLineup();
    if(page==='operator-form') data.row=req.query.id?await req.repo.operator(validation.recordId(req.query,'id',true)):{id:'',version:0,site:'BCP',name:'',nik:'',unit:'',equipment:'',last_date:new Date().toISOString().slice(0,10)};
    if(page==='audit') data.rows=await req.repo.auditRows();
    if(page==='profile') data.values=req.user;
    if(page==='accounts') data.accounts=(await req.db.query('SELECT id,name,username,created_at FROM fleetsync.users ORDER BY created_at,id')).rows;
    return view(req,res,page,data);
  });
  for(const action of actions) app.post('/'+action,upload,async(req,res)=>{
    req.auth.csrf(req);const newFiles=[],temporary=[];
    try {
      if(action==='logout') {await req.auth.logout(req,res);return res.redirect(303,url('login'));}
      if(action==='profile-save'||action==='account-create') {
        await req.auth[action==='profile-save'?'saveProfile':'createAccount'](req);
        await req.auth.flash(req,action==='profile-save'?'Profil berhasil diperbarui.':'Akun Pengelola berhasil dibuat.');return res.redirect(303,url(action==='profile-save'?'profile':'accounts'));
      }
      let target='lineup',params={},message='Data berhasil disimpan.';
      await req.db.transaction(async tx=>{
        const id=validation.text(req.body,'id',80);
        if(action==='lineup-save') {
          const row=validation.lineup(req.body),old=id?await new Repository(tx,req.user.id).lineup(id):validation.blankLineup();
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
        else if(action==='operator-save') {const row=validation.operator(req.body);await req.repo.saveOperator(tx,row,validation.recordId(req.body),validation.version(req.body));target='master';params={site:row.site};message='Master Operator berhasil disimpan.';}
        else if(action==='operator-delete') {await req.repo.deleteOperator(tx,validation.recordId(req.body,'id',true),validation.version(req.body));target='master';message='Master Operator berhasil dihapus.';}
        else if(action==='import') {
          let file=req.files?.spreadsheet?.[0],extension=file?path.extname(file.originalname).slice(1).toLowerCase():'';
          if(req.body.spreadsheet_ticket) {const item=await req.storage.consume(tx,req.user,validation.text(req.body,'spreadsheet_ticket',64,true),'spreadsheet');temporary.push(item.temporaryPath);file={buffer:item.bytes};extension=item.extension;}
          if(!file) throw new validation.HttpError(422,'Pilih file XLSX/CSV maksimal 10 MB.');
          const rows=readSpreadsheet(file.buffer,extension);let inserted=0,skipped=0;
          for(const row of rows) {if(await req.repo.insert(tx,row,undefined,{skipDuplicate:true})) inserted++;else skipped++;}
          await audit(tx,req.user.id,'import','lineup','',{inserted,skipped});message=`Impor selesai: ${inserted} data ditambahkan, ${skipped} duplikat dilewati.`;
        }
      });
      await Promise.allSettled(temporary.map(name=>req.storage.remove(name)));await req.auth.flash(req,message);return res.redirect(303,url(target,params));
    } catch(error) {
      await Promise.allSettled(newFiles.map(name=>req.storage.remove(name)));
      if(!error.status&&error.code!=='23505') throw error;
      res.status(error.status||409);const errorMessage=error.code==='23505'?(action.includes('account')||action==='profile-save'?'Username sudah digunakan.':'Data duplikat. Periksa identitas operator atau penugasan.'):error.message;
      const values=Object.fromEntries(Object.entries(req.body).filter(([key,value])=>['name','username'].includes(key)&&typeof value==='string'));
      if(action==='profile-save') return view(req,res,'profile',{values,errorMessage});
      if(action==='account-create') return view(req,res,'accounts',{values,errorMessage,accounts:(await req.db.query('SELECT id,name,username,created_at FROM fleetsync.users ORDER BY created_at,id')).rows});
      if(action==='import') return view(req,res,'import',{errorMessage});
      if(['lineup-save','operator-save'].includes(action)) {
        const isLineup=action==='lineup-save',safeKeys=isLineup?['site','work_date','shift','type_category','unit','equipment','operator_name','nik','dh','mine','ftw','source_status','note']:['site','name','nik','unit','equipment','last_date'];
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
    if(!error.status&&!(error instanceof multer.MulterError)) console.error('FleetSync request failed:',error.code||error.name);
    if(res.headersSent) return res.end();
    res.status(status);
    if(req.path==='/upload-ticket') return res.json({error:message});
    try { return await view(req,res,'error',{title:'Permintaan belum dapat diproses',message}); }
    catch { return res.type('html').send('<!doctype html><html lang="id"><meta charset="utf-8"><title>FleetSync</title><h1>Layanan belum siap</h1><p>Periksa konfigurasi database dan penyimpanan.</p></html>'); }
  });
  return app;
}
