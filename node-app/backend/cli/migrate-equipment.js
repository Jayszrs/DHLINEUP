import { readFile } from 'node:fs/promises';
import { database } from '../src/db.js';
const db=await database();
try {
  await db.transaction(async tx=>{
    await tx.query("SET LOCAL lock_timeout='5s'");
    await tx.query(await readFile(new URL('../../database/equipment-catalog.sql',import.meta.url),'utf8'));
  });
  console.log('Equipment catalog schema ready; existing assignments and models preserved.');
} catch(error) {console.error('Equipment migration failed:',error.code||error.name);process.exitCode=1;}
finally {await db.close();}
