import * as THREE from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {clone as cloneSkeleton} from './vendor/SkeletonUtils.js';

const assets=new Map(),rigs=new WeakMap();
let loading;
export function loadStudioCharacters(){
 if(typeof document==='undefined')return Promise.resolve();
 if(!loading)loading=Promise.all(['male','female'].map(async gender=>{
  const url=new URL('./dh3d/studio/office-'+gender+'.glb',import.meta.url);
  url.search=new URL(import.meta.url).search;
  const gltf=await new GLTFLoader().loadAsync(url.href);
  assets.set(gender,gltf.scene);
 })).catch(error=>{console.warn('Model karakter belum dapat dimuat.',error);});
 return loading;
}

function direction(rig,vector){return vector.applyQuaternion(rig.root.getWorldQuaternion(new THREE.Quaternion()));}
function aim(rig,name,child,target){
 const bone=rig.bones[name],next=rig.bones[child];if(!bone||!next)return;
 bone.updateWorldMatrix(true,true);
 const current=next.getWorldPosition(new THREE.Vector3()).sub(bone.getWorldPosition(new THREE.Vector3())).normalize();
 const world=bone.getWorldQuaternion(new THREE.Quaternion());
 const delta=new THREE.Quaternion().setFromUnitVectors(current,target.clone().normalize());
 world.premultiply(delta);
 bone.quaternion.copy(bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(world));
 bone.updateWorldMatrix(true,true);
}
function poseLimb(rig, names, target, bendDirection) {
 const [upperName, lowerName, endName] = names;
 const upper = rig.bones[upperName];
 const lower = rig.bones[lowerName];
 const end = rig.bones[endName];
 const startPosition = upper.getWorldPosition(new THREE.Vector3());
 const jointPosition = lower.getWorldPosition(new THREE.Vector3());
 const endPosition = end.getWorldPosition(new THREE.Vector3());
 const upperLength = startPosition.distanceTo(jointPosition);
 const lowerLength = jointPosition.distanceTo(endPosition);
 const toward = target.clone().sub(startPosition);
 const distance = THREE.MathUtils.clamp(toward.length(), Math.abs(upperLength-lowerLength)+.002, upperLength+lowerLength-.002);
 toward.normalize();
 const along = (upperLength*upperLength-lowerLength*lowerLength+distance*distance)/(2*distance);
 const height = Math.sqrt(Math.max(0, upperLength*upperLength-along*along));
 const pole = direction(rig, bendDirection.clone());
 pole.addScaledVector(toward, -pole.dot(toward)).normalize();
 const bendPosition = startPosition.clone().addScaledVector(toward, along).addScaledVector(pole, height);
 aim(rig, upperName, lowerName, bendPosition.sub(startPosition));
 aim(rig, lowerName, endName, target.clone().sub(lower.getWorldPosition(new THREE.Vector3())));
}

const fingerNames=['index','middle','ring','pinky','thumb'];
const localX=new THREE.Vector3(1,0,0),localY=new THREE.Vector3(0,1,0);
const motionRotation=new THREE.Quaternion();

