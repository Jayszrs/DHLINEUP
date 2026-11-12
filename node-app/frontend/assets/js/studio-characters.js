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
function arm(rig,side,target){
 const upper=rig.bones['arm.'+side],lower=rig.bones['forearm.'+side],hand=rig.bones['hand.'+side];
 const start=upper.getWorldPosition(new THREE.Vector3()),mid=lower.getWorldPosition(new THREE.Vector3()),end=hand.getWorldPosition(new THREE.Vector3());
 const a=start.distanceTo(mid),b=mid.distanceTo(end),toward=target.clone().sub(start),distance=Math.min(a+b-.002,Math.max(Math.abs(a-b)+.002,toward.length()));
 toward.normalize();const along=(a*a-b*b+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,a*a-along*along));
 const pole=direction(rig,new THREE.Vector3(0,-1,.3)).addScaledVector(toward,-direction(rig,new THREE.Vector3(0,-1,.3)).dot(toward)).normalize();
 const elbow=start.clone().addScaledVector(toward,along).addScaledVector(pole,height);
 aim(rig,'arm.'+side,'forearm.'+side,elbow.sub(start));
 aim(rig,'forearm.'+side,'hand.'+side,target.sub(lower.getWorldPosition(new THREE.Vector3())));
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
 model.scale.setScalar(female?1.26:1.12);model.position.y=seated?-.17:0;
 root.updateMatrixWorld(true);
 const bones={};model.traverse(node=>{if(node.isBone){const name=/[LR]$/.test(node.name)?node.name.slice(0,-1)+'.'+node.name.at(-1):node.name;bones[name]=node;}if(node.isMesh){node.frustumCulled=false;node.castShadow=true;node.receiveShadow=true;}});
 const rig={root,model,bones,seated,relaxed,wearHelmet,base:new Map()};
 if(seated){for(const side of['L','R']){
  const foot=bones['foot.'+side].getWorldQuaternion(new THREE.Quaternion());
  aim(rig,'thigh.'+side,'shin.'+side,new THREE.Vector3(0,-.11,.46));
  aim(rig,'shin.'+side,'foot.'+side,new THREE.Vector3(0,-1,.035));
  bones['foot.'+side].quaternion.copy(bones['foot.'+side].parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(foot));
 }}
 const handRest=Object.fromEntries(['L','R'].map(side=>[side,bones['hand.'+side].getWorldQuaternion(new THREE.Quaternion())]));
 for(const [side,x]of[['L',.17],['R',-.17]]){
  const target=new THREE.Vector3(x,seated?(relaxed?1.04:1.40):1.0,seated?(relaxed?.40:.56):.10);
  arm(rig,side,target);
  if(seated){const desired=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),side==='L'?-Math.PI/2:Math.PI/2).multiply(handRest[side]);const hand=bones['hand.'+side];hand.quaternion.copy(hand.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(desired));}
 }
 root.updateMatrixWorld(true);
 const fabric=new THREE.MeshStandardMaterial({color:0x079db8,roughness:.7});
 if(female)for(const side of['L','R']){const upper=bones['arm.'+side],origin=upper.getWorldPosition(new THREE.Vector3()),axis=bones['forearm.'+side].getWorldPosition(new THREE.Vector3()).sub(origin).normalize();const sleeve=new THREE.Mesh(new THREE.CylinderGeometry(.086,.077,.20,24,1,true),fabric);sleeve.position.copy(origin.addScaledVector(axis,.08));sleeve.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),axis);root.add(sleeve);upper.attach(sleeve);}
 const neckY=bones.neck.getWorldPosition(new THREE.Vector3()).y;
 for(const side of[-1,1]){const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute([side*.01,neckY-.02,.11,side*.145,neckY-.07,.09,side*.075,neckY-.17,.16],3));geo.setIndex(side<0?[0,2,1]:[0,1,2]);geo.computeVertexNormals();const collar=new THREE.Mesh(geo,fabric);root.add(collar);bones.chest.attach(collar);}
 const mark=new THREE.Mesh(new THREE.PlaneGeometry(.11,.055),badge());mark.position.set(.105,seated?1.27:1.43,.145);root.add(mark);bones.chest.attach(mark);
 if(wearHelmet)helmet(root,bones.head);
 for(const [name,bone]of Object.entries(bones))rig.base.set(name,bone.quaternion.clone());
 rigs.set(root,rig);
 root.name='DH-Studio-'+(female?'female':'male')+'-'+seat;
 root.userData={studioCharacter:true,isStaffCharacter:true,seated,relaxed,female,seat,headwear:wearHelmet?'white-safety-helmet':'none',sourcePack:'Blender Studio Rain / Snow',characterRevision:'studio-deform-v1',forward:[0,0,1],labelHeight:2.25};
 return root;
}
export function animateStudioCharacter(root,time,phase=0){
 const rig=rigs.get(root);if(!rig)return;
 const {bones,base,seated,relaxed}=rig;
 bones.head.quaternion.copy(base.get('head')).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.sin(time*.65+phase)*.035));
 for(const [side,offset]of[['L',0],['R',Math.PI]]){
  const bone=bones['forearm.'+side];bone.quaternion.copy(base.get('forearm.'+side)).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.sin(time*(seated&&!relaxed?3:.8)+phase+offset)*(seated&&!relaxed?.018:.009)));
  if(!seated&&!rig.wearHelmet){
   const angle=Math.sin(time*7+offset)*.26;
   aim(rig,'thigh.'+side,'shin.'+side,direction(rig,new THREE.Vector3(0,-Math.cos(angle),Math.sin(angle))));
   aim(rig,'shin.'+side,'foot.'+side,direction(rig,new THREE.Vector3(0,-1,Math.max(0,-Math.sin(angle))*.5)));
  }
 }
}
