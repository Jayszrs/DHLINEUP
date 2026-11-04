import { readFile } from 'node:fs/promises';
import { database } from '../src/db.js';
const db=await database();
try {
  await db.transaction(async tx=>{await tx.query("SET LOCAL lock_timeout='5s'");await tx.query(await readFile(new URL('../../database/user-profile.sql',import.meta.url),'utf8'));});
  console.log('Profile photo, NIK and site schema ready; existing accounts preserved.');
} catch(error) {console.error('Profile migration failed:',error.code||error.name);process.exitCode=1;}
finally {await db.close();}
