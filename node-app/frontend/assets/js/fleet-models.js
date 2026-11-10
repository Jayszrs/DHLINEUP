import * as THREE from './vendor/three.module.js';
import {RoundedBoxGeometry} from './vendor/RoundedBoxGeometry.js';
import {OCC_TEAM} from './occ-team.js';

const materials=new Map(),geometries=new Map(),bakedMaterials=new Map();
function material(color,roughness=.65,metalness=.05){const key=[color,roughness,metalness].join(':');if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color,roughness,metalness}));return materials.get(key);}
const palette={paint:0xf3ab20,paintDark:0xbc7618,paintLight:0xffcc4c,steel:0x9caaa9,rubber:0x252c2e,hub:0xc29a52,glass:0x244651,frame:0x344247,wood:0xb7a28b,teal:0x3b8b88,cloth:0xd8e3dc,skin:0xc58e68};
let contactMaterial;
function contactShadow(width,depth){
 if(typeof document==='undefined')return new THREE.Group();
 if(!contactMaterial){const canvas=document.createElement('canvas');canvas.width=256;canvas.height=128;const ctx=canvas.getContext('2d');if(!ctx)return new THREE.Group();ctx.scale(1,.5);const gradient=ctx.createRadialGradient(128,128,10,128,128,122);gradient.addColorStop(0,'rgba(22,31,26,.25)');gradient.addColorStop(.58,'rgba(22,31,26,.14)');gradient.addColorStop(1,'rgba(22,31,26,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,256,256);const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;contactMaterial=new THREE.MeshBasicMaterial({map,transparent:true,depthWrite:false});}
 const key=`shadow:${width}:${depth}`;if(!geometries.has(key))geometries.set(key,new THREE.PlaneGeometry(width,depth));const result=new THREE.Mesh(geometries.get(key),contactMaterial);result.rotation.x=-Math.PI/2;result.position.y=.025;return result;
}
function mesh(parent,geometry,mat,x=0,y=0,z=0){const item=new THREE.Mesh(geometry,mat);item.position.set(x,y,z);parent.add(item);return item;}
function box(parent,w,h,d,x,y,z,color,rotation){const key=`b:${w}:${h}:${d}`;if(!geometries.has(key))geometries.set(key,new THREE.BoxGeometry(w,h,d));const item=mesh(parent,geometries.get(key),typeof color==='number'?material(color):color,x,y,z);if(rotation)item.rotation.set(...rotation);return item;}
function roundBox(parent,w,h,d,x,y,z,color,radius=.08,rotation){const key=`rounded:${w}:${h}:${d}:${radius}`;if(!geometries.has(key))geometries.set(key,new RoundedBoxGeometry(w,h,d,3,Math.min(radius,w/2,h/2,d/2)));const item=mesh(parent,geometries.get(key),material(color,.48),x,y,z);if(rotation)item.rotation.set(...rotation);return item;}
const decalMaterials=new Map();
function decal(text,background='#137050',foreground='#fff',brand=false){
 const key=[text,background,foreground,brand].join(':');if(decalMaterials.has(key))return decalMaterials.get(key);if(typeof document==='undefined')return material(0x137050);
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=144;const c=canvas.getContext('2d');c.fillStyle=background;c.fillRect(0,0,512,144);c.fillStyle=foreground;c.font='bold 96px Segoe UI';c.textAlign='center';c.textBaseline='middle';c.fillText(text,brand?323:256,80,brand?330:480);
 if(brand){const logo=document.querySelector('.brand-signature img');if(logo?.complete&&logo.naturalWidth)c.drawImage(logo,28,22,110,100);}
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const mat=new THREE.MeshBasicMaterial({map:texture,toneMapped:false});decalMaterials.set(key,mat);return mat;
}
function dhBadge(parent,size,x,y,z,color){const key='badge:'+color;let mat=decalMaterials.get(key);if(!mat){if(typeof document==='undefined')mat=material(color);else{const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const c=canvas.getContext('2d'),logo=document.querySelector('.brand-signature img');if(logo?.complete&&logo.naturalWidth){c.drawImage(logo,8,8,240,240);c.globalCompositeOperation='source-in';c.fillStyle='#'+color.toString(16).padStart(6,'0');c.fillRect(0,0,256,256);}const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;mat=new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,toneMapped:false});}decalMaterials.set(key,mat);}return mesh(parent,new THREE.PlaneGeometry(size,size),mat,x,y,z);}
function plate(parent,text,w,h,x,y,z,side=false,brand=false){const item=mesh(parent,new THREE.PlaneGeometry(w,h),decal(text,brand?'#f4b42f':'#116f53',brand?'#17282a':'#ffffff',brand),x,y,z);if(!side)item.rotation.y=Math.PI/2;item.userData.identityText=text;return item;}

function cylinder(parent,r1,r2,h,x,y,z,color,segments=16,rotation){const key=`c:${r1}:${r2}:${h}:${segments}`;if(!geometries.has(key))geometries.set(key,new THREE.CylinderGeometry(r1,r2,h,segments));const item=mesh(parent,geometries.get(key),material(color),x,y,z);if(rotation)item.rotation.set(...rotation);return item;}
function sphere(parent,r,x,y,z,color,scale=[1,1,1]){const key=`s:${r}`;if(!geometries.has(key))geometries.set(key,new THREE.SphereGeometry(r,16,10));const item=mesh(parent,geometries.get(key),material(color),x,y,z);item.scale.set(...scale);return item;}
function torus(parent,r,tube,x,y,z,color,rotation=[0,0,0],segments=32){const key=`t:${r}:${tube}:${segments}`;if(!geometries.has(key))geometries.set(key,new THREE.TorusGeometry(r,tube,6,segments));const item=mesh(parent,geometries.get(key),material(color),x,y,z);item.rotation.set(...rotation);return item;}
function helmet(parent){
 const key='helmet-dome';if(!geometries.has(key))geometries.set(key,new THREE.SphereGeometry(.34,32,16,0,Math.PI*2,0,Math.PI/2));
 const dome=mesh(parent,geometries.get(key),material(0xefad32,.34),0,2.13,0);dome.scale.set(1,.72,1.02);
 cylinder(parent,.382,.392,.048,0,2.13,.025,0xe6a026,32);
 box(parent,.057,.035,.43,0,2.365,-.02,0xf8cb67);
 for(const x of[-.23,.23])box(parent,.065,.035,.14,x,2.24,-.13,0xe59c22,[0,0,x<0?.45:-.45]);
}

