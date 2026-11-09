import * as THREE from './vendor/three.module.js';

const materials=new Map(),geometries=new Map();
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

// Bake every static material into one mesh, so a fleet shares both geometry
// and materials without paying a draw call for every small model detail.
function bake(group){
 group.updateMatrixWorld(true);const batches=new Map();
 group.traverse(node=>{if(!node.isMesh)return;const g=node.geometry.index?node.geometry.toNonIndexed():node.geometry.clone();g.applyMatrix4(node.matrixWorld);let list=batches.get(node.material);if(!list){list=[];batches.set(node.material,list);}list.push(g);});
 const result=new THREE.Group();
 for(const [mat,list]of batches){const count=list.reduce((n,g)=>n+g.attributes.position.count,0),positions=new Float32Array(count*3),normals=new Float32Array(count*3);let offset=0;for(const g of list){positions.set(g.attributes.position.array,offset);normals.set(g.attributes.normal.array,offset);offset+=g.attributes.position.array.length;g.dispose();}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(positions,3));g.setAttribute('normal',new THREE.BufferAttribute(normals,3));g.computeBoundingSphere();result.add(new THREE.Mesh(g,mat));}
 return result;
}

let truckBody,wheelPrototype;
function makeWheel(){
 const g=new THREE.Group();cylinder(g,.72,.72,.53,0,0,0,palette.rubber,24,[Math.PI/2,0,0]);
 for(const z of[-.28,.28]){cylinder(g,.39,.39,.035,0,0,z,palette.hub,16,[Math.PI/2,0,0]);cylinder(g,.17,.17,.055,0,0,z*1.1,palette.steel,12,[Math.PI/2,0,0]);for(let i=0;i<8;i++){const a=i*Math.PI/4;cylinder(g,.032,.032,.035,Math.cos(a)*.29,Math.sin(a)*.29,z*1.12,palette.frame,6,[Math.PI/2,0,0]);}}
 for(let i=0;i<16;i++){const a=i*Math.PI/8;box(g,.11,.1,.58,Math.sin(a)*.72,Math.cos(a)*.72,0,0x3b4243,[0,0,-a]);}
 return bake(g);
}
function makeTruckBody(){
 const g=new THREE.Group(),p=palette;box(g,5.4,.32,2.35,0,.83,0,p.frame);box(g,4.7,.22,1.65,-.1,1.08,0,p.paintDark);box(g,3.45,.17,2.55,-.7,1.47,0,p.paintDark);
 for(const z of[-1.34,1.34]){box(g,3.85,.16,.19,-.65,2.64,z,p.paintLight);box(g,3.65,1.02,.15,-.67,2.05,z,p.paint,[z<0?-.13:.13,0,-.06]);for(let x=-2.18;x<1.05;x+=.66)box(g,.11,.99,.1,x,2.08,z*1.065,p.paintDark,[0,0,-.06]);}
 box(g,.18,1.13,2.58,-2.56,2.04,0,p.paint,[0,0,-.16]);box(g,.16,1.08,2.57,1.15,2.04,0,p.paintDark,[0,0,-.12]);box(g,1.12,.14,2.86,1.25,2.69,0,p.paint);
 // Operator cab, radiator, ladder, railings and mirrors follow a mine truck.
 box(g,1.28,1.38,1.12,1.8,1.98,.68,p.paint);box(g,.09,.82,.97,2.48,2.17,.68,p.glass);box(g,.93,.8,.055,1.8,2.17,1.267,p.glass);box(g,.08,.9,.08,1.83,2.17,1.303,p.paintLight);box(g,1.6,.12,1.46,1.83,2.75,.68,p.paintLight);
 box(g,1.14,.93,1.04,1.85,1.73,-.62,p.paintDark);box(g,.06,.69,.88,2.46,1.73,-.62,p.frame);for(let y=1.46;y<2.1;y+=.1)box(g,.075,.026,.81,2.51,y,-.62,p.steel);
 box(g,1.6,.13,3.22,1.9,1.29,0,p.paint);box(g,.24,.25,3.26,2.72,1.1,0,p.frame);
 for(const z of[-1.29,1.29]){box(g,.06,.22,.38,2.86,1.17,z,0xffebbd);for(const x of[1.29,2.55])box(g,.045,.6,.045,x,1.66,z,p.steel);box(g,1.3,.05,.05,1.9,1.96,z,p.steel);}
 for(let y=.42;y<1.3;y+=.22)box(g,.54,.06,.31,1.75,y,1.63,p.steel);box(g,.045,1.28,.045,1.44,.94,1.76,p.frame);box(g,.045,1.28,.045,2.06,.94,1.76,p.frame);
 cylinder(g,.09,.09,1.45,1.17,2.13,-1.2,p.frame,10);cylinder(g,.13,.13,.11,1.17,2.88,-1.2,p.frame,10);
 for(const z of[-1.48,1.48]){box(g,.045,.5,.045,2.16,2.39,z,p.steel);box(g,.19,.31,.065,2.16,2.57,z,p.frame);}cylinder(g,.065,.065,.65,-.23,1.28,0,p.steel,8,[0,0,.33]);return bake(g);
}
export function createTruck(){truckBody??=makeTruckBody();wheelPrototype??=makeWheel();const root=new THREE.Group();root.add(truckBody.clone(),contactShadow(6.7,4.1));const wheels=[];for(const x of[-1.6,1.67])for(const z of[-1.34,1.34]){const wheel=wheelPrototype.clone();wheel.position.set(x,.73,z);root.add(wheel);wheels.push(wheel);}root.userData.wheels=wheels;root.userData.labelHeight=3.45;return root;}

