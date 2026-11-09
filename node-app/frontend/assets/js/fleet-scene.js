import * as THREE from './vendor/three.module.js';

for(const container of document.querySelectorAll('[data-fleet-scene]')) {
 const canvas=container.querySelector('canvas'),button=container.querySelector('.scene-pause');
 let renderer;
 try{renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'low-power'});}
 catch{canvas.hidden=true;container.querySelector('.scene-fallback').hidden=false;continue;}
 renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.5));renderer.setClearColor(0x1b2b35,0);
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(34,1,.1,100);
 camera.position.set(7,4.5,8);camera.lookAt(0,.8,0);
 scene.add(new THREE.HemisphereLight(0xeaf3ff,0x5d5044,3));
 const light=new THREE.DirectionalLight(0xffd5a0,4);light.position.set(3,8,5);scene.add(light);
 const material=(color,roughness=.6)=>new THREE.MeshStandardMaterial({color,roughness});
 const orange=material(0xe9982d),dark=material(0x202a31),steel=material(0x7d9299),teal=material(0x159a9d),skin=material(0xd8a275),glass=material(0x284958,.2);
 const box=(parent,size,position,mat)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),mat);mesh.position.set(...position);parent.add(mesh);return mesh;};
 const sphere=(parent,radius,position,mat,scale=[1,1,1])=>{const mesh=new THREE.Mesh(new THREE.SphereGeometry(radius,24,16),mat);mesh.position.set(...position);mesh.scale.set(...scale);parent.add(mesh);return mesh;};
 const rig=new THREE.Group();scene.add(rig);const wheels=[],roadMarks=[];
 const speed=container.dataset.fleetScene==='speed';
 if(speed){
  box(rig,[4.8,.35,2.2],[0,.75,0],dark);
  box(rig,[1.25,1.45,1.85],[1.55,1.65,0],orange);
  box(rig,[.05,.68,1.54],[2.19,1.88,0],glass);
  box(rig,[.8,.62,.04],[1.5,1.9, .95],glass);box(rig,[.8,.62,.04],[1.5,1.9,-.95],glass);
  box(rig,[1.65,.14,2.3],[1.5,2.44,0],orange);
  box(rig,[3.3,.2,2.25],[-.7,1.3,0],orange);
  for(const side of [-1,1]){const rail=box(rig,[3.5,.95,.15],[-.75,1.85,side*1.14],orange);rail.rotation.z=-.08;}
  box(rig,[.18,.9,2.2],[-2.42,1.8,0],orange);
  box(rig,[.15,.65,2.15],[.96,1.85,0],orange);
  for(const x of [-1.65,-.45,1.65])for(const z of [-1.15,1.15]){
   const wheel=new THREE.Group();wheel.position.set(x,.6,z);rig.add(wheel);
   const tire=new THREE.Mesh(new THREE.CylinderGeometry(.6,.6,.45,24),dark);tire.rotation.x=Math.PI/2;wheel.add(tire);
   const hub=new THREE.Mesh(new THREE.CylinderGeometry(.28,.28,.47,16),steel);hub.rotation.x=Math.PI/2;wheel.add(hub);
   box(wheel,[.42,.09,.49],[0,0,0],orange);wheels.push(wheel);
  }
  for(const z of [-.7,.7])box(rig,[.06,.18,.28],[2.22,1.22,z],material(0xffebbc));
  box(rig,[4.9,.1,2.7],[0,.03,0],dark);
  const road=box(scene,[18,.1,5],[0,-.1,0],material(0x334955));
  for(let x=-9;x<9;x+=2){roadMarks.push(box(scene,[.85,.02,.08],[x,-.03,2],material(0xb6bdac)));}
 }else{
  camera.position.set(6,3.7,7);camera.lookAt(0,1.45,0);
  box(rig,[1.05,1.1,.65],[0,1.75,0],teal);
  box(rig,[1.08,.12,.67],[0,1.7,.01],material(0xd7e5d5));
  for(const x of [-.28,.28]){box(rig,[.4,.8,.43],[x,.8,0],dark);box(rig,[.43,.22,.72],[x,.29,.11],dark);}
  sphere(rig,.43,[0,2.67,0],skin,[1,1.1,1]);
  sphere(rig,.49,[0,2.92,0],orange,[1,.6,1]);
  box(rig,[1.13,.08,.96],[0,2.88,.08],orange);
  for(const x of [-.16,.16])sphere(rig,.045,[x,2.7,.397],dark);
  const left=box(rig,[.32,.84,.37],[-.7,1.8,0],teal);left.rotation.z=-.17;sphere(rig,.18,[-.77,1.32,0],skin);
  const arm=new THREE.Group();arm.position.set(.65,2.08,0);rig.add(arm);box(arm,[.32,.73,.36],[0,.3,0],teal);sphere(arm,.18,[0,.8,0],skin);arm.rotation.z=-.45;rig.userData.arm=arm;
  box(rig,[.48,.68,.05],[-.9,1.55,.3],material(0xe9d5aa));
  const base=new THREE.Mesh(new THREE.CylinderGeometry(1.7,1.85,.16,48),material(0x3a515d));base.position.y=.08;scene.add(base);
 }
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');let paused=reduced.matches,visible=true,frame=0,last=0,elapsed=0;
 const pace=Math.max(0,Number(container.dataset.pace)||0),active=speed?pace>0:true;
 const draw=()=>renderer.render(scene,camera);
 const resize=new ResizeObserver(([entry])=>{const {width,height}=entry.contentRect;if(width&&height){renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();draw();}});resize.observe(canvas.parentElement);
 const syncButton=()=>{button.textContent=paused?'Putar animasi':'Jeda animasi';button.setAttribute('aria-pressed',String(paused));};
 const tick=t=>{frame=0;if(paused||!visible||document.hidden)return;const dt=last?Math.min((t-last)/1000,.05):0;last=t;elapsed+=dt;
  if(speed&&active){const rate=Math.min(pace/12,4);for(const wheel of wheels)wheel.rotation.z-=dt*rate;rig.position.y=Math.sin(elapsed*7)*.016;for(const mark of roadMarks){mark.position.x-=dt*rate*2;if(mark.position.x< -9)mark.position.x+=18;}}
  else if(!speed){rig.rotation.y=Math.sin(elapsed*.55)*.16;rig.userData.arm.rotation.z=-.4+Math.sin(elapsed*2.5)*.2;}
  draw();frame=requestAnimationFrame(tick);
 };
 const update=()=>{cancelAnimationFrame(frame);last=0;if(!paused&&visible&&!document.hidden)frame=requestAnimationFrame(tick);else draw();syncButton();};
 button.hidden=false;button.addEventListener('click',()=>{paused=!paused;update();});
 reduced.addEventListener('change',()=>{paused=reduced.matches;update();});
 new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;update();}).observe(container);
 document.addEventListener('visibilitychange',update);
 canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();paused=true;button.hidden=true;canvas.hidden=true;container.querySelector('.scene-fallback').hidden=false;cancelAnimationFrame(frame);});
 update();
}