// Bake static pieces by surface finish, storing paint colors per vertex.
// Every clone shares buffers; color variation does not add extra draw calls.
function bake(group){
 group.updateMatrixWorld(true);const batches=new Map(),surfaces=[];
 group.traverse(node=>{if(!node.isMesh)return;if(node.material.map||node.material.transparent){const surface=new THREE.Mesh(node.geometry,node.material);surface.applyMatrix4(node.matrixWorld);surface.userData={...node.userData};surfaces.push(surface);return;}const g=node.geometry.index?node.geometry.toNonIndexed():node.geometry.clone();g.applyMatrix4(node.matrixWorld);const key=[node.material.roughness,node.material.metalness].join(':');let batch=batches.get(key);if(!batch){batch={list:[],roughness:node.material.roughness,metalness:node.material.metalness};batches.set(key,batch);}batch.list.push({geometry:g,color:node.material.color,sourceColors:node.material.vertexColors?g.attributes.color?.array:null});});
 const result=new THREE.Group();
 for(const[key,batch]of batches){const count=batch.list.reduce((n,piece)=>n+piece.geometry.attributes.position.count,0),positions=new Float32Array(count*3),normals=new Float32Array(count*3),colors=new Float32Array(count*3);let offset=0;for(const{geometry:g,color,sourceColors}of batch.list){positions.set(g.attributes.position.array,offset);normals.set(g.attributes.normal.array,offset);if(sourceColors)colors.set(sourceColors,offset);else for(let i=offset;i<offset+g.attributes.position.array.length;i+=3){colors[i]=color.r;colors[i+1]=color.g;colors[i+2]=color.b;}offset+=g.attributes.position.array.length;g.dispose();}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(positions,3));g.setAttribute('normal',new THREE.BufferAttribute(normals,3));g.setAttribute('color',new THREE.BufferAttribute(colors,3));g.computeBoundingSphere();if(!bakedMaterials.has(key))bakedMaterials.set(key,new THREE.MeshStandardMaterial({vertexColors:true,roughness:batch.roughness,metalness:batch.metalness}));result.add(new THREE.Mesh(g,bakedMaterials.get(key)));}
 if(surfaces.length)result.add(...surfaces);return result;
}

