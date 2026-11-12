/**
 * DHLINEUP: original procedural 3D concept models.
 * Compatible with the project's existing Three.js vendor module.
 * These meshes are NOT a photogrammetric reconstruction of the reference CGI.
 * They are editable Three.js geometry to be refined against the included design sheets.
 */
import * as THREE from '../vendor/three.module.js';
import {RoundedBoxGeometry} from '../vendor/RoundedBoxGeometry.js';
export {createStudioWorker as createWorker} from './dh-premium-characters.js';
import {createStudioWorker as createWorker} from './dh-premium-characters.js';

const PALETTE = Object.freeze({
  blue: 0x00a7e1, blueLight: 0x10aee5, blueDeep: 0x096d9f,
  navy: 0x182b4c, silver: 0xcbd5e1, white: 0xf9fbff, yellow: 0xffb300,
  truckYellow: 0xffb500, truckOrange: 0xd98711, black: 0x20242d,
  cabin: 0x29323d, glass: 0x24536c, darkGlass: 0x132838,
  green: 0x007449, skin: 0xe5ab7a, hair: 0x231c20, stone: 0x555459,
});
const mats = Object.fromEntries(Object.entries(PALETTE).map(([k, color]) => [k,
  new THREE.MeshStandardMaterial({color, roughness: k === 'glass' ? 0.22 : 0.6,
    metalness: ['silver','cabin','truckYellow','truckOrange'].includes(k) ? 0.25 : 0.04})
]));
mats.glass = new THREE.MeshPhysicalMaterial({color: PALETTE.glass, roughness:0.13, metalness:0.1, transparent:true, opacity:0.78, clearcoat:0.8});
const tireMat = new THREE.MeshStandardMaterial({color:0x171a1f, roughness:0.94, metalness:0.01});
const treadMat = new THREE.MeshStandardMaterial({color:0x2b2b2c, roughness:0.98});

function mesh(parent, geometry, material, p=[0,0,0], name='') {
  const out = new THREE.Mesh(geometry, material);
  out.position.set(...p); out.name=name; out.castShadow=true; out.receiveShadow=true;
  parent.add(out); return out;
}
function box(parent, size, p, material, name='') {
  return mesh(parent, new RoundedBoxGeometry(...size, 3, Math.min(.035,...size.map(n=>n*.18))), material, p, name);
}
function sphere(parent, size, p, material, detail=24, name='') {
  const out=mesh(parent,new THREE.SphereGeometry(1,detail,Math.max(12,detail>>1)),material,p,name);
  out.scale.set(...size); return out;
}
function cylinder(parent, top, bottom, height, p, material, sides=24, name='') {
  return mesh(parent,new THREE.CylinderGeometry(top,bottom,height,sides),material,p,name);
}
function rod(parent, a, b, r, material, name='') {
  const start=new THREE.Vector3(...a), end=new THREE.Vector3(...b);
  const d=end.clone().sub(start); const part=cylinder(parent,r,r,d.length(),start.clone().add(end).multiplyScalar(.5).toArray(),material,10,name);
  part.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()); return part;
}

