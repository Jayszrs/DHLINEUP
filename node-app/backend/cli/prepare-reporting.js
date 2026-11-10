import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {database,audit} from '../src/db.js';
import {SpeedFiles,SpeedRepository} from '../src/speed.js';
import {rebuildSpeedQuality} from '../src/speed-quality.js';
import {Storage} from '../src/storage.js';
if(!process.argv.includes('--apply'))throw new Error('Use --apply to add reporting tables and verify anomalies without changing source recaps.');
const db=await database();const digest=rows=>createHash('sha256').update(JSON.stringify(rows)).digest('hex');
try{const before=(await db.query('SELECT * FROM fleetsync.speed_daily ORDER BY unit,work_date')).rows;await db.exec(await readFile(new URL('../../database/reporting.sql',import.meta.url),'utf8'));const quality=await rebuildSpeedQuality(db,new SpeedFiles(new Storage()));const after=(await db.query('SELECT * FROM fleetsync.speed_daily ORDER BY unit,work_date')).rows;if(digest(before)!==digest(after))throw new Error('Source recap unexpectedly changed');const summary=await new SpeedRepository(db,null).summary();await audit(db,null,'verify','speed-quality','under-80',{quality,source_unchanged:true});await writeFile('.private/v7-reporting-verification.json',JSON.stringify({sourceRows:after.length,sourceUnchanged:true,quality,summary},null,2));console.log(JSON.stringify({sourceUnchanged:true,verified:quality.filter(r=>r.verified).length,pending:quality.filter(r=>!r.verified).length,summary}));}finally{await db.close();}
