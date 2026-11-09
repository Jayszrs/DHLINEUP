import * as THREE from './vendor/three.module.js';

const materials=new Map(),geometries=new Map(),bakedMaterials=new Map();
function material(color,roughness=.65,metalness=.05){const key=[color,roughness,metalness].join(':');if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color,roughness,metalness}));return materials.get(key);}
const palette={paint:0xe9a132,paintDark:0xb97022,paintLight:0xf4c568,steel:0x9caaa9,rubber:0x252c2e,hub:0xc29a52,glass:0x244651,frame:0x344247,wood:0xb7a28b,teal:0x3b8b88,cloth:0xd8e3dc,skin:0xc58e68};
let contactMaterial;
function contactShadow(width,depth){
 if(typeof document==='undefined')return new THREE.Group();
 if(!contactMaterial){const canvas=document.createElement('canvas');canvas.width=256;canvas.height=128;const ctx=canvas.getContext('2d');if(!ctx)return new THREE.Group();ctx.scale(1,.5);const gradient=ctx.createRadialGradient(128,128,10,128,128,122);gradient.addColorStop(0,'rgba(22,31,26,.25)');gradient.addColorStop(.58,'rgba(22,31,26,.14)');gradient.addColorStop(1,'rgba(22,31,26,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,256,256);const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;contactMaterial=new THREE.MeshBasicMaterial({map,transparent:true,depthWrite:false});}
 const key=`shadow:${width}:${depth}`;if(!geometries.has(key))geometries.set(key,new THREE.PlaneGeometry(width,depth));const result=new THREE.Mesh(geometries.get(key),contactMaterial);result.rotation.x=-Math.PI/2;result.position.y=.025;return result;
}
function mesh(parent,geometry,mat,x=0,y=0,z=0){const item=new THREE.Mesh(geometry,mat);item.position.set(x,y,z);parent.add(item);return item;}
function box(parent,w,h,d,x,y,z,color,rotation){const key=`b:${w}:${h}:${d}`;if(!geometries.has(key))geometries.set(key,new THREE.BoxGeometry(w,h,d));const item=mesh(parent,geometries.get(key),typeof color==='number'?material(color):color,x,y,z);if(rotation)item.rotation.set(...rotation);return item;}
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
 group.updateMatrixWorld(true);const batches=new Map();
 group.traverse(node=>{if(!node.isMesh)return;const g=node.geometry.index?node.geometry.toNonIndexed():node.geometry.clone();g.applyMatrix4(node.matrixWorld);const key=[node.material.roughness,node.material.metalness].join(':');let batch=batches.get(key);if(!batch){batch={list:[],roughness:node.material.roughness,metalness:node.material.metalness};batches.set(key,batch);}batch.list.push({geometry:g,color:node.material.color});});
 const result=new THREE.Group();
 for(const[key,batch]of batches){const count=batch.list.reduce((n,piece)=>n+piece.geometry.attributes.position.count,0),positions=new Float32Array(count*3),normals=new Float32Array(count*3),colors=new Float32Array(count*3);let offset=0;for(const{geometry:g,color}of batch.list){positions.set(g.attributes.position.array,offset);normals.set(g.attributes.normal.array,offset);for(let i=offset;i<offset+g.attributes.position.array.length;i+=3){colors[i]=color.r;colors[i+1]=color.g;colors[i+2]=color.b;}offset+=g.attributes.position.array.length;g.dispose();}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(positions,3));g.setAttribute('normal',new THREE.BufferAttribute(normals,3));g.setAttribute('color',new THREE.BufferAttribute(colors,3));g.computeBoundingSphere();if(!bakedMaterials.has(key))bakedMaterials.set(key,new THREE.MeshStandardMaterial({vertexColors:true,roughness:batch.roughness,metalness:batch.metalness}));result.add(new THREE.Mesh(g,bakedMaterials.get(key)));}
 return result;
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
 for(const z of[-1.48,1.48]){box(g,.045,.5,.045,2.16,2.39,z,p.steel);box(g,.19,.31,.065,2.16,2.57,z,p.frame);box(g,.15,.25,.012,2.16,2.57,z+Math.sign(z)*.04,p.steel);}cylinder(g,.065,.065,.65,-.23,1.28,0,p.steel,8,[0,0,.33]);for(const z of[-.6,.6])cylinder(g,.095,.095,.7,-.6,1.32,z,0x8b9183,12,[0,0,-.48]);return bake(g);
}
export function createTruck(){truckBody??=makeTruckBody();wheelPrototype??=makeWheel();const root=new THREE.Group();root.add(truckBody.clone(),contactShadow(6.7,4.1));const wheels=[];for(const x of[-1.6,1.67])for(const z of[-1.34,1.34]){const wheel=wheelPrototype.clone();wheel.position.set(x,.73,z);root.add(wheel);wheels.push(wheel);}root.userData.wheels=wheels;root.userData.labelHeight=3.45;root.userData.modelFeatures=['open reinforced dump body','four mining tires','tread and rim bolts','cab glazing and wiper','service ladder','guard rails','radiator','mirrors','rear reflectors'];return root;}