let truckBody,wheelPrototype;
function makeWheel(){
 const g=new THREE.Group();cylinder(g,.72,.72,.53,0,0,0,0x22292b,32,[Math.PI/2,0,0]);
 for(const z of[-.28,.28]){torus(g,.57,.025,0,0,z,0x3a4241);torus(g,.46,.018,0,0,z*1.02,0x46504a);cylinder(g,.39,.39,.035,0,0,z,palette.hub,24,[Math.PI/2,0,0]);torus(g,.365,.025,0,0,z*1.07,0xe1b758);cylinder(g,.2,.2,.055,0,0,z*1.13,0x9f8b5d,20,[Math.PI/2,0,0]);cylinder(g,.13,.13,.075,0,0,z*1.24,palette.steel,16,[Math.PI/2,0,0]);for(let i=0;i<10;i++){const a=i*Math.PI/5;cylinder(g,.026,.026,.045,Math.cos(a)*.285,Math.sin(a)*.285,z*1.15,palette.frame,6,[Math.PI/2,0,0]);}}
 for(let i=0;i<22;i++){const a=i*Math.PI/11;for(const side of[-1,1])box(g,.17,.085,.31,Math.sin(a)*.72,Math.cos(a)*.72,side*.13,0x39413f,[side*.25,0,-a]);}
 return bake(g);
}
function makeTruckBody(){
 const g=new THREE.Group(),p=palette;box(g,5.4,.32,2.35,0,.83,0,p.frame);box(g,4.7,.22,1.65,-.1,1.08,0,p.paintDark);box(g,3.45,.17,2.55,-.7,1.47,0,p.paintDark);
 for(const z of[-1.34,1.34]){box(g,3.85,.16,.19,-.65,2.64,z,p.paintLight);box(g,3.65,1.02,.15,-.67,2.05,z,p.paint,[z<0?-.13:.13,0,-.06]);for(let x=-2.18;x<1.05;x+=.66)box(g,.11,.99,.1,x,2.08,z*1.065,p.paintDark,[0,0,-.06]);}
 box(g,.18,1.13,2.58,-2.56,2.04,0,p.paint,[0,0,-.16]);box(g,.16,1.08,2.57,1.15,2.04,0,p.paintDark,[0,0,-.12]);box(g,1.12,.14,2.86,1.25,2.69,0,p.paint);
 // Operator cab, radiator, ladder, railings and mirrors follow a mine truck.
 box(g,1.28,1.38,1.12,1.8,1.98,.68,p.paint);box(g,.09,.82,.97,2.48,2.17,.68,p.glass);box(g,.93,.8,.055,1.8,2.17,1.267,p.glass);box(g,.08,.9,.08,1.83,2.17,1.303,p.paintLight);box(g,1.6,.12,1.46,1.83,2.75,.68,p.paintLight);
 box(g,.025,.055,.84,2.535,1.81,.68,p.frame);box(g,.025,.55,.035,2.54,2.02,.45,p.frame,[.18,0,0]);box(g,.92,.045,.035,1.79,1.82,1.3,p.paintDark);box(g,.14,.04,.055,1.39,1.72,1.3,p.frame);box(g,.025,.31,.16,2.55,1.66,1.08,p.paintLight);
 box(g,1.14,.93,1.04,1.85,1.73,-.62,p.paintDark);box(g,.06,.69,.88,2.46,1.73,-.62,p.frame);for(let y=1.46;y<2.1;y+=.1)box(g,.075,.026,.81,2.51,y,-.62,p.steel);
 box(g,1.6,.13,3.22,1.9,1.29,0,p.paint);box(g,.24,.25,3.26,2.72,1.1,0,p.frame);
 for(const z of[-1.29,1.29]){box(g,.06,.22,.38,2.86,1.17,z,0xffebbd);for(const x of[1.29,2.55])box(g,.045,.6,.045,x,1.66,z,p.steel);box(g,1.3,.05,.05,1.9,1.96,z,p.steel);}
 for(const z of[-1.03,1.03]){box(g,.06,.19,.24,-2.7,1.12,z,0x9b392b);box(g,.07,.06,.28,-2.71,1.3,z,0xe7d3a1);box(g,.065,.14,.12,2.88,1.17,z*.65,0xf3ad30);}for(let x=-2.2;x<.9;x+=.75)for(const z of[-1.46,1.46])box(g,.25,.095,.018,x,1.56,z,0xf2d891);
 for(let y=.42;y<1.3;y+=.22)box(g,.54,.06,.31,1.75,y,1.63,p.steel);box(g,.045,1.28,.045,1.44,.94,1.76,p.frame);box(g,.045,1.28,.045,2.06,.94,1.76,p.frame);
 cylinder(g,.09,.09,1.45,1.17,2.13,-1.2,p.frame,10);cylinder(g,.13,.13,.11,1.17,2.88,-1.2,p.frame,10);
 for(const z of[-1.48,1.48]){box(g,.045,.5,.045,2.16,2.39,z,p.steel);box(g,.19,.31,.065,2.16,2.57,z,p.frame);box(g,.15,.25,.012,2.16,2.57,z+Math.sign(z)*.04,p.steel);}cylinder(g,.065,.065,.65,-.23,1.28,0,p.steel,8,[0,0,.33]);for(const z of[-.6,.6])cylinder(g,.095,.095,.7,-.6,1.32,z,0x8b9183,12,[0,0,-.48]);for(let row=0;row<3;row++)for(let column=0;column<5;column++){const rock=mesh(g,new THREE.DodecahedronGeometry(.5,0),material((row+column)%2?0x414341:0x565754),-2.05+column*.68,2.63+Math.sin(column*1.7+row)*.11+(row===1?.33:0),(row-1)*.77);rock.scale.set(1.15,1.02,.94);rock.rotation.set(row*.32,column*.7,.2);}
 box(g,2.06,.17,3.22,1.55,2.96,0,p.paint);box(g,1.6,.13,3.36,1.88,1.31,0,p.paint);box(g,.26,.26,3.44,2.75,1.1,0,p.paint);
 for(const z of[-1.48,1.48]){for(const x of[1.12,1.75,2.55])cylinder(g,.035,.035,.71,x,1.73,z,0xf8bd28,10);cylinder(g,.039,.039,1.48,1.85,2.08,z,0xf8bd28,10,[0,0,Math.PI/2]);}
 box(g,.07,.88,1.3,2.54,1.73,-.43,p.frame);for(let y=1.38;y<2.15;y+=.105)box(g,.08,.035,1.18,2.59,y,-.43,0x84918a);
 for(const z of[-1.2,1.2]){box(g,.09,.29,.31,2.64,2.7,z,0x455149);box(g,.1,.21,.23,2.7,2.7,z,0xfff1bf);}
 return bake(g);
}
export function createTruck(unit=''){
 truckBody??=makeTruckBody();wheelPrototype??=makeWheel();const root=new THREE.Group();root.add(truckBody.clone(),contactShadow(6.7,4.1));const wheels=[];for(const x of[-1.6,1.67])for(const z of[-1.34,1.34]){const wheel=wheelPrototype.clone();wheel.position.set(x,.73,z);root.add(wheel);wheels.push(wheel);}
 const identity=String(unit||'').trim().toUpperCase(),valid=/^DT\d{1,8}$/.test(identity);if(valid){plate(root,identity,1.5,.4,2.59,2.97,.58);plate(root,identity,1.3,.38,-1.1,2.06,1.49,true);plate(root,identity.slice(2),.85,.28,2.65,2.12,-.43);}plate(root,'DH',1,.34,.5,2.45,1.48,true,true);
 root.userData={wheels,unit:valid?identity:'',identityTexts:valid?[identity,identity,identity.slice(2)]:[],labelHeight:4.1,modelFeatures:['reference-inspired loaded haul truck','golden canopy','coal load','four mining tires','safety rails','live unit identity plates']};return root;
}

let parkingPrototype;
export function createParkingLot(){
 if(!parkingPrototype){const g=new THREE.Group();box(g,28,.22,22,0,-.16,0,0x5e6b60);
  for(const x of[-7,5])for(const z of[-4.3,0,4.3]){for(const side of[-1,1])box(g,9,.012,.08,x,.002,z+side*1.9,0xe0d7ac);box(g,.08,.012,3.8,x-4.5,.002,z,0xe0d7ac);box(g,.2,.13,3.1,x-3.9,.06,z,0xc9b86d);}
  box(g,25,4.5,2,0,2.2,-9,0x52605e);box(g,25.5,.15,3.2,0,4.55,-8.8,0x897f66);box(g,25.6,.18,.18,0,4.48,-7.2,0xc78939);
  for(const x of[-8,0,8]){box(g,5.4,3.4,.12,x,1.7,-7.94,0x324542);for(let y=.3;y<3.3;y+=.3)box(g,5.2,.035,.025,x,y,-7.86,0x63766e);}
  for(const x of[-12,12])for(const z of[-6,6]){cylinder(g,.12,.14,.85,x,.42,z,0xe0b44e,10);cylinder(g,.13,.13,.12,x,.61,z,0x34443d,10);}
  officeSign(g,'AREA PARKIR',0,3.9,-7.8);parkingPrototype=bake(g);
 }
 const lot=parkingPrototype.clone();lot.userData.illustrativeParking=true;return lot;
}
let roadPrototype;
export function createMineRoad(){
 if(!roadPrototype){const g=new THREE.Group();box(g,18,.28,22,0,-.23,0,0x8b775a);box(g,18,.08,8.2,0,-.045,0,0xb29a72);
  for(const z of[-1.4,1.4])box(g,18,.008,.42,0,.003,z,0x9f8865);
  for(const side of[-1,1]){box(g,18,.25,1.05,0,.02,side*4.65,0x917953);for(let i=0;i<7;i++){const x=-7.7+i*2.5;const rock=mesh(g,new THREE.DodecahedronGeometry(1,0),material(i%2?0x7b725e:0x9c8864),x,.35+(i%3)*.25,side*(6+(i%2)*1.3));rock.scale.set(1.6+(i%3)*.7,.8+(i%2)*.6,1.4);rock.rotation.set(.2*i,.5*i,.1*i);}
   for(const x of[-7,-1,5]){box(g,.12,.75,.12,x,.4,side*4.2,0xdfb344);box(g,.13,.12,.13,x,.58,side*4.2,0x3c3d34);}
  }
  for(let i=0;i<70;i++){const x=((i*7.13)%18)-9,z=((i*3.71)%8)-4;box(g,.035+(i%3)*.026,.015,.055,x,.007,z,i%2?0x8d795d:0xc7b18b,[0,i*.73,0]);}
  roadPrototype=bake(g);
 }
 const road=new THREE.Group();for(const x of[-18,0,18]){const segment=roadPrototype.clone();segment.position.x=x;segment.userData.roadSegment=true;road.add(segment);}road.userData.segmentLength=18;road.userData.illustrativeTerrain=true;return road;
}

