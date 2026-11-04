import { createClient } from '@supabase/supabase-js';
import { mkdir,readFile,writeFile,unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import sharp from 'sharp';
import { one } from './db.js';
import { HttpError, text, choice } from './validation.js';

export class Storage {
  constructor({ url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY,bucket=process.env.SUPABASE_STORAGE_BUCKET || 'fleetsync-private',directory='.data/uploads' }={}) {
    this.client=url&&key?createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}):null;
    this.bucket=bucket;this.directory=path.resolve(directory);
    if(process.env.VERCEL&&!this.client) throw new Error('Penyimpanan Supabase wajib diatur untuk deployment.');
  }
  valid(name) { if(!/^(evidence\/[A-Za-z0-9_]+\.png|reference\/[A-Za-z0-9_]+\.png|uploads\/[a-f0-9]{48}\.(png|jpg|webp)|incoming\/[0-9]+\/[a-f0-9]{64}\.(csv|xlsx|png|jpg|webp))$/.test(name)) throw new HttpError(404,'Gambar tidak ditemukan.');return name; }
  async put(name,bytes,mime='application/octet-stream') {
    this.valid(name);
    if(this.client) { const {error}=await this.client.storage.from(this.bucket).upload(name,bytes,{contentType:mime,upsert:false});if(error) throw new HttpError(503,'Unggah penyimpanan belum berhasil. Coba lagi.'); }
    else { const file=path.join(this.directory,name);await mkdir(path.dirname(file),{recursive:true});await writeFile(file,bytes,{flag:'wx'}); }
  }
  async get(name) {
    this.valid(name);
    if(this.client) { const {data,error}=await this.client.storage.from(this.bucket).download(name);if(error) throw new HttpError(404,'File unggahan belum tersedia.');return Buffer.from(await data.arrayBuffer()); }
    try { return await readFile(path.join(this.directory,name)); } catch { throw new HttpError(404,'File unggahan tidak ditemukan.'); }
  }
  async remove(name) { this.valid(name);if(this.client) await this.client.storage.from(this.bucket).remove([name]);else await unlink(path.join(this.directory,name)).catch(()=>{}); }
  async signedMedia(name) {
    this.valid(name);
    if(!this.client) return null;
    const {data,error}=await this.client.storage.from(this.bucket).createSignedUrl(name,60);
    if(error) throw new HttpError(404,'Gambar tidak ditemukan.');return data.signedUrl;
  }
  async issue(db,user,input) {
    if(!this.client) throw new HttpError(400,'Unggah lokal melalui formulir.');
    const kind=choice(input,'kind',['proof_ftw','proof_mine','spreadsheet','profile_photo']), extension=text(input,'extension',8).toLowerCase(),size=Number(input.size);
    if(!Number.isSafeInteger(size)||size<=0||size>(kind==='spreadsheet'?10:kind==='profile_photo'?2:5)*1024*1024) throw new HttpError(422,'Ukuran unggahan melebihi batas.');
    if(!(kind==='spreadsheet'?['xlsx','csv']:['png','jpg','jpeg','webp']).includes(extension)) throw new HttpError(422,'Format unggahan tidak didukung.');
    const pending=await one(db,'SELECT count(*) AS n FROM fleetsync.upload_tickets WHERE user_id=$1 AND consumed_at IS NULL AND expires_at>now()',[user.id]);
    if(Number(pending.n)>=20) throw new HttpError(429,'Terlalu banyak unggahan tertunda. Coba lagi nanti.');
    const id=randomBytes(32).toString('hex'),ext=extension==='jpeg'?'jpg':extension,objectPath=`incoming/${user.id}/${id}.${ext}`;
    const {data,error}=await this.client.storage.from(this.bucket).createSignedUploadUrl(objectPath);
    if(error) throw new HttpError(503,'Tautan unggahan belum dapat dibuat.');
    await db.query("INSERT INTO fleetsync.upload_tickets(id,user_id,path,kind,extension,expires_at) VALUES($1,$2,$3,$4,$5,now()+interval '2 hours')",[id,user.id,objectPath,kind,ext]);
    return {id,signedUrl:data.signedUrl};
  }
  async consume(db,user,id,kind) {
    if(!/^[a-f0-9]{64}$/.test(id)) throw new HttpError(422,'Referensi unggahan tidak valid.');
    const ticket=await one(db,'SELECT * FROM fleetsync.upload_tickets WHERE id=$1 AND user_id=$2 AND kind=$3 AND expires_at>now() AND consumed_at IS NULL FOR UPDATE',[id,user.id,kind]);
    if(!ticket) throw new HttpError(422,'Unggahan sudah digunakan atau kedaluwarsa. Pilih ulang file.');
    const bytes=await this.get(ticket.path);
    if(bytes.length>(kind==='spreadsheet'?10:kind==='profile_photo'?2:5)*1024*1024) throw new HttpError(422,'Ukuran unggahan melebihi batas.');
    await db.query('UPDATE fleetsync.upload_tickets SET consumed_at=now() WHERE id=$1',[id]);
    return {bytes,extension:ticket.extension,temporaryPath:ticket.path};
  }
  async image(bytes,{avatar=false}={}) {
    if(avatar&&bytes.length>2*1024*1024) throw new HttpError(422,'Foto profil maksimal 2 MB.');
    if(!bytes.length||bytes.length>5*1024*1024) throw new HttpError(422,'Gambar maksimal 5 MB.');
    let metadata;
    try { metadata=await sharp(bytes,{limitInputPixels:40000000}).metadata();await sharp(bytes,{limitInputPixels:40000000}).stats(); } catch { throw new HttpError(422,'File gambar tidak valid.'); }
    let extension={jpeg:'jpg',png:'png',webp:'webp'}[metadata.format];
    if(!extension) throw new HttpError(422,'Gunakan gambar PNG, JPG, atau WebP.');
    if(avatar) {bytes=await sharp(bytes,{limitInputPixels:40000000}).rotate().resize({width:512,height:512,fit:'inside',withoutEnlargement:true}).webp({quality:85}).toBuffer();extension='webp';}
    const name=`uploads/${randomBytes(24).toString('hex')}.${extension}`;
    await this.put(name,bytes,avatar?'image/webp':`image/${metadata.format}`);return name;
  }
}
