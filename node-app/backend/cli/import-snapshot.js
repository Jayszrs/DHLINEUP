import { readFile } from 'node:fs/promises';
import { database,initialize } from '../src/db.js';
import { Storage } from '../src/storage.js';
import { importSnapshot } from '../src/snapshot.js';
const file=process.argv[2];if(!file) throw new Error('Gunakan: node backend/cli/import-snapshot.js path-snapshot.zip');
const db=await database();
try {await initialize(db);console.log(JSON.stringify(await importSnapshot(db,new Storage(),await readFile(file))));}
catch(error) {console.error('Snapshot import failed:',error.code||error.name,error.status?error.message:'');process.exitCode=1;}
finally {await db.close();}