const characterPrototypes=new Map();
function staffCharacter({seated=false,female=false,clipboard=false}={}){
 const key=[seated,female,clipboard].join(':');if(!characterPrototypes.has(key)){
  const root=new THREE.Group(),body=new THREE.Group(),head=new THREE.Group(),shirt=0x0cabc5,navy=0x263a53,skin=0xf0bc83;
  roundBox(body,.69,.75,.43,0,1.285,0,shirt,.11);roundBox(body,.71,.09,.45,0,1.05,.003,0xcbd4d1,.025);roundBox(body,.71,.075,.45,0,1.2,.003,0xcbd4d1,.02);box(body,.045,.64,.028,0,1.3,.23,0x128aa5);
  for(const side of[-1,1]){roundBox(body,.245,.19,.045,side*.195,1.39,.242,0x0a95b2,.025);sphere(body,.018,side*.195,1.43,.271,0xcbd4d1);roundBox(body,.18,.12,.035,side*.15,1.65,.17,0x13a4bc,.018,[0,0,side*.48]);}
  cylinder(body,.12,.13,.16,0,1.73,0,skin,16);roundBox(body,.7,.1,.46,0,.89,.01,navy,.03);roundBox(body,.15,.11,.035,0,.895,.257,0x7f8b8d,.02);
  if(seated){for(const side of[-1,1]){roundBox(body,.25,.18,.68,side*.18,.83,.22,navy,.065);roundBox(body,.25,.59,.23,side*.18,.49,.48,navy,.06);roundBox(body,.29,.19,.43,side*.18,.15,.58,0x303b42,.055);}}
  else for(const side of[-1,1]){roundBox(body,.27,.65,.35,side*.18,.54,0,navy,.07);roundBox(body,.3,.23,.48,side*.18,.135,.06,0x303a40,.055);box(body,.31,.04,.49,side*.18,.035,.06,0x202b30);roundBox(body,.17,.22,.045,side*.31,.58,.06,0x2d415b,.018);}
  dhBadge(body,.15,-.19,1.59,.235,0xf3a31a);
  roundBox(head,.65,.61,.54,0,0,.012,skin,.17);roundBox(head,.65,.28,.49,0,.18,-.065,0x343a3b,.11);for(const side of[-1,1]){roundBox(head,.07,.21,.12,side*.27,.06,.08,0x343a3b,.03);sphere(head,.065,side*.328,-.025,.015,skin,[.52,1,.76]);roundBox(head,.055,.095,.022,side*.13,.015,.287,0x192c32,.025);roundBox(head,.12,.025,.023,side*.13,.115,.269,0x4b3d30,.011,[0,0,side*.09]);}
  const smile=new THREE.QuadraticBezierCurve3(new THREE.Vector3(-.11,-.09,.278),new THREE.Vector3(0,-.205,.32),new THREE.Vector3(.11,-.09,.278));mesh(head,new THREE.TubeGeometry(smile,16,.013,6,false),material(0x64452f));
  if(female){roundBox(head,.62,.42,.18,0,-.08,-.23,0x343a3b,.07);for(const side of[-1,1])roundBox(head,.14,.32,.22,side*.27,-.11,-.1,0x343a3b,.05);}
  const dome=mesh(head,new THREE.SphereGeometry(.375,32,16,0,Math.PI*2,0,Math.PI/2),material(0xf3f1e9,.32),0,.257,0);dome.scale.set(1,.67,1.03);roundBox(head,.81,.085,.79,0,.265,.015,0xf1efe8,.035);roundBox(head,.12,.055,.49,0,.498,-.03,0xe5e3db,.025);for(const side of[-1,1])roundBox(head,.11,.13,.17,side*.33,.31,.04,0xe5e3db,.028);dhBadge(head,.23,0,.38,.341,0x3c4650);
  const headPart=bake(head);headPart.name='character-head';headPart.position.y=1.99;root.add(bake(body),headPart);
  for(const side of[-1,1]){const arm=new THREE.Group();roundBox(arm,.25,.38,.32,0,-.14,0,shirt,.08);roundBox(arm,.26,.065,.33,0,-.22,0,0xd2dad5,.018);roundBox(arm,.235,.27,.29,0,-.42,.015,navy,.055);roundBox(arm,.23,.22,.26,0,-.62,.025,skin,.075);const part=bake(arm);part.name=side<0?'character-left-arm':'character-right-arm';part.position.set(side*.46,1.51,0);part.rotation.z=-side*.08;part.rotation.x=seated?-.75:side>0&&clipboard?-.32:0;part.userData.baseArmX=part.rotation.x;root.add(part);}
  if(clipboard){const board=new THREE.Group();roundBox(board,.42,.57,.048,.47,.99,.36,0xeae5d8,.025,[0,0,-.1]);roundBox(board,.15,.055,.06,.44,1.27,.39,0x83908f,.015);for(let i=0;i<5;i++){roundBox(board,.025,.025,.007,.34,1.18-i*.08,.393,0xadb0a6,.004);box(board,.18,.014,.007,.48,1.18-i*.08,.394,0xb8b9ad);}root.add(bake(board));}
  root.userData={isStaffCharacter:true,seated,female,referenceStyle:'white-helmet-turquoise-reflective-uniform',labelHeight:2.7};characterPrototypes.set(key,root);
 }
 return characterPrototypes.get(key).clone();
}
export function animateCharacter(root,time,phase=0){const head=root.getObjectByName('character-head');if(head){head.rotation.y=Math.sin(time*.6+phase)*.035;head.rotation.z=Math.sin(time*.85+phase)*.013;}for(const side of['left','right']){const arm=root.getObjectByName('character-'+side+'-arm');if(arm)arm.rotation.x=(arm.userData.baseArmX||0)+Math.sin(time*(root.userData.seated?3.2:.7)+phase+(side==='left'?1:0))*(root.userData.seated?.025:.012);}}
export function createDriver(){const driver=staffCharacter({clipboard:true});driver.add(contactShadow(1.65,1.2));return driver;}