function plate(parent, text, size, p, opts={}) {
  if(typeof document==='undefined') return new THREE.Group();
  const c=document.createElement('canvas'); c.width=1024; c.height=256;
  const ctx=c.getContext('2d'); const bg=opts.bg || '#007649';
  ctx.fillStyle=bg; ctx.fillRect(0,0,1024,256);
  ctx.strokeStyle=opts.border||'#e9f9ed';ctx.lineWidth=14;ctx.strokeRect(13,13,998,230);
  ctx.fillStyle=opts.fg||'#ffffff'; ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.font=`900 ${opts.fontSize||165}px Arial,sans-serif`;ctx.fillText(String(text).toUpperCase(),512,137,945);
  const tx=new THREE.CanvasTexture(c);tx.colorSpace=THREE.SRGBColorSpace;tx.anisotropy=4;
  const m=new THREE.MeshBasicMaterial({map:tx,transparent:false,side:THREE.DoubleSide});
  const out=mesh(parent,new THREE.PlaneGeometry(...size),m,p,'label_'+String(text));
  if(opts.rotation) out.rotation.set(...opts.rotation);
  return out;
}
function sunburst(parent, size, p, rotation=[0,0,0], dark=true) {
  if(typeof document==='undefined')return new THREE.Group();
  const c=document.createElement('canvas');c.width=512;c.height=512;const g=c.getContext('2d');
  g.clearRect(0,0,512,512);g.fillStyle=dark?'#142a3c':'#fbd034';
  for(let i=0;i<13;i++){
    const a=Math.PI*1.04+(i/12)*Math.PI*.94;
    g.beginPath();g.moveTo(256+Math.cos(a)*52,298+Math.sin(a)*52);
    g.lineTo(256+Math.cos(a-.065)*205,298+Math.sin(a-.065)*205);
    g.lineTo(256+Math.cos(a+.065)*205,298+Math.sin(a+.065)*205);
    g.closePath();g.fill();
  }
  g.beginPath();g.moveTo(65,305);g.quadraticCurveTo(256,345,447,305);g.lineTo(410,368);g.lineTo(110,368);g.closePath();g.fill();
  const tx=new THREE.CanvasTexture(c);tx.colorSpace=THREE.SRGBColorSpace;
  const out=mesh(parent,new THREE.PlaneGeometry(size,size),new THREE.MeshBasicMaterial({map:tx,transparent:true,side:THREE.DoubleSide,depthWrite:false}),p,'DH_symbol');
  out.rotation.set(...rotation);return out;
}

