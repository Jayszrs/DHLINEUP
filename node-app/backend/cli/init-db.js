import { database, initialize } from '../src/db.js';
const db = await database();
try { await initialize(db); console.log('Database FleetSync siap. Tidak ada data atau akun yang dihapus.'); }
finally { await db.close(); }
