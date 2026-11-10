import { cp,mkdir,readdir,readFile,writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {createHash} from 'node:crypto';
const root=new URL('../../',import.meta.url);
await mkdir(new URL('public/assets/',root),{recursive:true});
await mkdir(new URL('frontend/assets/js/vendor/',root),{recursive:true});
const rounded=await readFile(new URL('node_modules/three/examples/jsm/geometries/RoundedBoxGeometry.js',root),'utf8');await writeFile(new URL('frontend/assets/js/vendor/RoundedBoxGeometry.js',root),rounded.replace("from 'three'","from './three.module.js'"));
for(const name of ['three.module.js','three.core.js']) await cp(new URL('node_modules/three/build/'+name,root),new URL('frontend/assets/js/vendor/'+name,root));
await cp(new URL('node_modules/leaflet/dist/',root),new URL('frontend/assets/js/vendor/leaflet/',root),{recursive:true});
for(const name of ['css','js','fonts','dh-logo.png','dh-symbol.png','dh-symbol.svg','login-mine-hd.png']) await cp(new URL('frontend/assets/'+name,root),new URL('public/assets/'+name,root),{recursive:true});
// One graph version prevents an old cached leaf module surviving a new entry script.
const fingerprint=createHash('sha256');
async function fingerprintFiles(directory){for(const entry of(await readdir(directory,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const location=new URL(entry.name+(entry.isDirectory()?'/':''),directory);if(entry.isDirectory())await fingerprintFiles(location);else if(/\.(js|css|ejs)$/.test(entry.name)){fingerprint.update(entry.name);fingerprint.update((await readFile(location,'utf8')).replaceAll('\r\n','\n'));}}}
await fingerprintFiles(new URL('frontend/assets/',root));await fingerprintFiles(new URL('frontend/views/',root));const assetVersion=fingerprint.digest('hex').slice(0,16);
async function versionModules(directory){for(const entry of await readdir(directory,{withFileTypes:true})){const location=new URL(entry.name+(entry.isDirectory()?'/':''),directory);if(entry.isDirectory())await versionModules(location);else if(entry.name.endsWith('.js')){const source=await readFile(location,'utf8');const versioned=source.replace(/((?:from\s*|import\s*)['"])(\.{1,2}\/[^'"]+\.js)(['"])/g,`$1$2?v=${assetVersion}$3`).replace(/(import\(['"])(\.{1,2}\/[^'"]+\.js)(['"]\))/g,`$1$2?v=${assetVersion}$3`);if(versioned!==source)await writeFile(location,versioned);}}}
await versionModules(new URL('public/assets/js/',root));
const templates={};
for(const directory of ['','pages/']) for(const name of await readdir(new URL('frontend/views/'+directory,root))) if(name.endsWith('.ejs')) templates[directory+name]=await readFile(new URL('frontend/views/'+directory+name,root),'utf8');
await writeFile(new URL('frontend/views.generated.js',root),'// Generated from frontend/views by npm run build.\nexport default '+JSON.stringify(templates)+';\nexport const assetVersion='+JSON.stringify(assetVersion)+';\n');
console.log('Public assets and templates prepared; evidence remains in private storage.');