let standPrototype;
export function createAssignmentStand(){
 if(!standPrototype){const g=new THREE.Group();box(g,4.1,.18,3.4,0,.04,0,0xc5cbc4);box(g,3.86,.035,3.16,0,.15,0,0xe0e3dc);box(g,2.8,.04,.08,0,.178,1.27,0xc59a4b);standPrototype=bake(g);}
 return standPrototype.clone();
}

const groundPrototypes=new Map();
export function createFleetGround(cols,rows,kind){
 const cacheKey=[cols,rows,kind].join(':');if(groundPrototypes.has(cacheKey))return groundPrototypes.get(cacheKey).clone();const g=new THREE.Group(),width=cols*7.7+1.4,depth=rows*6.9+1.2;
 box(g,width,.25,depth,0,-.18,0,0xe6e5df);box(g,width-.24,.04,depth-.24,0,-.035,0,0xf1f0ea);
 for(let row=0;row<rows;row++){const z=(row-(rows-1)/2)*6.9;box(g,width-1,.024,4.15,0,.001,z,kind==='speed'?0xd5d7d1:0xe8e4d9);for(let x=-width/2+.6;x<width/2-.6;x+=1.4){box(g,.7,.025,.045,x,.018,z-2.15,0xb6a06f);box(g,.7,.025,.045,x,.018,z+2.15,0xb6a06f);}}
 const result=bake(g);groundPrototypes.set(cacheKey,result);return result.clone();
}

function chair(g,x,z,angle,pixel){
 const unit=new THREE.Group();unit.position.set(x,0,z);unit.rotation.y=angle;g.add(unit);box(unit,.71,.15,.66,0,.84,0,0x364247);box(unit,.72,.78,.12,0,1.27,-.32,0x3c494e);box(unit,.52,.51,.035,0,1.28,-.39,0x778186);cylinder(unit,.055,.075,.61,0,.49,0,0x545f61,pixel?6:12);
 for(const side of[-1,1]){box(unit,.08,.08,.55,side*.45,1.13,0,0x465156);box(unit,.05,.36,.05,side*.45,.96,.12,0x57636a);}for(let i=0;i<5;i++){const a=i*Math.PI*.4;box(unit,.06,.06,.48,Math.sin(a)*.2,.16,Math.cos(a)*.2,0x4a5559,[0,a,0]);cylinder(unit,.08,.08,.07,Math.sin(a)*.41,.09,Math.cos(a)*.41,0x283135,8,[Math.PI/2,0,0]);}
}
function monitor(g,x,z,angle=0){const unit=new THREE.Group();unit.position.set(x,1.46,z);unit.rotation.y=angle;g.add(unit);box(unit,.92,.55,.06,0,.42,0,0x222f37);box(unit,.81,.43,.013,0,.43,.038,0x507e83);box(unit,.05,.28,.05,0,.06,0,0x3c484c);box(unit,.42,.035,.24,0,-.055,.03,0x46545a);box(unit,.7,.025,.25,0,-.06,.4,0x677174);}
export function createOccPerson(seat=1){const person=OCC_TEAM.find(p=>p.seat===seat);return staffCharacter({seated:true,female:person?.gender==='female'});}

