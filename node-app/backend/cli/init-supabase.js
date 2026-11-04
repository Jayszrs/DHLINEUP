import { database,initialize,one } from '../src/db.js';
import { Storage } from '../src/storage.js';
if (!(process.env.DATABASE_URL||process.env.POSTGRES_URL)||!process.env.SUPABASE_URL||!(process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY)) throw new Error('Konfigurasi Supabase belum lengkap.');
let db;
try {
  db=await database();await initialize(db);
  const storage=new Storage(),api=storage.client.storage;
  const found=await api.getBucket(storage.bucket);
  if(found.data?.public) throw new Error('Bucket harus privat.');
  if(!found.data) {
    if(!['404','400'].includes(String(found.error?.statusCode))) throw new Error('Bucket tidak dapat diperiksa.');
    const created=await api.createBucket(storage.bucket,{public:false,fileSizeLimit:10485760});
    if(created.error) throw new Error('Bucket privat belum berhasil dibuat.');
  }
  const count=await one(db,"SELECT count(*) AS n FROM information_schema.tables WHERE table_schema='fleetsync'");
  console.log(JSON.stringify({schema:'fleetsync',tables:Number(count.n),bucket:storage.bucket,private:true}));
} catch(error) {console.error('Supabase initialization failed:',error.code||error.name);process.exitCode=1;}
finally {if(db) await db.close();}