const driverPrototypes=new Map();
export function createDriver(pixel=false){
 if(driverPrototypes.has(pixel))return driverPrototypes.get(pixel).clone();const g=new THREE.Group(),p=palette;
 box(g,.68,.83,.39,0,1.19,0,0x247b79);box(g,.74,.73,.43,0,1.23,.015,0x3c9b8d);box(g,.025,.69,.02,0,1.24,.243,0x246260);box(g,.73,.075,.46,0,1.12,.025,0xe0e9d7);box(g,.73,.045,.47,0,1.065,.025,0x8eac75);
 for(const x of[-.215,.215]){box(g,.29,.58,.32,x,.48,0,0x344246);box(g,.31,.2,.51,x,.12,.075,0x273134);box(g,.32,.045,.54,x,.044,.085,0x1a2225);box(g,.29,.055,.25,x,.21,.18,0x54605b);box(g,.072,.62,.035,x,1.28,.248,0xd8e6cf);box(g,.072,.64,.025,x,1.28,-.214,0xd8e6cf);box(g,.02,.54,.037,x-.055,1.3,.25,0xa7bc77);box(g,.19,.14,.025,x,1.23,.25,0x387e72);}
 cylinder(g,.105,.12,.15,0,1.71,0,p.skin,12);sphere(g,.27,0,1.94,0,p.skin,[1,1.12,.96]);for(const x of[-.27,.27])sphere(g,.061,x,1.94,0,p.skin,[.6,1,.7]);helmet(g);
 for(const x of[-.1,.1]){sphere(g,.025,x,1.97,.245,0x263337,[.8,1.1,.45]);box(g,.062,.015,.02,x,2.023,.24,0x6d4f39,[0,0,x<0?.08:-.08]);}sphere(g,.039,0,1.92,.261,p.skin,[.7,.9,.7]);box(g,.074,.012,.019,0,1.83,.247,0x9a6250);
 for(const side of[-1,1]){box(g,.018,.25,.023,side*.224,1.89,.12,0x657875,[0,0,side*.27]);box(g,.025,.018,.18,side*.197,1.765,.06,0x657875);box(g,.19,.065,.025,side*.107,1.73,.12,0x657875);sphere(g,.15,side*.44,1.47,0,0x2d8c84,[1,.82,1]);box(g,.23,.51,.28,side*.49,1.18,0,p.teal,[0,0,side*.09]);box(g,.24,.075,.285,side*.51,1.06,0,0xdbe5d5);sphere(g,.12,side*.53,.84,.015,p.skin,[.85,1.15,.8]);}
 box(g,.34,.49,.055,.54,.87,.2,0xe4dac8,[0,0,-.1]);box(g,.19,.025,.06,.52,1.1,.25,p.steel);for(let y=.78;y<1.01;y+=.055)box(g,.2,.009,.006,.54,y,.236,0xa6987b);box(g,.065,.08,.025,-.2,1.48,.264,0x596d62);
 const result=bake(g);result.add(contactShadow(1.65,1.2));result.userData.labelHeight=2.65;result.userData.modelFeatures=['rounded hardhat dome','chin strap','rounded face','reflective safety vest','work boots','clipboard'];driverPrototypes.set(pixel,result);return result.clone();
}

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
const roomPrototypes=new Map();
function makeRoom(pixel){
 const g=new THREE.Group(),positions=[];box(g,14,.35,12.5,0,-.22,0,0xa9aaa5);box(g,13.65,.04,12.1,0,-.02,0,0xc4c4bb);
 for(let x=-6;x<=6;x++)for(let z=-5;z<=5;z++)box(g,.97,.016,.97,x,.015,z,(x+z)%2?0xb9bbb5:0xb1b4ae);
 box(g,13.8,5.3,.2,0,2.55,-6,0x283338);box(g,13.8,1.25,.24,0,5,-6,0xda6b2f);box(g,.17,5.2,10,-6.9,2.5,-.9,0xb8b9b2);
 for(let z=-4.8;z<3.2;z+=.25)box(g,.06,3.2,.035,-6.77,1.62,z,0x929b9a);
 // The front is the video-wall end (negative Z). Eight desks face it in
 // two rows of four, with a separate meeting table directly before the wall.
 for(const z of[-5.2,-1.65,2.7]){box(g,13.9,.27,.23,0,5.55,z,0x6d4b37);box(g,13.8,.06,.31,0,5.73,z,0xd16a31);for(let x=-6;x<7;x+=3.2)box(g,.07,.43,.1,x,5.19,z,0x535656);}
 for(const x of[-5.7,-5.45,-4.9,4.9,5.45,5.7])cylinder(g,.027,.027,10.35,x,5.45,-.25,0xe78246,pixel?4:12,[Math.PI/2,0,0]);
 for(const x of[-4.2,0,4.2])for(const z of[-4.2,1.8]){cylinder(g,.015,.015,.68,x,5.13,z,0x8e8a7c,6);cylinder(g,.31,.36,.27,x,4.66,z,0xdedbcf,pixel?8:24);cylinder(g,.29,.29,.03,x,4.51,z,0xf8f2d9,pixel?8:24);}
 box(g,12.6,2.6,.18,0,3.43,-5.8,0x121d24);
 for(const x of[-3.12,3.12]){box(g,6.08,2.36,.035,x,3.43,-5.69,0x41656e);for(let row=0;row<2;row++)for(let col=0;col<4;col++){const sx=x+(col-1.5)*1.43,sy=3.43+(row-.5)*1.01;box(g,1.34,.88,.016,sx,sy,-5.66,row?0x70a49f:0x31555e);box(g,1.22,.025,.016,sx,sy-.37,-5.645,0xb7c8be);box(g,.21,.024,.016,sx-.46,sy+.34,-5.64,0xc1a066);}}
 // A timber meeting surface, six meeting chairs, microphones and the
 // central conference camera echo the provided room photograph.
 box(g,7.5,.16,1.44,0,1.24,-3.72,0xcbb598);box(g,7.48,.055,1.43,0,1.345,-3.72,0xdfcbb0);
 for(const x of[-2.8,2.8]){box(g,.2,1.18,.8,x,.6,-3.72,0x6e7670);box(g,1.4,.08,.8,x,.085,-3.72,0x565f5c);}
 for(const x of[-2.2,2.2]){chair(g,x,-2.56,0,pixel);chair(g,x,-4.88,Math.PI,pixel);}
 chair(g,-4.53,-3.72,-Math.PI/2,pixel);chair(g,4.53,-3.72,Math.PI/2,pixel);
 for(const x of[-2.2,2.2]){box(g,.62,.035,.36,x,1.45,-3.6,0x4e5e60);box(g,.62,.42,.04,x,1.66,-3.84,0x304349,[-.15,0,0]);box(g,.55,.33,.014,x,1.66,-3.812,0x698c91,[-.15,0,0]);}
 cylinder(g,.24,.27,.12,0,1.45,-3.72,0x3f5556,pixel?8:24);cylinder(g,.12,.12,.35,0,1.68,-3.72,0x263d44,pixel?8:20);
 for(const x of[-3.1,-1.1,1.1,3.1]){cylinder(g,.1,.13,.04,x,1.44,-3.09,0x394e4c,8);cylinder(g,.014,.014,.3,x,1.6,-3.1,0x5c6d69,8,[.2,0,0]);}
 box(g,.58,.04,.38,3.14,1.44,-3.7,0x33494d);box(g,.48,.012,.29,3.14,1.469,-3.7,0x86a7a5);
 for(const[row,z]of[[0,-.18],[1,3.14]]){
  for(const[column,x]of[[-4.5,-1.5,1.5,4.5]].flatMap(values=>values.map((x,i)=>[i,x]))){
   box(g,2.64,.15,1.27,x,1.28,z,0xc7b397);box(g,2.64,.045,1.27,x,1.38,z,0xe0ceb0);box(g,2.46,.69,.08,x,.95,z-.53,0x7f8983);
   for(const side of[-1,1]){box(g,.09,1.22,.88,x+side*1.12,.62,z,0x556662);box(g,.36,.05,.94,x+side*1.12,.08,z,0x3b4e4b);}
   monitor(g,x,z-.23);chair(g,x,z+1.12,0,pixel);
   box(g,.32,.69,.62,x+1,.73,z+.05,0x344348);box(g,.019,.43,.42,x+1.17,.8,z+.05,0x45575b);box(g,.029,.035,.035,x+1.18,1.02,z+.26,0x93aa98);
   box(g,.05,.03,.08,x+.49,1.43,z+.36,0x526863);box(g,.52,.023,.29,x,1.44,z+.26,0x6f7974);box(g,.055,.05,.055,x-.9,1.45,z+.32,0xd8e0d5);
   cylinder(g,.085,.11,.036,x-.92,1.44,z-.29,0x3d514c,8);cylinder(g,.013,.013,.27,x-.92,1.59,z-.3,0x657a72,8,[.17,0,0]);
   positions.push({row:row===0?'front':'back',column:column+1,position:[x,0,z],facing:'front-video-wall'});
  }
 }
 for(const[x,z]of[[-6.55,-4.4],[6.5,-4.5]]){box(g,.32,.2,.43,x,4.38,z,0xe0e4da,[0,x<0?-.5:.5,.15]);box(g,.05,.15,.05,x,4.53,z,0x8d9691);}
 for(const x of[-5.1,5.1])for(const z of[-4.9,2.5])box(g,.56,.08,.56,x,5.1,z,0xc9c9be);
 const result=bake(g);result.userData={layout:'two-workstation-rows-and-front-meeting-table',workstationCount:8,workstationRows:[4,4],workstationPositions:positions,workstationChairCount:8,meetingChairCount:6,meetingTableCount:1,videoWallCount:1,frontDirection:'negative-z',illustrativeLayout:true,hotspotAnchors:{camera:[-5.95,4.8,-4.5],audio:[-3.1,2,-3.1],display:[.3,4.7,-5.6],workstation:[4.5,2.15,2.8],control:[3.14,1.8,-3.7]}};return result;
}
export function createOccRoom(pixel=true){const key=pixel?'pixel':'smooth';if(!roomPrototypes.has(key)){const room=makeRoom(pixel);for(const z of[-.18,3.14]){const shade=contactShadow(13,3.15);shade.position.set(0,.035,z+.4);room.add(shade);}const meetingShade=contactShadow(9,2.6);meetingShade.position.set(0,.035,-3.72);room.add(meetingShade);roomPrototypes.set(key,room);}return roomPrototypes.get(key).clone();}
export function createSelectionMarker(radius=2.15){const key='ring:'+radius;if(!geometries.has(key))geometries.set(key,new THREE.RingGeometry(radius-.035,radius,64));const marker=new THREE.Mesh(geometries.get(key),material(0xb97521));marker.rotation.x=-Math.PI/2;marker.position.y=.045;marker.visible=false;return marker;}
