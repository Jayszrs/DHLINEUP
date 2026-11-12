/**
 * DHLINEUP: original procedural 3D concept models.
 * Compatible with the project's existing Three.js vendor module.
 * These meshes are NOT a photogrammetric reconstruction of the reference CGI.
 * They are editable Three.js geometry to be refined against the included design sheets.
 */
import * as THREE from '../vendor/three.module.js';
import {RoundedBoxGeometry} from '../vendor/RoundedBoxGeometry.js';

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
const softBlack = new THREE.MeshStandardMaterial({color:0x0e141f, roughness:0.33});
const eyeBrown = new THREE.MeshStandardMaterial({color:0x522c25, roughness:0.36});
const hairMat = new THREE.MeshStandardMaterial({color:0x18161d, roughness:0.74});

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
function curve(parent, pts, r, material, name='') {
  const cv=new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(...p)));
  return mesh(parent, new THREE.TubeGeometry(cv, Math.max(14,pts.length*6),r,8,false),material,[0,0,0],name);
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
function boot(parent,x,z,forward=0) {
  sphere(parent,[.29,.24,.38],[x,.25,z+.09+forward],softBlack,16,'safety_boot');
  box(parent,[.48,.33,.6],[x,.30,z],mats.black,'boot_upper');
  for(let i=0;i<4;i++) rod(parent,[x-.15,.39+i*.022,z+.2],[x+.15,.39+i*.022,z+.2],.013,mats.yellow,'laces');
}
function stripe(parent,width,p) {return box(parent,[width,.09,.075],p,mats.silver,'reflective_tape');}

