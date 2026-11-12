/** Original web model of a rigid mining hauler. Dimensions are illustrative.
 * Geometry is shared; fleet-models batches the fixed surfaces by material.
 * No DT number is embedded: the caller supplies all identity plates from data.
 */
import * as THREE from './vendor/three.module.js';
import {RoundedBoxGeometry} from './vendor/RoundedBoxGeometry.js';

const geometry=new Map();
const paint=new THREE.MeshStandardMaterial({color:0xe9a51e,metalness:.25,roughness:.43});
const edge=new THREE.MeshStandardMaterial({color:0xf8c04b,metalness:.23,roughness:.40});
const shadowPaint=new THREE.MeshStandardMaterial({color:0xad711c,metalness:.28,roughness:.57});
const frame=new THREE.MeshStandardMaterial({color:0x30383a,metalness:.48,roughness:.62});
const steel=new THREE.MeshStandardMaterial({color:0x9eaaa5,metalness:.75,roughness:.36});
const rubber=new THREE.MeshStandardMaterial({color:0x202528,metalness:0,roughness:.91});
const tread=new THREE.MeshStandardMaterial({color:0x2a2e2e,metalness:0,roughness:.96});
const glass=new THREE.MeshPhysicalMaterial({color:0x18373d,metalness:.22,roughness:.12,clearcoat:.85,clearcoatRoughness:.1});
const white=new THREE.MeshStandardMaterial({color:0xf1edcf,emissive:0xd6caa3,emissiveIntensity:.15,roughness:.23});
const amber=new THREE.MeshStandardMaterial({color:0xe68a17,emissive:0xa64c08,emissiveIntensity:.15,roughness:.3});
const red=new THREE.MeshStandardMaterial({color:0x9b2524,roughness:.27});
const coal=new THREE.MeshStandardMaterial({color:0x303437,roughness:1});
function cached(key,create){if(!geometry.has(key))geometry.set(key,create());return geometry.get(key);}
function add(parent,g,m,p,name=''){const mesh=new THREE.Mesh(g,m);mesh.position.set(...p);mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
function box(parent,size,p,m,name='',radius=.025){const key='b:'+size+':'+radius;return add(parent,cached(key,()=>radius?new RoundedBoxGeometry(...size,2,radius):new THREE.BoxGeometry(...size)),m,p,name);}
function cylinder(parent,r1,r2,length,p,m,name='',segments=32){return add(parent,cached('c:'+r1+':'+r2+':'+length+':'+segments,()=>new THREE.CylinderGeometry(r1,r2,length,segments)),m,p,name);}
function tube(parent,a,b,r,m,name=''){const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),direction=end.clone().sub(start);const mesh=cylinder(parent,r,r,direction.length(),start.add(end).multiplyScalar(.5).toArray(),m,name,12);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());return mesh;}
function panel(parent,x,points,m){const thickness=.14,positions=[],indices=[];for(const xx of[x-thickness/2,x+thickness/2])for(const[z,y]of points)positions.push(xx,y,z);const count=points.length;for(let i=1;i<count-1;i++)indices.push(0,i+1,i,count,count+i,count+i+1);for(let i=0;i<count;i++){const j=(i+1)%count;indices.push(i,j,count+i,j,count+j,count+i);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return add(parent,g,m,[0,0,0],'formed-steel-bed');}
function tire(parent,x,z,r=1.08){
 const root=new THREE.Group();root.name='heavy_duty_wheel';root.position.set(x,r+.11,z);parent.add(root);
 const profile=[[.43,-.29],[.87,-.29],[1.0,-.23],[1.055,-.12],[1.055,.12],[1.0,.23],[.87,.29],[.43,.29]].map(([radius,axis])=>new THREE.Vector2(radius*r,axis));
 const carcass=add(root,cached('tire:'+r,()=>new THREE.LatheGeometry(profile,64)),rubber,[0,0,0],'curved-tire-sidewall');carcass.rotation.z=Math.PI/2;
 for(const side of[-1,1]){
  const face=cylinder(root,.62*r,.62*r,.025,[side*.292,0,0],shadowPaint,'pressed-wheel-rim',48);face.rotation.z=Math.PI/2;
  const hub=cylinder(root,.31*r,.36*r,.10,[side*.32,0,0],paint,'wheel-hub',40);hub.rotation.z=Math.PI/2;
  const lip=add(root,cached('rim-lip:'+r,()=>new THREE.TorusGeometry(.67*r,.024,8,48)),edge,[side*.31,0,0],'rolled-rim-lip');lip.rotation.y=Math.PI/2;
  for(let i=0;i<12;i++){const a=i*Math.PI/6;const bolt=cylinder(root,.026,.026,.04,[side*.365,Math.sin(a)*.43*r,Math.cos(a)*.43*r],steel,'wheel-lug',8);bolt.rotation.z=Math.PI/2;}
  const ring=add(root,cached('tire-ring:'+r,()=>new THREE.TorusGeometry(.85*r,.008,6,56)),tread,[side*.287,0,0],'molded-sidewall-ring');ring.rotation.y=Math.PI/2;
 }
 for(let i=0;i<44;i++)for(const side of[-1,1]){const a=(i+(side>0?.35:0))*Math.PI*2/44;const block=box(root,[.29,.10,.18],[side*.145,Math.sin(a)*r*1.064,Math.cos(a)*r*1.064],tread,'chevron-tire-tread',.015);block.rotation.set(-a,side*.27,0);}
 return root;
}
export function createDetailedHaulTruck({payload=true}={}){
 const root=new THREE.Group();root.name='DH-Rigid-Mining-Hauler';
 // Box-section chassis, differential, paired rear tyres and front steering axle.
 for(const x of[-.72,.72])box(root,[.26,.44,6.65],[x,1.88,-.3],frame,'chassis-box-section');
 for(const z of[2.05,-2.05]){tube(root,[-2,1.19,z],[2,1.19,z],.16,frame,'axle');const diff=add(root,cached('differential',()=>new THREE.SphereGeometry(.36,24,16)),frame,[0,1.19,z],'differential');diff.scale.set(1.25,.85,1);}
 for(const x of[-1.88,1.88])tire(root,x,2.05);
 for(const x of[-1.91,-1.29,1.29,1.91])tire(root,x,-2.05);
 for(const x of[-1.25,1.25])for(const z of[-2.05,2.05]){tube(root,[x,2.29,z+.25],[x*1.22,1.25,z-.15],.10,shadowPaint,'suspension-strut');tube(root,[x,2.24,z+.23],[x*1.17,1.55,z-.03],.046,steel,'suspension-piston');}
 box(root,[2.9,.57,2.15],[0,2.28,2.03],paint,'engine-compartment',.08);
 box(root,[2.6,1.30,.14],[0,2.19,3.22],frame,'radiator-frame',.05);
 for(let i=0;i<13;i++)box(root,[2.35,.035,.025],[0,1.64+i*.085,3.305],steel,'radiator-louver',.006);
 for(const x of[-.8,0,.8])box(root,[.035,1.09,.025],[x,2.17,3.32],frame,'radiator-upright',.004);
 box(root,[3.65,.34,.42],[0,1.53,3.42],paint,'reinforced-front-bumper',.055);
 for(const x of[-1.47,1.47]){box(root,[.46,.30,.10],[x,1.62,3.66],frame,'lamp-bezel');for(const xx of[-.11,.11])box(root,[.15,.15,.025],[x+xx,1.65,3.719],white,'LED-lamp',.018);box(root,[.14,.075,.03],[x,1.43,3.67],amber,'front-marker');}
 for(const x of[-.91,.91]){const hook=add(root,cached('tow-eye',()=>new THREE.TorusGeometry(.095,.026,10,24)),frame,[x,1.34,3.60],'towing-eye');hook.rotation.x=.15;}
 // Maintenance deck and off-centre operator cabin with window gaskets.
 box(root,[4.45,.16,2.46],[0,2.91,1.88],paint,'maintenance-deck');
 for(let i=0;i<18;i++)box(root,[4.15,.012,.012],[0,3.0,.80+i*.12],shadowPaint,'non-slip-deck',.002);
 box(root,[1.82,1.53,1.60],[-.53,3.71,1.84],paint,'operator-cab',.075);
 box(root,[1.63,.91,.055],[-.53,3.91,2.665],frame,'windscreen-seal',.06);
 box(root,[1.49,.78,.03],[-.53,3.92,2.699],glass,'panoramic-windscreen',.055);
 tube(root,[-1.05,3.59,2.725],[-.50,3.87,2.725],.012,frame,'windscreen-wiper');
 for(const x of[-1.46,.40]){box(root,[.035,.98,1.36],[x,3.88,1.82],frame,'side-window-gasket');box(root,[.040,.85,1.23],[x*1.006,3.90,1.82],glass,'cab-side-window');box(root,[.045,.09,.24],[x*1.02,3.35,2.22],frame,'door-handle');}
 box(root,[1.96,.17,1.76],[-.53,4.55,1.85],edge,'cab-roof',.055);
 for(const x of[-1.54,.58]){tube(root,[x,3.82,2.30],[x*1.25,3.85,2.65],.026,frame,'mirror-arm');box(root,[.13,.32,.18],[x*1.28,3.88,2.67],frame,'wing-mirror',.04);box(root,[.10,.26,.012],[x*1.28,3.88,2.766],steel,'mirror-glass',.015);}
 const exhaust=cylinder(root,.10,.11,1.27,[1.30,3.77,1.13],frame,'exhaust-stack');tube(root,[1.30,4.36,1.13],[1.30,4.49,1.27],.11,frame,'exhaust-tip');
 cylinder(root,.20,.21,.26,[1.25,4.13,1.95],frame,'air-filter');tube(root,[1.25,3.11,1.95],[1.25,4.14,1.95],.095,frame,'air-intake');
 // Full-width shade canopy, load-bearing ribs and service rails.
 box(root,[4.80,.20,2.62],[0,4.78,2.43],paint,'shade-canopy',.04);
 box(root,[4.86,.13,.10],[0,4.68,3.76],edge,'canopy-folded-front-edge');
 for(const x of[-1.72,0,1.72])box(root,[.10,.15,2.37],[x,4.62,2.42],shadowPaint,'canopy-underbrace');
 for(const x of[-1.87,1.87]){box(root,[.20,.16,.11],[x,4.59,3.15],frame,'work-light-frame');box(root,[.14,.10,.025],[x,4.59,3.22],white,'canopy-work-light');}
 for(const x of[-2.12,2.12]){for(const z of[.75,1.5,2.25,3.05])tube(root,[x,3.0,z],[x,3.78,z],.027,edge,'guard-rail-post');for(const y of[3.29,3.77])tube(root,[x,y,.75],[x,y,3.05],.026,edge,'side-safety-rail');}
 for(const y of[3.29,3.77]){tube(root,[-2.12,y,3.05],[-.60,y,3.05],.027,edge,'front-safety-rail');tube(root,[.12,y,3.05],[2.12,y,3.05],.027,edge,'front-safety-rail');}
 for(const x of[-.58,.08])tube(root,[x,1.05,3.77],[x,3.55,3.08],.033,edge,'access-ladder-handrail');
 for(let i=0;i<9;i++){const y=1.12+i*.22,z=3.72-i*.061;box(root,[.64,.055,.25],[-.25,y,z],steel,'serrated-access-step',.008);for(const x of[-.50,0])box(root,[.018,.012,.23],[x,y+.032,z],frame,'step-grip',.002);}
 // Steel dump body: sloped walls, boxed ribs, reinforced rim and rear apron.
 box(root,[4.03,.24,5.22],[0,3.12,-1.52],shadowPaint,'load-bed-floor');
 const outline=[[-4.10,3.22],[.97,3.22],[1.14,4.72],[-4.43,4.72]];
 for(const side of[-1,1]){panel(root,side*2.10,outline,paint);tube(root,[side*2.12,4.76,-4.42],[side*2.12,4.76,1.15],.075,edge,'rolled-bed-rim');for(let z=-3.8;z<.8;z+=.86){const rib=box(root,[.17,1.33,.13],[side*2.20,3.97,z],shadowPaint,'formed-bed-rib',.02);rib.rotation.x=-.09;}for(const z of[-3.6,-1.8,0])box(root,[.045,.075,.18],[side*2.26,3.05,z],amber,'side-marker');}
 box(root,[4.34,1.47,.17],[0,3.99,-4.25],paint,'rear-bed-wall');box(root,[4.47,.18,.20],[0,4.77,-4.30],edge,'rear-bed-rim');
 for(const x of[-1.65,1.65]){tube(root,[x,1.85,-1.1],[x,3.15,.40],.16,frame,'lift-cylinder');tube(root,[x,2.45,-.4],[x,3.25,.48],.074,steel,'lift-ram');box(root,[.65,.08,.40],[x,2.45,-3.35],frame,'rear-mudguard');box(root,[.20,.13,.04],[x,2.45,-3.59],red,'rear-lamp');}
 if(payload)for(let i=0;i<45;i++){const x=-1.66+(i%5)*.79,z=-3.74+Math.floor(i/5)*.51,y=4.50+Math.max(0,.42-Math.abs(x)*.16)+Math.sin(i*3.17)*.06;const chunk=add(root,cached('coal:'+i%4,()=>new THREE.DodecahedronGeometry(.31+(i%4)*.065,0)),coal,[x,y,z],'coal-payload');chunk.rotation.set(i*.23,i*.87,i*.16);chunk.scale.set(1,.72,1.1);}
 root.userData={modelClass:'rigid-hauler-illustration',wheelCount:6,sourcePack:'DH original detailed hauler',identityTexts:[]};
 return root;
}
