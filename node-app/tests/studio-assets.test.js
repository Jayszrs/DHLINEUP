import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

function accessor(json,binary,index){
 const a=json.accessors[index],view=json.bufferViews[a.bufferView],components={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type];
 const types={5121:[1,'getUint8'],5123:[2,'getUint16'],5125:[4,'getUint32'],5126:[4,'getFloat32']},[size,method]=types[a.componentType],stride=view.byteStride||components*size,offset=(view.byteOffset||0)+(a.byteOffset||0),data=new DataView(binary.buffer,binary.byteOffset,binary.byteLength);
 return Array.from({length:a.count},(_,i)=>Array.from({length:components},(_,j)=>data[method](offset+i*stride+j*size,true)));
}
test('studio character files retain independent face skinning, iris materials and bounded delivery sizes',async()=>{
 for(const gender of ['male','female']){
  const bytes=await readFile(new URL('../frontend/assets/js/dh3d/studio/office-'+gender+'.glb',import.meta.url));
  assert.ok(bytes.length<5*1024*1024);assert.equal(bytes.toString('ascii',0,4),'glTF');
  const length=bytes.readUInt32LE(12),json=JSON.parse(bytes.toString('utf8',20,20+length)),binary=bytes.subarray(28+length);
  const head=json.nodes.find(n=>n.mesh!==undefined&&n.name.endsWith('-head')),skin=json.skins[head.skin];assert.ok(skin.joints.length<=20);
  const skeleton=skin.joints.map(i=>json.nodes[i].name);
  for(const primitive of json.meshes[head.mesh].primitives){
   const joints=accessor(json,binary,primitive.attributes.JOINTS_0),weights=accessor(json,binary,primitive.attributes.WEIGHTS_0);
   for(let i=0;i<joints.length;i++)for(let j=0;j<4;j++)if(weights[i][j]>1e-5)assert.ok(!/arm|hand|thigh|shin|foot/i.test(skeleton[joints[i][j]]),'face vertices must never follow a limb');
  }
  if(gender==='male'){const eye=json.nodes.find(n=>n.mesh!==undefined&&n.name.includes('eye_anim'));assert.equal(json.meshes[eye.mesh].primitives.length,3,'white, iris and pupil must survive material export');}
  assert.ok((json.images||[]).every(image=>image.bufferView!==undefined),'any textures are embedded and served from the website');
 }
});
