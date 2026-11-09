import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {database} from '../src/db.js';
import {OccRepository,parseOccSource} from '../src/occ.js';

const filename=path.resolve(process.argv[2]||'.private/occ-source.json'),source=JSON.parse(await readFile(filename,'utf8')),parsed=parseOccSource(source);
console.log(JSON.stringify({source:parsed.source,revision:parsed.revision,assetRecords:parsed.assets.length,knownUnits:parsed.assets.reduce((n,r)=>n+Number(r.qty||0),0),cctvDates:parsed.checks.filter(r=>r.kind==='cctv').length,inventoryDates:parsed.checks.filter(r=>r.kind==='availability').length,apply:process.argv.includes('--apply')}));
if(process.argv.includes('--apply')){
 const db=await database();
 try{await db.exec(await readFile(new URL('../../database/occ.sql',import.meta.url),'utf8'));console.log(JSON.stringify(await new OccRepository(db).importSource(source)));}finally{await db.close();}
}