function addWheel(root,x,z,r=1.06) {
  const group=new THREE.Group();group.position.set(x,r+.12,z);group.name='heavy_duty_wheel';root.add(group);
  const out=cylinder(group,r,r,.56,[0,0,0],tireMat,40,'tyre');out.rotation.z=Math.PI/2;
  const rim=cylinder(group,r*.60,r*.60,.587,[0,0,0],mats.truckOrange,36,'metal_rim');rim.rotation.z=Math.PI/2;
  const hub=cylinder(group,r*.32,r*.32,.605,[0,0,0],mats.yellow,32,'hub');hub.rotation.z=Math.PI/2;
  for(let i=0;i<12;i++){
    const a=i*2*Math.PI/12;
    sphere(group,[.022,.022,.012],[Math.sign(x)*.31,Math.sin(a)*.45,Math.cos(a)*.45],mats.silver,8,'hub_bolt');
  }
  for(let i=0;i<24;i++){
    const a=(i+.1)*Math.PI*2/24;
    const tread=box(group,[.58,.19,.35],[0,Math.sin(a)*(r+.005),Math.cos(a)*(r+.005)],treadMat,'deep_tyrepads');
    tread.rotation.x=-a;
  }
  return group;
}
function sidePanel(parent,x,pts,mat,name) {
  const verts=[],ids=[];
  // Simple double sided truck bed silhouette, divided into triangles.
  pts.forEach(([z,y])=>verts.push(x,y,z));
  for(let i=1;i<pts.length-1;i++)ids.push(0,i,i+1);
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));g.setIndex(ids);g.computeVertexNormals();
  const material=mat.clone();material.side=THREE.DoubleSide;
  const result=mesh(parent,g,material,[0,0,0],name);
  for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length];rod(parent,[x,a[1],a[0]],[x,b[1],b[0]],.05,mats.truckOrange,'bed_edge');}
  return result;
}
function rock(root,loc,size,seed) {
  const col= [0x525058,0x42434a,0x68656a,0x373941,0x6a6768][seed%5];
  const material=new THREE.MeshStandardMaterial({color:col,roughness:1,flatShading:true});
  const obj=mesh(root,new THREE.IcosahedronGeometry(size,1),material,loc,'ore_payload');
  obj.scale.set(1+(seed%3)*.12,.68+(seed%5)*.06,1.1);obj.rotation.set(seed*.13,seed*.91,seed*.23);return obj;
}
/** Industrial CAT-777-class inspired mining DT, intentionally not engineering-CAD accurate. */
export function createDumpTruck({unitId='', payload=true}={}) {
  const candidate=String(unitId).trim().toUpperCase(),number=/^DT\d{1,8}$/.test(candidate)?candidate:'';
  const root=new THREE.Group();root.name=`DH_Mining_Truck_${number}`;
  const lower=new THREE.Group();lower.name='truck_chassis';root.add(lower);
  // Undercarriage and axle housings.
  box(lower,[2.5,.42,6.0],[0,1.98,0],mats.black,'main_chassis');
  for(let z of [2.05,-2.0]){
    rod(lower,[-2.12,1.25,z],[2.12,1.25,z],.20,mats.cabin,'axle');
    for(let x of [-1.86,1.86]){
      addWheel(lower,x,z,1.09);
      rod(lower,[x*.60,2.03,z+.40],[x*.82,1.40,z-.18],.08,mats.silver,'heavy_duty_suspension');
    }
  }
  box(lower,[2.65,.58,2.10],[0,2.30,2.17],mats.truckYellow,'front_engine_hood');
  // Front radiator grille and steel bumper.
  box(lower,[2.18,1.18,.13],[0,2.34,3.31],mats.black,'radiator_grille');
  for(let y=1.81;y<2.82;y+=.14)box(lower,[2.0,.018,.018],[0,y,3.39],mats.cabin,'grille_slats');
  box(lower,[3.35,.38,.38],[0,1.71,3.49],mats.truckYellow,'front_bumper');
  for(const x of [-1.12,1.12]){
    box(lower,[.38,.22,.085],[x,2.93,3.32],mats.white,'LED_headlight');
    box(lower,[.14,.12,.085],[x,2.72,3.34],mats.truckOrange,'turn_signal');
  }
  // Cabin above the engine deck, glossy window panes.
  box(lower,[1.96,1.64,1.8],[.27,3.48,1.91],mats.cabin,'operator_cabin');
  box(lower,[1.62,.96,.07],[.27,3.72,2.853],mats.glass,'cab_windscreen');
  box(lower,[.06,.97,.11],[.27,3.72,2.9],mats.black,'windscreen_centerframe');
  for(const x of [-.76,1.28])box(lower,[.05,1.02,.09],[x,3.72,2.9],mats.black,'windscreen_outerframe');
  for(const x of [-1.0,1.50]){
    box(lower,[.065,.95,.95],[x,3.69,1.98],mats.glass,'side_cab_glass');
    box(lower,[.12,.15,.26],[x,3.52,2.85],mats.black,'side_mirror');
  }
  // Front load-bearing frame, cab roof and oversized shade canopy.
  box(lower,[2.3,.23,1.86],[.20,4.35,1.91],mats.truckYellow,'cabin_roof');
  box(lower,[4.73,.27,2.65],[0,4.72,2.45],mats.truckYellow,'front_sunshade_canopy');
  box(lower,[4.75,.12,.09],[0,4.57,3.78],mats.truckOrange,'canopy_lip');
  if(number)plate(lower,number,[1.65,.45],[0,4.83,3.789]);
  // Walkway deck, steel rails and detailed steps.
  box(lower,[4.54,.14,2.1],[0,2.88,1.93],mats.truckYellow,'maintenance_platform');
  for(const x of [-2.11,2.11]){
    for(const y of [3.12,3.63])rod(lower,[x,y,1.0],[x,y,3.31],.034,mats.yellow,'guard_rail');
    for(const z of [1.0,1.52,2.05,2.64,3.31])rod(lower,[x,3.07,z],[x,3.67,z],.03,mats.yellow,'vertical_rail');
    // Ladders: long vertical flights with regular yellow rungs.
    for(const side of [-.17,.17])rod(lower,[x+side,1.70,3.12],[x+side,2.91,3.12],.038,mats.truckYellow,'ladder_side');
    for(let y=1.81;y<2.85;y+=.22)rod(lower,[x-.17,y,3.13],[x+.17,y,3.13],.036,mats.truckYellow,'ladder_step');
  }
  // Dump body, broader at the rear with ribbed exterior structure.
  box(lower,[4.05,.27,5.04],[0,3.13,-1.54],mats.truckOrange,'dump_body_floor');
  const boundary=[[-4.08,3.18],[.96,3.18],[1.11,4.72],[-4.35,4.72]];
  for(const s of [-1,1]){
    sidePanel(lower,s*2.08,boundary,mats.truckYellow,'dump_body_sidewall');
    for(let z=-3.9;z<.98;z+=.84){
      rod(lower,[s*2.14,3.38,z],[s*2.14,4.53,z+.12],.06,mats.truckOrange,'sidewall_rib');
    }
    plate(lower,'777',[.70,.38],[s*2.10,4.32,-.32],{bg:'#2b303b',rotation:[0,s*Math.PI/2,0]});
    if(number)plate(lower,number,[1.02,.36],[s*2.108,3.82,-.45],{rotation:[0,s*Math.PI/2,0]});
    sunburst(lower,.55,[s*2.12,3.92,-2.28],[0,s*Math.PI/2,0],true);
  }
  box(lower,[4.35,1.55,.21],[0,3.98,-4.19],mats.truckOrange,'rear_tailgate');
  for(const x of[-2.18,2.18])box(lower,[.22,.19,5.65],[x,4.75,-1.56],mats.truckYellow,'top_ore_bed_rail');
  for(const z of[-4.31,1.19])box(lower,[4.58,.19,.18],[0,4.75,z],mats.truckYellow,'top_ore_bed_rail');
  // Tall rolled upper rim with a precise truck identity panel.
  box(lower,[4.58,.18,.18],[0,4.74,-4.31],mats.truckOrange,'rear_lip');
  for(const x of [-1.8,1.8])rod(lower,[x,2.34,-2.45],[x,3.10,-.50],.12,mats.black,'hydraulic_lift');
  if(payload){
    // Reproducible rock pattern, no flicker on redraw.
    for(let i=0;i<53;i++) {
      const z=-3.85+(i%11)*.39, x=-1.67+(Math.floor(i/11)%5)*.77;
      const y=4.74+.22+Math.max(0, .35-Math.abs(x)*.13)+Math.sin(i*4.5)*.06;
      rock(lower,[x,y,z],.29+(i%4)*.07,i+8);
    }
  }
  sunburst(lower,.67,[0,2.19,3.401],[0,0,0],false);
  if(number)plate(lower,number,[1.46,.42],[0,3.01,3.411]);
  plate(lower,'DH',[.73,.39],[-1.54,4.82,3.77],{bg:'#ffb500',fg:'#172a40',border:'#ffb500',fontSize:172});
  root.userData={unitId:number,style:'procedural editable mining equipment concept',modelClass:'777-style illustrative'};
  return root;
}

