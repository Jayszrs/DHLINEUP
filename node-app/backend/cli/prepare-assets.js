import { cp,mkdir,readdir,readFile,writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root=new URL('../../',import.meta.url);
await mkdir(new URL('public/assets/',root),{recursive:true});
for(const name of ['css','js','fonts','dh-logo.png','dh-symbol.png','login-mine-hd.png']) await cp(new URL('frontend/assets/'+name,root),new URL('public/assets/'+name,root),{recursive:true});
const templates={};
for(const directory of ['','pages/']) for(const name of await readdir(new URL('frontend/views/'+directory,root))) if(name.endsWith('.ejs')) templates[directory+name]=await readFile(new URL('frontend/views/'+directory+name,root),'utf8');
await writeFile(new URL('frontend/views.generated.js',root),'// Generated from frontend/views by npm run build.\nexport default '+JSON.stringify(templates)+';\n');
console.log('Public assets and templates prepared; evidence remains in private storage.');
