import * as THREE from './vendor/three.module.js';
import {createOccWalker,animateCharacter,orientCharacter,workstationScreen} from './fleet-models.js';
import {walkingRoute,routePosition,clockText,jakartaClock} from './occ-schedule.js';

const palettes={morning:{sky:0xb8daf0,city:0x66879b,ambient:2.15,key:2.6,stage:'#f1f0eb'},day:{sky:0x94c5e6,city:0x66869b,ambient:2.5,key:3.1,stage:'#f1f0eb'},evening:{sky:0xdda47b,city:0x787c8a,ambient:1.8,key:2.4,stage:'#eee5dc'},night:{sky:0x0a1832,city:0x1d304c,ambient:.85,key:1.3,stage:'#111e30'}};
function box(group,w,h,d,x,y,z,material){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);mesh.position.set(x,y,z);group.add(mesh);return mesh;}
function shortTime(date){return clockText(jakartaClock(new Date(date)).minute);}
function wrap(c,text,x,y,maxWidth,lineHeight,maxLines=3){const words=String(text).split(/\s+/);let line='',count=0;for(const word of words){const next=line?line+' '+word:word;if(c.measureText(next).width>maxWidth&&line){c.fillText(line,x,y+count*lineHeight);line=word;if(++count>=maxLines)return;}else line=next;}if(line&&count<maxLines)c.fillText(line,x,y+count*lineHeight);}
function roomScenery(room){
 const root=new THREE.Group();root.name='floor-32-context';room.add(root);
 const steel=new THREE.MeshStandardMaterial({color:0x536878,roughness:.7}),glass=new THREE.MeshBasicMaterial({color:0x73a9c4,transparent:true,opacity:.2,depthWrite:false});
 for(const y of[-.55,-1.15,-1.75])box(root,24,.12,21.5,0,y,.7,steel);
 for(const x of[-11.9,11.9])box(root,.045,1.9,21.3,x,-.85,.7,glass);
 const plaque=document.createElement('canvas');plaque.width=1024;plaque.height=144;const c=plaque.getContext('2d');c.fillStyle='#173347';c.fillRect(0,0,1024,144);c.fillStyle='#f9b844';c.font='bold 60px Segoe UI';c.textAlign='center';c.fillText('OCC JHO  /  LANTAI 32',512,94);const plaqueMap=new THREE.CanvasTexture(plaque);plaqueMap.colorSpace=THREE.SRGBColorSpace;const sign=new THREE.Mesh(new THREE.PlaneGeometry(7,.98),new THREE.MeshBasicMaterial({map:plaqueMap,toneMapped:false}));sign.position.set(0,-.75,11.53);root.add(sign);
 return{root};
}
export function createOccActivity(room,{viewport,lights,team=[]}){
 const scenery=roomScenery(room),agendaCanvas=document.createElement('canvas');agendaCanvas.width=1800;agendaCanvas.height=400;const agendaTexture=new THREE.CanvasTexture(agendaCanvas);agendaTexture.colorSpace=THREE.SRGBColorSpace;
 const screenMaterial=new THREE.MeshBasicMaterial({map:agendaTexture,toneMapped:false}),board=new THREE.Mesh(new THREE.PlaneGeometry(12.1,2.62),screenMaterial);board.position.set(0,3.33,-9.22);board.name='occ-agenda-board';room.add(board);
 const monitors=[];room.traverse(node=>{if(node.userData.monitorScreen)monitors.push(node);});
 const people=room.userData.team.map(person=>{const seated=room.getObjectByName('occ-person-'+person.seat),home=seated.position.clone(),walker=createOccWalker(person.seat);walker.name='occ-walker-'+person.seat;walker.visible=false;room.add(walker);const profile=team.find(p=>p.nik===person.nik);return{person,inactive:['Cuti','Tidak bertugas'].includes(profile?.work_status),seated,walker,home,current:home.clone(),route:[],travel:0,mode:'work',rotation:Math.PI,target:home.clone(),arrived:true};});
 let prior='',phase='',screenKey='',started=false,currentState=null;
 function agenda(state){const context=agendaCanvas.getContext('2d'),meeting=state.active||state.upcoming;context.fillStyle='#07172d';context.fillRect(0,0,1800,400);context.fillStyle='#f08a20';context.fillRect(0,0,1800,61);context.fillStyle='#13263a';context.font='bold 29px Segoe UI';context.fillText('OPERATION COMMAND CENTRE  /  JHO  /  LANTAI 32',38,41);context.fillStyle='#e9f4ff';context.font='bold 58px Segoe UI';context.fillText(clockText(state.minute)+' WIB',40,148);context.font='bold 34px Segoe UI';context.fillText(state.label,40,207);context.font='25px Segoe UI';context.fillStyle='#a8cae6';context.fillText(state.day,40,258);context.fillText('Simulasi aktivitas, bukan presensi',40,337);context.fillStyle='#29445d';context.fillRect(750,85,2,270);context.fillStyle='#f8be67';context.font='bold 28px Segoe UI';context.fillText(state.active?'MEETING TERJADWAL':meeting?'MEETING BERIKUTNYA':'AGENDA RUANG',790,127);context.fillStyle='#f1f6fc';context.font='bold 38px Segoe UI';wrap(context,meeting?.title||'Belum ada meeting pada tanggal ini',790,188,960,49,2);if(meeting){context.font='30px Segoe UI';context.fillStyle='#b8d9f2';context.fillText(jakartaClock(new Date(meeting.start_at)).day+' · '+shortTime(meeting.start_at)+'–'+shortTime(meeting.end_at)+' WIB',790,322);}agendaTexture.needsUpdate=true;}
 function routeFor(entry,mode){
  const x=entry.current.x,z=entry.current.z,side=x<0?-1:1,home=entry.home,homeLane=home.z>6?9.1:5.15;
  if(mode==='break'){const route=walkingRoute([home.x,0,home.z+.65],entry.person.seat);entry.target.set(...route.at(-1));return z<0?[[x,0,z],[side*6.15,0,z],[side*6.15,0,9.55],[entry.target.x,0,9.55],entry.target.toArray()]:route;}
  if(mode==='meeting'){const seats=room.userData.meetingChairPositions.filter(s=>s.side==='left'||s.side==='right'),target=seats[(entry.person.seat-1)%seats.length];entry.target.set(...target.position);entry.rotation=target.rotation;return[[x,0,Math.min(z+.65,10.8)],[x,0,z>6?9.1:5.15],[side*6.15,0,z>6?9.1:5.15],[side*6.15,0,target.position[2]],[target.position[0]+(target.side==='left'?-.75:.75),0,target.position[2]]];}
  entry.target.copy(home);entry.rotation=Math.PI;return[[x,0,z],[side*6.15,0,z],[side*6.15,0,homeLane],[home.x,0,homeLane],[home.x,0,home.z+.65]];
 }
 function setActivity(state){
  const changed=prior!==state.activity+':'+(state.activity==='meeting'?state.active?.id||'':'');prior=state.activity+':'+(state.activity==='meeting'?state.active?.id||'':'');currentState=state;
  if(phase!==state.period){phase=state.period;const p=palettes[phase];viewport.style.background=p.stage;lights.ambient.intensity=p.ambient;lights.key.intensity=p.key;lights.key.color.setHex(phase==='night'?0xb5d6ff:phase==='evening'?0xffbf87:0xffedcf);}
  const signature=[state.minute,state.active?.id,state.upcoming?.id,state.activity].join(':');if(screenKey!==signature){screenKey=signature;agenda(state);const used=new Set(team.filter(p=>!['Cuti','Tidak bertugas'].includes(p.work_status)).map(p=>p.desk));for(const monitor of monitors)monitor.material=workstationScreen(monitor.userData.workstationId&&!used.has(monitor.userData.workstationId)?'off':state.computer);}
  if(!changed&&started)return;
  for(const entry of people){
   if(state.activity==='off'||entry.inactive){entry.seated.visible=false;entry.walker.visible=false;entry.mode='off';entry.arrived=true;continue;}
   const wasOff=entry.mode==='off';entry.mode=state.activity;entry.travel=0;entry.delay=(entry.person.seat-1)*.45;entry.arrived=false;
   if((!started||wasOff)&&state.activity!=='break'){if(state.activity==='meeting')routeFor(entry,'meeting');else entry.target.copy(entry.home);entry.seated.position.copy(entry.target);orientCharacter(entry.seated,state.activity==='meeting'?entry.rotation:Math.PI);entry.current.copy(entry.target);entry.seated.visible=true;entry.walker.visible=false;entry.arrived=true;}
   else{entry.route=routeFor(entry,state.activity);entry.seated.visible=false;entry.walker.visible=true;}
  }started=true;
 }
 function update(time,dt,state,snap=false){setActivity(state);const positions=new Map();for(const entry of people){
  if(entry.mode==='off'){positions.set(entry.person.seat,{position:entry.home.toArray(),visible:false});continue;}
  if(!entry.arrived){entry.delay=Math.max(0,(entry.delay||0)-dt);if(!entry.delay)entry.travel+=dt*1.45;const move=routePosition(entry.route,snap?Infinity:entry.travel);entry.walker.position.set(...move.position);entry.current.copy(entry.walker.position);orientCharacter(entry.walker,move.heading);for(const side of['left','right']){const leg=entry.walker.getObjectByName('character-'+side+'-leg');if(leg)leg.rotation.x=Math.sin(time*7+(side==='left'?0:Math.PI))*.4;}animateCharacter(entry.walker,time,entry.person.seat);for(const side of['left','right']){const arm=entry.walker.getObjectByName('character-'+side+'-arm');if(arm)arm.rotation.x=Math.sin(time*7+(side==='left'?Math.PI:0))*.22;}if(move.done){if(entry.mode==='break'){entry.route=[move.position,[entry.target.x+(entry.target.x<0?-.3:.3),0,entry.target.z],entry.target.toArray()];entry.travel=0;}else{entry.arrived=true;entry.walker.visible=false;entry.seated.visible=true;entry.seated.position.copy(entry.target);orientCharacter(entry.seated,entry.rotation);entry.current.copy(entry.target);}}}
  else animateCharacter(entry.seated,time,entry.person.seat);
  positions.set(entry.person.seat,{position:entry.current.toArray(),visible:true});
 }return positions;}
 return{update,screenMaterial,get state(){return currentState;},dispose(){const materials=new Set();scenery.root.traverse(node=>{if(node.isMesh){node.geometry.dispose();materials.add(node.material);}});for(const material of materials){material.map?.dispose();material.dispose();}board.geometry.dispose();agendaTexture.dispose();screenMaterial.dispose();}};
}