function workstation(g){
 box(g,2.64,.15,1.27,0,1.28,0,0xc7b397);box(g,2.64,.045,1.27,0,1.38,0,0xe0ceb0);box(g,2.46,.69,.08,0,.95,-.53,0x7f8983);
 for(const side of[-1,1]){box(g,.09,1.22,.88,side*1.12,.62,0,0x556662);box(g,.36,.05,.94,side*1.12,.08,0,0x3b4e4b);}
 monitor(g,0,-.23);box(g,.32,.69,.62,1,.73,.05,0x344348);box(g,.019,.43,.42,1.17,.8,.05,0x45575b);box(g,.029,.035,.035,1.18,1.02,.26,0x93aa98);
 box(g,.05,.03,.08,.49,1.43,.36,0x526863);box(g,.52,.023,.29,0,1.44,.26,0x6f7974);box(g,.055,.05,.055,-.9,1.45,.32,0xd8e0d5);
 cylinder(g,.085,.11,.036,-.92,1.44,-.29,0x3d514c,12);cylinder(g,.013,.013,.27,-.92,1.59,-.3,0x657a72,10,[.17,0,0]);
}
function meetingTable(g){
 for(const x of[-3.6,3.6]){box(g,1.4,.17,6.2,x,1.24,0,0xbda486);box(g,1.43,.055,6.24,x,1.355,0,0xdfc6a5);box(g,.09,1.12,5.8,x,.62,0,0x7c8780);for(const z of[-2.1,2.1])box(g,.83,.07,.44,x,.085,z,0x57635f);}
 box(g,8.63,.17,1.45,0,1.24,3.1,0xbda486);box(g,8.67,.055,1.47,0,1.355,3.1,0xdfc6a5);box(g,7.9,1.12,.1,0,.62,3.1,0x7c8780);
 for(const x of[-2.7,-.9,.9,2.7]){box(g,.55,.032,.34,x,1.42,3.25,0x425954);cylinder(g,.1,.12,.045,x,1.44,2.64,0x384c48,12);cylinder(g,.015,.015,.34,x,1.62,2.64,0x5a6e65,12,[.16,0,0]);}
 for(const side of[-1,1])for(const z of[-2.35,-.8,.8,2.35]){cylinder(g,.1,.12,.045,side*3.13,1.44,z,0x384c48,12);cylinder(g,.015,.015,.34,side*3.13,1.62,z,0x5a6e65,12,[0,0,-side*.16]);}
 box(g,.58,.04,.38,2.74,1.43,3.1,0x33494d);box(g,.48,.012,.29,2.74,1.459,3.1,0x86a7a5);
}
function kandao(g,pixel){
 cylinder(g,.68,.75,.09,0,.07,0,0x7d8982,pixel?12:32);cylinder(g,.12,.17,1.08,0,.63,0,0x69776f,pixel?10:24);cylinder(g,.57,.57,.11,0,1.22,0,0xbba78b,pixel?12:32);
 cylinder(g,.245,.27,.14,0,1.36,0,0x354a4b,pixel?12:32);cylinder(g,.14,.155,.46,0,1.64,0,0x253b40,pixel?12:32);cylinder(g,.17,.17,.065,0,1.91,0,0x42565a,pixel?12:32);
 for(const side of[-1,1]){cylinder(g,.075,.075,.04,0,1.73,side*.15,0x131f26,20,[Math.PI/2,0,0]);cylinder(g,.047,.047,.046,0,1.73,side*.172,0x517985,20,[Math.PI/2,0,0]);}
 for(let y=1.46;y<1.68;y+=.045)torus(g,.146,.006,0,y,0,0x617475,[Math.PI/2,0,0],24);
}
function ptz(g,pixel){
 box(g,.7,.08,.53,0,.04,0,0xd3dad2);box(g,.1,.48,.1,0,.3,-.15,0xa1ada4);cylinder(g,.23,.26,.14,0,.52,0,0xd4dad1,pixel?10:28);
 for(const side of[-1,1])box(g,.1,.36,.36,side*.25,.71,0,0xc4cfc7);sphere(g,.24,0,.74,0,0xc6d1c9,[1,.9,1]);
 cylinder(g,.16,.17,.15,0,.76,.21,0x2a3a40,24,[Math.PI/2,0,0]);cylinder(g,.105,.105,.018,0,.76,.295,0x3f6878,24,[Math.PI/2,0,0]);cylinder(g,.053,.053,.021,0,.76,.307,0x152d39,24,[Math.PI/2,0,0]);
}
function speaker(g,pixel){
 cylinder(g,.38,.4,.12,0,.11,0,0xe0e3d8,pixel?12:32);cylinder(g,.345,.345,.015,0,.043,0,0x657671,pixel?12:32);
 for(const r of[.08,.15,.22,.29])torus(g,r,.009,0,.032,0,0xb2bdb0,[Math.PI/2,0,0],pixel?16:32);
 for(let x=-.24;x<=.24;x+=.08)for(let z=-.24;z<=.24;z+=.08)if(x*x+z*z<.075)cylinder(g,.013,.013,.007,x,.029,z,0x65766f,6);
}
let screenMaterial;
function occScreenMaterial(){
 if(screenMaterial)return screenMaterial;
 if(typeof document==='undefined')return material(0x12365b);
 const canvas=document.createElement('canvas');canvas.width=1800;canvas.height=400;const c=canvas.getContext('2d');
 c.fillStyle='#060c1d';c.fillRect(0,0,1800,400);
 for(let panel=0;panel<2;panel++){const x=panel*900;c.fillStyle='#ad351b';c.fillRect(x+10,10,880,66);c.fillStyle='#ea7b35';for(let i=0;i<8;i++)c.fillRect(x+25+i*115,18,75,8);c.fillStyle='#f9e3c0';c.font='bold 18px Segoe UI';c.fillText(panel?'OCC JHO  /  VIDEO CONFERENCE':'OCC JHO  /  OPERATIONS DISPLAY',x+25,59);
  c.fillStyle='#102c53';c.fillRect(x+12,82,548,266);c.fillStyle='#193e6b';c.fillRect(x+22,94,526,244);
  c.strokeStyle='#527bc0';c.lineWidth=4;c.beginPath();for(let i=0;i<11;i++){const px=x+45+i*46,py=145+Math.sin(i*.9+panel)*55+i*9;i?c.lineTo(px,py):c.moveTo(px,py);}c.stroke();
  c.strokeStyle='#dfac48';c.lineWidth=3;c.beginPath();c.moveTo(x+45,285);c.lineTo(x+160,230);c.lineTo(x+245,264);c.lineTo(x+390,166);c.lineTo(x+505,210);c.stroke();
  for(let i=0;i<5;i++){const px=x+75+i*98,py=164+Math.sin(i*1.4)*55;c.fillStyle='#a2cfeb';c.beginPath();c.arc(px,py,7,0,Math.PI*2);c.fill();}
  for(let i=0;i<4;i++){const px=x+572+(i%2)*158,py=84+Math.floor(i/2)*134;c.fillStyle=i%2?'#4c2768':'#22385e';c.fillRect(px,py,148,124);c.fillStyle='#354d65';c.fillRect(px+10,py+8,128,64);c.fillStyle='#d7b69b';c.beginPath();c.arc(px+74,py+42,16,0,Math.PI*2);c.fill();c.fillStyle=i%2?'#5f8a8d':'#7287ad';c.beginPath();c.ellipse(px+74,py+87,32,27,0,0,Math.PI*2);c.fill();c.fillStyle='#cadbe8';c.fillRect(px+13,py+109,90,3);}
  c.fillStyle='#13314d';c.fillRect(x+12,354,876,32);c.fillStyle='#b9d1e0';c.font='14px Segoe UI';c.fillText('ILUSTRASI TAMPILAN OCC  ·  BUKAN SIARAN LANGSUNG',x+25,376);
 }
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;screenMaterial=new THREE.MeshBasicMaterial({map:texture,toneMapped:false});return screenMaterial;
}
function videoWall(g){
 box(g,12.6,3.05,.24,0,1.58,0,0x11151d);box(g,12.35,2.83,.04,0,1.58,.14,0x050a16);
 const display=mesh(g,new THREE.PlaneGeometry(12.18,2.71),occScreenMaterial(),0,1.58,.167);display.userData.displaySurface=true;
 box(g,.035,2.76,.025,0,1.58,.18,0x080c15);box(g,12.35,.055,.29,0,.035,.025,0x1b222a);box(g,.055,.025,.012,5.95,.105,.177,0x68b8a3);
}
let glassMaterial;
function glassPanel(g,x,z,depth,height=4.3){
 glassMaterial??=new THREE.MeshPhysicalMaterial({color:0x8bb6bb,transparent:true,opacity:.16,roughness:.12,metalness:.05,depthWrite:false,side:THREE.DoubleSide});
 const pane=mesh(g,new THREE.BoxGeometry(.045,height,depth),glassMaterial,x,height/2+.12,z);pane.userData.glassPartition=true;
 for(const y of[.12,height+.12])box(g,.08,.055,depth,x,y,z,0x405458);
 for(let dz=-depth/2;dz<=depth/2+.01;dz+=depth/4)box(g,.08,height,.075,x,height/2+.12,z+dz,0x405458);
}
function officeSign(g,text,x,y,z){
 box(g,3.5,.6,.09,x,y,z,0x243b42);if(typeof document==='undefined')return;
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=96;const c=canvas.getContext('2d');c.fillStyle='#243b42';c.fillRect(0,0,512,96);c.fillStyle='#edf3ef';c.font='bold 48px Segoe UI';c.textAlign='center';c.textBaseline='middle';c.fillText(text,256,49);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;mesh(g,new THREE.PlaneGeometry(3.45,.57),new THREE.MeshBasicMaterial({map:texture,toneMapped:false}),x,y,z+.051);
}
function sideOffice(g,name,pixel){
 box(g,4.8,.25,19.6,0,-.12,0,0xa9aaa5);box(g,4.65,.04,19.35,0,.025,0,0xb7c3bc);box(g,4.8,3.9,.14,0,1.95,-9.7,0x546568);officeSign(g,name,0,3.28,-9.59);
 for(const z of[-5.3,2.7]){const desk=new THREE.Group();workstation(desk);desk.scale.setScalar(.86);desk.position.set(0,.02,z);g.add(desk);chair(g,0,z+1.25,Math.PI,pixel);}
 box(g,1.3,2.6,.65,-1.5,1.32,8.6,0x465d5c);for(let y=.2;y<2.5;y+=.28)box(g,1.15,.035,.03,-1.5,y,8.94,0x718883);
}
const objectPrototypes=new Map();
export function createOccObject(type,pixel=true){
 const aliases={'workstation':'desk','conference-table':'meeting-table','camera':'kandao','screen':'video-wall'},keyType=aliases[type]||type,key=keyType+':'+(pixel?'pixel':'smooth');
 if(keyType.startsWith('person-')){const group=new THREE.Group(),seat=Number(keyType.slice(7)),base=new THREE.Group();chair(base,0,0,0,pixel);group.add(bake(base),createOccPerson(seat));group.userData={type:keyType,illustrativeModel:true};return group;}
 if(!objectPrototypes.has(key)){const g=new THREE.Group();
  if(keyType==='desk')workstation(g);
  else if(keyType.startsWith('person-')){g.add(createOccPerson(Number(keyType.slice(7)),pixel));chair(g,0,0,0,pixel);}
  else if(keyType==='chair')chair(g,0,0,0,pixel);
  else if(keyType==='meeting-table')meetingTable(g);
  else if(keyType==='kandao')kandao(g,pixel);
  else if(keyType==='ptz')ptz(g,pixel);
  else if(keyType==='speaker')speaker(g,pixel);
  else if(keyType==='video-wall')videoWall(g);
  else if(keyType==='it-room'||keyType==='engineer-room')sideOffice(g,keyType==='it-room'?'IT':'ENGINEER',pixel);
  else throw new Error('Unknown OCC preview type: '+String(type));
  const object=bake(g);object.userData={type:keyType,illustrativeModel:true};objectPrototypes.set(key,object);
 }
 return objectPrototypes.get(key).clone();
}
const roomPrototypes=new Map();
function makeRoom(pixel){
 const g=new THREE.Group(),positions=[],objects=[],meetingSeats=[],people=[];
 const record=(id,name,type,category,position,size,extra={})=>objects.push({id,name,type,previewType:type,category,position,size,rotation:[0,0,0],...extra});
 const place=(type,x,y,z,rotation=0)=>{const object=createOccObject(type,pixel);object.position.set(x,y,z);object.rotation.y=rotation;g.add(object);return object;};
 box(g,14,.35,21.6,0,-.22,.7,0xa9aaa5);box(g,13.65,.04,21.2,0,-.02,.7,0xc4c4bb);
 for(let x=-6;x<=6;x++)for(let z=-9;z<=10;z++)box(g,.97,.016,.97,x,.015,z,(x+z)%2?0xb9bbb5:0xb1b4ae);
 box(g,13.8,5.7,.2,0,2.75,-9.7,0x283338);box(g,13.8,1.1,.24,0,5.8,-9.7,0xda6b2f);
 for(const [side,type,name]of[[-1,'it-room','Ruang IT'],[1,'engineer-room','Ruang Engineer']]){place(type,side*9.55,0,.7);glassPanel(g,side*7,0.7,19.6);record(type,name,type,'furniture',[side*9.55,1.9,.7],[4.8,3.9,19.6],{zone:type});}
 // The cut-away ceiling exposes the seating layout without hiding its orange beams.
 for(const z of[-8.4,-3.5,1.8,7.8]){box(g,13.9,.27,.23,0,6.1,z,0x6d4b37);box(g,13.8,.06,.31,0,6.28,z,0xd16a31);for(let x=-6;x<7;x+=3.2)box(g,.07,.43,.1,x,5.74,z,0x535656);}
 for(const x of[-5.7,-5.45,-4.9,4.9,5.45,5.7])cylinder(g,.027,.027,19.9,x,6,.15,0xe78246,pixel?4:12,[Math.PI/2,0,0]);
 for(const x of[-4.2,0,4.2])for(const z of[-6.3,5.1]){cylinder(g,.015,.015,.68,x,5.67,z,0x8e8a7c,6);cylinder(g,.31,.36,.27,x,5.2,z,0xdedbcf,pixel?8:24);cylinder(g,.29,.29,.03,x,5.05,z,0xf8f2d9,pixel?8:24);}
 place('video-wall',0,1.75,-9.43);record('front-video-wall','Videotron ruang OCC','video-wall','display',[0,3.33,-9.4],[12.6,3.1,.4]);
 place('ptz',0,4.96,-9.12);record('front-ptz','Kamera PTZ di atas videotron','ptz','camera',[0,5.48,-9.03],[.75,1.06,.72]);
 place('meeting-table',0,0,-5);
 record('meeting-table-left','Meja rapat U · sisi kiri','meeting-table','furniture',[-3.6,.93,-5],[1.5,1.9,6.3],{part:'left'});
 record('meeting-table-crossbar','Meja rapat U · penghubung belakang','meeting-table','furniture',[0,.93,-1.9],[8.7,1.9,1.5],{part:'crossbar'});
 record('meeting-table-right','Meja rapat U · sisi kanan','meeting-table','furniture',[3.6,.93,-5],[1.5,1.9,6.3],{part:'right'});
 for(const side of[-1,1])for(const[index,z]of[-7.3,-5.7,-4.1,-2.5].entries()){
  const x=side*5.1,rotation=side<0?Math.PI/2:-Math.PI/2,id='meeting-chair-'+(side<0?'left':'right')+'-'+(index+1);place('chair',x,0,z,rotation);record(id,'Kursi rapat '+(side<0?'kiri':'kanan')+' '+(index+1),'chair','furniture',[x,.87,z],[1.03,1.8,1.05],{rotation:[0,rotation,0],zone:'meeting'});meetingSeats.push({id,side:side<0?'left':'right',position:[x,0,z],rotation});
 }
 for(const[index,x]of[-2.7,-.9,.9,2.7].entries()){
  const id='meeting-chair-crossbar-'+(index+1);place('chair',x,0,-.58,Math.PI);record(id,'Kursi rapat penghubung '+(index+1),'chair','furniture',[x,.87,-.58],[1.03,1.8,1.05],{rotation:[0,Math.PI,0],zone:'meeting'});meetingSeats.push({id,side:'crossbar',position:[x,0,-.58],rotation:Math.PI});
 }
 place('kandao',0,0,-4.8);record('meeting-kandao','Kandao di pedestal tengah meja rapat','kandao','camera',[0,.99,-4.8],[1.55,2.03,1.55]);
 for(const[row,z,xs]of[[0,6.7,[-3,0,3]],[1,3.2,[-4.5,-1.5,1.5,4.5]]])for(const[column,x]of xs.entries()){
  const rowName=row===0?'front':'back',index=(row===0?0:3)+column+1,id='workstation-'+rowName+'-'+(column+1);place('desk',x,0,z);place('chair',x,0,z+1.12,Math.PI);
  record(id,'Meja workstation '+(row===0?'depan':'belakang')+' '+(column+1),'desk','workstation',[x,1.15,z],[2.68,2.28,1.5],{row:rowName,column:column+1,assetReference:index===8?'DRONE-PC':'CC-OPT'+index});
  record(id+'-chair','Kursi workstation '+(row===0?'depan':'belakang')+' '+(column+1),'chair','furniture',[x,.87,z+1.12],[1.03,1.8,1.05],{row:rowName,column:column+1,rotation:[0,Math.PI,0],zone:'workstation'});
  positions.push({id,row:rowName,column:column+1,position:[x,0,z],facing:'front-video-wall'});
  const colleague=OCC_TEAM.find(person=>person.desk===id);if(colleague){const person=createOccPerson(colleague.seat,pixel);person.position.set(x,0,z+1.12);person.rotation.y=Math.PI;person.name='occ-person-'+colleague.seat;people.push(person);record('team-'+colleague.seat,colleague.seat+'. '+colleague.name,'person-'+colleague.seat,'team',[x,1.42,z+1.12],[1.05,1.5,1.02],{person:colleague,zone:'workstation'});}

 }
 for(const[column,x]of[-4.8,4.8].entries())for(const[row,z]of[-7,-1,6].entries()){
  const id='ceiling-speaker-'+(column*3+row+1);place('speaker',x,5.71,z);record(id,'Speaker plafon '+(column*3+row+1),'speaker','audio',[x,5.82,z],[.85,.28,.85]);
 }
 const result=bake(g);result.add(...people);result.userData={layout:'u-conference-table-and-seven-workstations-behind',sideRooms:{left:'IT',right:'Engineer',partition:'glass'},team:OCC_TEAM,workstationCount:7,workstationRows:[3,4],workstationPositions:positions,workstationChairCount:7,meetingChairCount:12,meetingChairSides:{left:4,crossbar:4,right:4},meetingChairPositions:meetingSeats,meetingTableCount:1,meetingTableShape:'rectangular-U-open-toward-video-wall',meetingTableParts:3,videoWallCount:1,videoWallContent:'illustrative-command-centre-display',kandaoCount:1,ptzCount:1,ceilingSpeakerCount:6,frontDirection:'negative-z',illustrativeLayout:true,roomSize:[24,6.45,21.6],roomBounds:{min:[-12,-.4,-10.1],max:[12,6.45,11.5]},objects,hotspotAnchors:{camera:[0,5.85,-9.03],audio:[-4.8,5.95,-1],display:[.3,4.7,-9.4],workstation:[4.5,2.35,6.5],control:[2.74,1.9,-1.9]}};return result;
}

export function createOccRoom(pixel=true){const key=pixel?'pixel':'smooth';if(!roomPrototypes.has(key)){const room=makeRoom(pixel);for(const z of[3.2,6.7]){const shade=contactShadow(13,3.15);shade.position.set(0,.035,z+.4);room.add(shade);}for(const x of[-3.6,3.6]){const shade=contactShadow(3.4,8.2);shade.position.set(x,.035,-5);room.add(shade);}const crossbarShade=contactShadow(10,2.8);crossbarShade.position.set(0,.035,-1.9);room.add(crossbarShade);roomPrototypes.set(key,room);}return roomPrototypes.get(key).clone();}
export function createSelectionMarker(radius=2.15){const key='ring:'+radius;if(!geometries.has(key))geometries.set(key,new THREE.RingGeometry(radius-.035,radius,64));const marker=new THREE.Mesh(geometries.get(key),material(0xb97521));marker.rotation.x=-Math.PI/2;marker.position.y=.045;marker.visible=false;return marker;}