export function createMineEnvironment() {
  const root=new THREE.Group();root.name='diorama_ground';
  box(root,[24,.23,18],[0,-.20,0],new THREE.MeshStandardMaterial({color:0xcdbb9d,roughness:1}),'mine_road');
  for(const x of [-8.8,8.8]){
    for(let z=-7;z<=7;z+=2.4){
      box(root,[.18,.52,.18],[x,.27,z],mats.truckYellow,'safety_bollard');
      box(root,[.19,.09,.19],[x,.38,z],mats.black,'bollard_tape');
    }
  }
  for(let i=0;i<26;i++){
    const x=(i%2===0?-1:1)*(8.3+(i%4)*.6),z=-8+(i*1.7)%16;
    rock(root,[x,.12,z],.6+(i%3)*.32,i);
  }
  return root;
}

export function createSceneContents({mode='all',unitId='',environment=false}={}) {
  const root=new THREE.Group();root.name='DHLINEUP_3D_Contents';
  if(mode==='all'||mode==='workers') {
    const man=createWorker({gender:'male'});man.position.set(mode==='all'?-6.85:-.8,0,1.25);root.add(man);
    const woman=createWorker({gender:'female'});woman.position.set(mode==='all'?-4.65:.8,0,1.12);root.add(woman);
  }
  if(mode==='all'||mode==='truck') {
    const truck=createDumpTruck({unitId});truck.position.set(mode==='all'?2.0:0,0,-.5);root.add(truck);
  }
  if(environment)root.add(createMineEnvironment());
  return root;
}