/** Supplied V3 worker adapted to office seating and the application's animation rig. */
export function createWorker({gender='male',clipboard,pose='hero',helmet=true,seat=1}={}) {
  const female=gender==='female',seated=pose==='seated',walking=pose==='walking';
  if(clipboard===undefined)clipboard=female&&!seated&&!walking;
  const root=new THREE.Group();root.name=`DH_Worker_${gender}`;
  const body=new THREE.Group();body.name='worker-uniform';root.add(body);
  const skin=new THREE.MeshStandardMaterial({color:[0xefbb86,0xf0c394,0xeab789,0xefbe8f,0xdca77a,0xe9b584][(seat-1)%6],roughness:.58});
  const hair=new THREE.MeshStandardMaterial({color:[0x222326,0x29211f,0x252127,0x362b27,0x292725,0x20262a][(seat-1)%6],roughness:.65});
  function contour(parent,profile,material,depth=.55,name=''){
    const item=mesh(parent,new THREE.LatheGeometry(profile.map(([r,y])=>new THREE.Vector2(r,y)),36),material,[0,0,0],name);item.scale.z=depth;return item;
  }
  function limb(parent,a,b,r1,r2,material,name=''){
    const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),length=av.distanceTo(bv),half=length/2;
    const item=contour(parent,[[0,-half-r1*.45],[r1*.7,-half-r1*.3],[r1,-half],[r1*.98,-half+length*.2],[r2,half],[r2*.68,half+r2*.3],[0,half+r2*.45]],material,1,name);
    item.position.copy(av).add(bv).multiplyScalar(.5);item.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),bv.sub(av).normalize());return item;
  }
  const torso=[[0,1.33],[.39,1.34],[female?.4:.46,1.53],[female?.42:.48,1.93],[.52,2.31],[.48,2.43],[.23,2.51],[0,2.51]];
  contour(body,torso,mats.blue,.61,'blue_uniform_jacket');
  for(const [y,r]of[[1.61,female?.415:.466],[1.88,female?.422:.478]])contour(body,[[0,y],[r,y],[r+.012,y+.095],[0,y+.095]],mats.silver,.615,'reflective_tape');
  cylinder(body,.13,.15,.27,[0,2.58,0],skin,24,'neck');
  for(const x of[-.22,.22]){
    const collar=box(body,[.23,.20,.055],[x*.67,2.43,.29],mats.blueDeep,'uniform_collar');collar.rotation.z=Math.sign(x)*.35;
    box(body,[.23,.18,.028],[x,2.17,.3],mats.blueDeep,'chest_pocket');
    sphere(body,[.018,.018,.012],[x,2.2,.321],mats.silver,12,'pocket_button');
  }
  box(body,[.035,.68,.018],[0,2.04,.3],mats.blueDeep,'shirt_placket');
  for(let i=0;i<3;i++)sphere(body,[.017,.017,.012],[.025,2.27-i*.17,.319],mats.silver,12,'shirt_button');
  sunburst(body,.22,[.25,2.38,.312],[0,0,0],false);
  contour(body,[[0,1.24],[.4,1.24],[.425,1.39],[0,1.39]],mats.navy,.68,'hips');
  contour(body,[[0,1.33],[.425,1.33],[.429,1.43],[0,1.43]],softBlack,.69,'belt');
  box(body,[.17,.13,.035],[0,1.39,.31],mats.silver,'buckle');
  for(const side of[-1,1]){
    const leg=new THREE.Group();leg.name=side<0?'character-left-leg':'character-right-leg';
    leg.position.set(side*.225,1.28,0);root.add(leg);
    const knee=seated?[side*.025,-.03,.66]:[side*.015,-.57,.015],ankle=seated?[side*.025,-.99,.73]:[side*.02,-1,.02];
    limb(leg,[0,0,0],knee,.175,.15,mats.navy,'cargo_thigh');limb(leg,knee,ankle,.145,.105,mats.navy,'pant_leg');
    box(leg,[.09,.26,.22],[side*.17,-.24,seated?.28:.02],mats.navy,'cargo_pocket');
    const z=ankle[2],x=ankle[0];
    sphere(leg,[.17,.135,.30],[x,-1.11,z+.12],softBlack,24,'safety_boot');
    box(leg,[.32,.055,.54],[x,-1.225,z+.13],mats.black,'boot_sole');
    for(let i=0;i<4;i++)rod(leg,[x-.08,-1.015,z+.17+i*.036],[x+.08,-1.015,z+.19+i*.036],.009,mats.yellow,'laces');
  }
  // Soft continuous face; eyes remain separate so every cloned character can blink.
  const head=new THREE.Group();head.name='character-head';head.position.y=3.0;root.add(head);
  sphere(head,[.425,.50,.36],[0,0,0],skin,40,'face');
  for(const side of[-1,1]){
    sphere(head,[.075,.11,.065],[side*.414,-.045,.01],skin,24,'ear');
    curve(head,[[side*.075,.21,.336],[side*.18,.25,.319],[side*.29,.21,.258]],female?.019:.025,hair,'eyebrow');
    const eye=new THREE.Group();eye.name='character-eye-'+(side<0?'left':'right');eye.position.set(side*.17,.09,.319);head.add(eye);
    sphere(eye,[female?.109:.102,.091,.039],[0,0,0],mats.white,28,'eye_white');
    sphere(eye,[.048,.065,.016],[-side*.005,-.002,.036],eyeBrown,24,'iris');
    sphere(eye,[.027,.046,.009],[-side*.005,-.004,.05],softBlack,24,'pupil');
    sphere(eye,[.014,.018,.004],[-.018,.024,.059],mats.white,16,'eye_glint');
    curve(eye,[[-.1,.008,0],[-.06,.079,.02],[0,.095,.022],[.065,.073,.012],[.1,.005,0]],female?.012:.008,hair,'eyelid');
    if(female)for(let i=0;i<3;i++)curve(eye,[[side*(.07+i*.013),.067-i*.01,.01],[side*(.095+i*.016),.088-i*.01,.009]],.005,hair,'lashes');
  }
  sphere(head,[.037,.085,.037],[0,-.06,.343],skin,24,'nose_bridge');
  sphere(head,[.055,.042,.052],[0,-.137,.367],skin,24,'nose');
  curve(head,[[-.135,-.232,.302],[-.068,-.274,.319],[0,-.284,.323],[.07,-.273,.317],[.137,-.231,.302]],.009,eyeBrown,'smile');
  const positions=[],indices=[],cols=40,rows=18;
  for(let row=0;row<=rows;row++)for(let col=0;col<=cols;col++){
    const phi=col/cols*Math.PI*2,theta=(1.04+(1-Math.cos(phi))*.6)*row/rows;
    positions.push(.445*Math.sin(theta)*Math.sin(phi),.03+.50*Math.cos(theta)+.035*Math.sin(theta)*Math.exp(-Math.pow(Math.atan2(Math.sin(phi),Math.cos(phi))/1.3,2)),-.025+.377*Math.sin(theta)*Math.cos(phi));
  }
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){const a=row*(cols+1)+col,b=a+cols+1;indices.push(a,b,a+1,b,b+1,a+1);}
  const cap=new THREE.BufferGeometry();cap.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));cap.setIndex(indices);cap.computeVertexNormals();mesh(head,cap,hair,[0,0,0],'hair_cap');
  if(female){
    sphere(head,[.36,seat===4?.45:.34,.17],[0,-.20,-.25],hair,32,'hair_back');
    for(const side of[-1,1])sphere(head,[.09,.29,.13],[side*.36,-.13,-.08],hair,28,'side_hair');
    if(seat!==4){sphere(head,[.16,.18,.14],[0,-.12,-.43],hair,24,'ponytail_tie');for(let i=0;i<3;i++)sphere(head,[.12-i*.014,.19,.115],[0,-.28-i*.16,-.44],hair,24,'ponytail');}
  }
  if(helmet){
    const dome=mesh(head,new THREE.SphereGeometry(.49,40,20,0,Math.PI*2,0,Math.PI/2),mats.white,[0,.34,-.025],'helmet_dome');dome.scale.y=.69;
    const brim=cylinder(head,.50,.51,.075,[0,.34,0],mats.white,40,'hardhat_brim');brim.scale.z=1.12;
    box(head,[.11,.06,.54],[0,.66,-.03],mats.white,'helmet_rib');sunburst(head,.30,[0,.48,.434],[0,0,0],true);
  }
  const forward=new THREE.Object3D();forward.name='character-face-forward';forward.position.z=.6;head.add(forward);
  for(const side of[-1,1]){
    const arm=new THREE.Group();arm.name='character-'+(side<0?'left':'right')+'-arm';arm.position.set(side*.51,2.32,0);root.add(arm);
    const elbow=seated?[side*.08,-.42,.28]:walking?[side*.035,-.50,.015]:[side*.18,-.40,.20];
    const wrist=seated?[side*.06,-.21,.94]:walking?[side*.04,-.88,.035]:clipboard&&side>0?[side*.02,-.53,.62]:[side<0?.79:-.78,-.43+(side>0?.12:0),.61];
    limb(arm,[0,0,0],elbow,.155,.13,mats.blue,'sleeve_upper');limb(arm,elbow,wrist,.125,.08,mats.navy,'sleeve_forearm');
    const av=new THREE.Vector3(...elbow).multiplyScalar(.65);sphere(arm,[.156,.055,.16],av.toArray(),mats.silver,24,'arm_reflective');
    sphere(arm,[.095,.072,.13],wrist,skin,24,'hand');for(let i=0;i<4;i++)sphere(arm,[.023,.025,.075],[wrist[0]+(i-1.5)*.038,wrist[1]-.01,wrist[2]+.075],skin,16,'finger');
    arm.userData.baseArmX=0;
  }
  if(clipboard&&!seated&&!walking){const board=new THREE.Group();board.name='inspection_tablet';board.position.set(.56,1.93,.69);board.rotation.set(-.18,.15,-.12);root.add(board);box(board,[.40,.56,.06],[0,0,0],mats.black,'tablet_frame');box(board,[.34,.47,.01],[0,0,.038],mats.glass,'tablet_screen');}
  else if(!seated&&!walking){box(body,[.12,.26,.1],[-.44,1.48,.16],mats.black,'walkie_talkie');rod(body,[-.44,1.57,.16],[-.44,1.89,.16],.011,softBlack,'radio_antenna');}
  root.userData={gender,pose,helmet,sourcePack:'DHLINEUP_3D_CODEX_V3',illustrativeModel:true};return root;
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
