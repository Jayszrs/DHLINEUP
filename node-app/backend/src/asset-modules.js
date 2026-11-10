export function versionModuleImports(source,version){
 if(!/^[a-f0-9]{16}$/.test(version))throw new Error('Invalid asset graph version.');
 return source.replace(/((?:from\s*|import\s*)['"])(\.{1,2}\/[^'"]+\.js)(['"])/g,`$1$2?v=${version}$3`).replace(/(import\(['"])(\.{1,2}\/[^'"]+\.js)(['"]\))/g,`$1$2?v=${version}$3`);
}