const driverPrototypes=new Map();
export function createDriver(pixel=false){
 if(driverPrototypes.has(pixel))return driverPrototypes.get(pixel).clone();const g=new THREE.Group(),p=palette;
 box(g,.72,.84,.44,0,1.18,0,p.teal);box(g,.75,.09,.46,0,1.15,.01,p.cloth);for(const x of[-.21,.21]){box(g,.28,.58,.32,x,.48,0,p.frame);box(g,.3,.17,.53,x,.1,.085,p.rubber);box(g,.08,.75,.47,x,1.22,.005,p.cloth);}
 if(pixel){box(g,.49,.49,.46,0,1.91,0,p.skin);box(g,.62,.18,.61,0,2.18,0,p.paint);box(g,.73,.06,.68,0,2.09,.03,p.paintLight);}else{sphere(g,.28,0,1.92,0,p.skin,[1,1.12,1]);sphere(g,.325,0,2.13,0,p.paint,[1,.56,1]);cylinder(g,.37,.37,.045,0,2.08,.025,p.paintLight,20);}
 for(const x of[-.115,.115])box(g,.042,.045,.025,x,1.95,.239,p.rubber);for(const x of[-.5,.5]){box(g,.23,.65,.28,x,1.2,0,p.teal,[0,0,x<0?-.12:.12]);box(g,.2,.18,.2,x*1.08,.82,0,p.skin);}box(g,.36,.5,.05,.53,.88,.21,0xe4dac8,[0,0,-.1]);box(g,.18,.025,.06,.53,1.11,.25,p.steel);
 const result=bake(g);result.add(contactShadow(1.65,1.2));result.userData.labelHeight=2.65;driverPrototypes.set(pixel,result);return result.clone();
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
 const g=new THREE.Group();box(g,14,.35,12.5,0,-.22,0,0xa9aaa5);box(g,13.65,.04,12.1,0,-.02,0,0xc4c4bb);for(let x=-6;x<=6;x++)for(let z=-5;z<=5;z++)box(g,.97,.016,.97,x,.015,z,(x+z)%2?0xb9bbb5:0xb1b4ae);
 box(g,13.8,5.3,.2,0,2.55,-6,0x2b3337);box(g,13.8,1.45,.24,0,5.1,-6,0xd6682e);box(g,.17,5.2,10,-6.9,2.5,-.9,0xb8b9b2);for(let z=-4.8;z<3.2;z+=.35)box(g,.06,3.2,.045,-6.77,1.62,z,0x8f9999);
 // A cut-away ceiling retains the photo's orange beams and exposed conduit.
 for(const z of[-5.2,-1.6,2.5]){box(g,13.9,.27,.23,0,5.55,z,0x8c472b);for(let x=-6;x<7;x+=3.2)box(g,.07,.43,.1,x,5.19,z,0x535656);}for(const x of[-5.5,-3.8,3.8,5.5])cylinder(g,.032,.032,9.9,x,5.45,-.4,0xe78246,pixel?4:10,[Math.PI/2,0,0]);
 for(const x of[-4,0,4])for(const z of[-4,1.7]){cylinder(g,.015,.015,.68,x,5.13,z,0x8e8a7c,6);cylinder(g,.31,.36,.27,x,4.66,z,0xdedbcf,pixel?8:20);cylinder(g,.29,.29,.03,x,4.51,z,0xf8f2d9,pixel?8:20);}
 for(const x of[-3.35,3.35]){box(g,5.75,2.3,.13,x,3.43,-5.82,0x121e25);box(g,5.52,2.07,.03,x,3.43,-5.74,0x43666e);for(let row=0;row<2;row++)for(let col=0;col<4;col++){const sx=x+(col-1.5)*1.3,sy=3.43+(row-.5)*.88;box(g,1.21,.76,.012,sx,sy,-5.71,row?0x82aaa8:0x33545f);box(g,1.21,.025,.015,sx,sy-.34,-5.695,0xb7c8be);}}
 for(const side of[-1,1]){const x=side*3.75;box(g,2.2,.19,8.1,x,1.29,.2,0xc7b193);box(g,.13,1.2,7.8,x+side*.92,.61,.2,0x7f827b);box(g,1.75,.78,.12,x,.89,-3.7,0x747a77);for(let i=0;i<4;i++){const z=-2.55+i*1.75;monitor(g,x-side*.3,z,side>0?-Math.PI/2:Math.PI/2);chair(g,x+side*1.85,z,side>0?Math.PI/2:-Math.PI/2,pixel);}for(let i=0;i<5;i++){const z=-2.8+i*1.45;cylinder(g,.11,.14,.05,x-side*.73,1.43,z,0x3c484a,8);cylinder(g,.018,.018,.37,x-side*.73,1.62,z,0x596b6d,6,[0,0,side*.25]);}}
 box(g,2.4,.16,1.4,0,1.2,-3.95,0xc7b193);box(g,.3,1.2,.3,0,.58,-3.95,0x65726d);monitor(g,0,-3.85);box(g,.7,.05,.43,-2.77,1.47,.3,0x34454b);box(g,.55,.025,.32,-2.77,1.51,.3,0x789da1);cylinder(g,.24,.31,.15,0,1.43,-3.95,0x364e53,pixel?6:18);cylinder(g,.12,.12,.39,0,1.67,-3.95,0x253b45,pixel?6:14);
 for(const[x,z]of[[-6.55,-4.4],[6.5,-4.5]]){box(g,.32,.2,.43,x,4.38,z,0xe0e4da,[0,x<0?-.5:.5,.15]);box(g,.05,.15,.05,x,4.53,z,0x8d9691);}for(const x of[-5.1,5.1])for(const z of[-4.9,2.5])box(g,.56,.08,.56,x,5.1,z,0xc9c9be);return bake(g);
}
export function createOccRoom(pixel=true){const key=pixel?'pixel':'smooth';if(!roomPrototypes.has(key)){const room=makeRoom(pixel);for(const x of[-3.75,3.75]){const shade=contactShadow(4.3,10);shade.position.set(x,.035,.2);room.add(shade);}roomPrototypes.set(key,room);}return roomPrototypes.get(key).clone();}
export function createSelectionMarker(radius=2.15){const key='ring:'+radius;if(!geometries.has(key))geometries.set(key,new THREE.RingGeometry(radius-.035,radius,64));const marker=new THREE.Mesh(geometries.get(key),material(0xb97521));marker.rotation.x=-Math.PI/2;marker.position.y=.045;marker.visible=false;return marker;}