function poseFingers(rig) {
 rig.fingers = [];
 const relaxed = rig.relaxed || !rig.seated;
 const fingerCurl = relaxed ? [.35, .65, .40] : [.12, .22, .12];
 const thumbCurl = [.16, .28, .20];
 for (const side of ['L', 'R']) {
  if (!rig.bones['middle1.'+side] || !rig.bones['middle3.'+side]) continue;
  const position = name => rig.bones[name+'.'+side].getWorldPosition(new THREE.Vector3());
  const forward = position('middle3').sub(position('middle1')).normalize();
  const across = position('index1').sub(position('pinky1')).normalize();
  const palm = forward.clone().cross(across).normalize().multiplyScalar(side==='L' ? 1 : -1);
  for (const [fingerIndex, finger] of fingerNames.entries()) {
   const tangent = finger==='thumb' ? position('thumb3').sub(position('thumb1')).normalize() : forward;
   const worldAxis = tangent.clone().cross(palm).normalize();
   for (let segment=1; segment<=3; segment++) {
    const name = finger+segment+'.'+side;
    const bone = rig.bones[name];
    if (!bone) continue;
    const axis = worldAxis.clone().applyQuaternion(bone.getWorldQuaternion(new THREE.Quaternion()).invert());
    const curl = finger==='thumb' ? thumbCurl[segment-1] : fingerCurl[segment-1]+fingerIndex*.025;
    bone.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(axis, curl));
    rig.fingers.push({name, axis, fingerIndex, segment, side});
   }
  }
 }
}
let badgeMaterial;
function badge(){
 if(!badgeMaterial){const canvas=document.createElement('canvas');canvas.width=256;canvas.height=128;const c=canvas.getContext('2d');c.fillStyle='#efac22';c.font='700 82px "TT Firs Neue"';c.textAlign='center';c.fillText('DH',128,92);const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;badgeMaterial=new THREE.MeshBasicMaterial({map,transparent:true,depthWrite:false,toneMapped:false});}
 return badgeMaterial;
}
function helmet(root,head){
 const group=new THREE.Group(),white=new THREE.MeshStandardMaterial({color:0xf5f3e9,roughness:.35});
 const shell=new THREE.Mesh(new THREE.SphereGeometry(.205,36,20,0,Math.PI*2,0,Math.PI/2),white);shell.scale.y=.7;group.add(shell);
 const brim=new THREE.Mesh(new THREE.CylinderGeometry(.235,.235,.025,40),white);group.add(brim);
 const bounds=new THREE.Box3().setFromObject(root);group.position.set(0,bounds.max.y-.045,.015);root.add(group);head.attach(group);
}
export function createStudioCharacter({seated=false,female=false,seat=1,helmet:wearHelmet=false,relaxed=false}={}){
 const source=assets.get(female?'female':'male');if(!source)return null;
 const root=new THREE.Group(),model=cloneSkeleton(source);root.add(model);
 model.scale.setScalar(female?1.58:1.45);
 root.updateMatrixWorld(true);
 const bones={};model.traverse(node=>{if(node.isBone){const name=/[LR]$/.test(node.name)?node.name.slice(0,-1)+'.'+node.name.at(-1):node.name;bones[name]=node;}if(node.isMesh){node.frustumCulled=false;node.castShadow=true;node.receiveShadow=true;}});
 const rig={root,model,bones,seated,relaxed,wearHelmet,base:new Map()};
 if(seated){
  model.position.y+=.96-bones['thigh.L'].getWorldPosition(new THREE.Vector3()).y;
  root.updateMatrixWorld(true);
 }
 if(seated){for(const side of['L','R']){
  const foot=bones['foot.'+side].getWorldQuaternion(new THREE.Quaternion());
  const ankle=new THREE.Vector3(side==='L'?.13:-.13,.13,side==='L'?.55:.60);
  poseLimb(rig,['thigh.'+side,'shin.'+side,'foot.'+side],ankle,new THREE.Vector3(0,0,1));
  bones['foot.'+side].quaternion.copy(bones['foot.'+side].parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(foot));
 }}
 const handRest=Object.fromEntries(['L','R'].map(side=>[side,bones['hand.'+side].getWorldQuaternion(new THREE.Quaternion())]));
 for(const [side,sign]of[['L',1],['R',-1]]){
  let target=new THREE.Vector3(sign*.36,1.37,.085);
  if(seated)target=new THREE.Vector3(sign*.18,1.40,.49);
  if(seated&&relaxed)target=side==='L'?new THREE.Vector3(.13,1.19,.30):new THREE.Vector3(-.40,1.20,.04);
  poseLimb(rig,['arm.'+side,'forearm.'+side,'hand.'+side],target,new THREE.Vector3(sign*.36,-1,-.28));
  if(seated){
   const desired=new THREE.Quaternion().setFromAxisAngle(localY,-sign*Math.PI/2).multiply(handRest[side]);
   if(relaxed)desired.premultiply(new THREE.Quaternion().setFromAxisAngle(localX,side==='L'?.22:.12));
   const hand=bones['hand.'+side];
   hand.quaternion.copy(hand.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(desired));
  }
 }
 root.updateMatrixWorld(true);
 poseFingers(rig);
 const fabric=new THREE.MeshStandardMaterial({color:0x079db8,roughness:.7});
 if(female)for(const side of ['L','R']){
  const upper=bones['arm.'+side];
  const origin=upper.getWorldPosition(new THREE.Vector3());
  const axis=bones['forearm.'+side].getWorldPosition(new THREE.Vector3()).sub(origin).normalize();
  const profile=[[0,-.12],[.05,-.105],[.085,-.075],[.095,-.025],[.09,.04],[.08,.11],[.075,.16]];
  const geometry=new THREE.LatheGeometry(profile.map(([radius,height])=>new THREE.Vector2(radius,height)),24);
  const sleeve=new THREE.Mesh(geometry,fabric);
  sleeve.position.copy(origin);
  sleeve.quaternion.setFromUnitVectors(localY,axis);
  root.add(sleeve);
  upper.attach(sleeve);
 }
 const mark=new THREE.Mesh(new THREE.PlaneGeometry(.11,.055),badge());mark.position.set(.13,bones.chest.getWorldPosition(new THREE.Vector3()).y+.04,.20);root.add(mark);bones.chest.attach(mark);
 if(wearHelmet)helmet(root,bones.head);
 for(const [name,bone]of Object.entries(bones))rig.base.set(name,bone.quaternion.clone());
 rigs.set(root,rig);
 root.name='DH-Studio-'+(female?'female':'male')+'-'+seat;
 root.userData={studioCharacter:true,isStaffCharacter:true,seated,relaxed,female,seat,headwear:wearHelmet?'white-safety-helmet':'none',sourcePack:'Blender Studio Rain / Snow',characterRevision:'studio-articulated-hands-v2',forward:[0,0,1],labelHeight:2.25};
 return root;
}
export function animateStudioCharacter(root,time,phase=0){
 const rig=rigs.get(root);if(!rig)return;
 const {bones,base,seated,relaxed}=rig;
 bones.head.quaternion.copy(base.get('head')).multiply(motionRotation.setFromAxisAngle(localY,Math.sin(time*.65+phase)*.025));
 const typing=seated&&!relaxed;
 for(const [side,offset]of[['L',0],['R',Math.PI]]){
  const bone=bones['forearm.'+side];
  const movement=Math.sin(time*(typing?2.1:.75)+phase+offset);
  bone.quaternion.copy(base.get('forearm.'+side)).multiply(motionRotation.setFromAxisAngle(localX,movement*(typing?.008:.005)));
  const wrist=bones['hand.'+side];
  wrist.quaternion.copy(base.get('hand.'+side)).multiply(motionRotation.setFromAxisAngle(localY,movement*(typing?.012:.006)));
  if(!seated&&!rig.wearHelmet){
   const angle=Math.sin(time*7+offset)*.26;
   aim(rig,'thigh.'+side,'shin.'+side,direction(rig,new THREE.Vector3(0,-Math.cos(angle),Math.sin(angle))));
   aim(rig,'shin.'+side,'foot.'+side,direction(rig,new THREE.Vector3(0,-1,Math.max(0,-Math.sin(angle))*.5)));
  }
 }
 const activity=Math.pow(.5+.5*Math.sin(time*.55+phase),2);
 for(const {name,axis,fingerIndex,segment,side}of rig.fingers){
  const rhythm=time*(typing?6.2:.65)+fingerIndex*1.65+(side==='L'?0:2.3)+phase;
  const amplitude=typing?(fingerIndex===4?.014:.12)*activity:.012;
  const angle=Math.sin(rhythm)*amplitude*(segment===2?1:.55);
  bones[name].quaternion.copy(base.get(name)).multiply(motionRotation.setFromAxisAngle(axis,angle));
 }
}
