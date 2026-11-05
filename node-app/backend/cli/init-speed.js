import {readFile} from 'node:fs/promises';
import {database} from '../src/db.js';
const db=await database();
try{await db.exec(await readFile(new URL('../../database/speed.sql',import.meta.url),'utf8'));console.log('Schema speed dan impor MDVR siap. Data yang sudah ada dipertahankan.');}
finally{await db.close();}
