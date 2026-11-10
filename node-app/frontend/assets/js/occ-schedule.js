export function jakartaClock(now=new Date()){
 const values=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
 return{day:`${values.year}-${values.month}-${values.day}`,minute:Number(values.hour)*60+Number(values.minute)};
}
export const clockText=minute=>`${String(Math.floor(minute/60)).padStart(2,'0')}.${String(Math.floor(minute%60)).padStart(2,'0')}`;
export function roomSchedule(day,minute,meetings=[]){
 const hour=minute/60,period=hour<6||hour>=18?'night':hour<10?'morning':hour<15?'day':'evening';
 const time=new Date(`${day}T${String(Math.floor(hour)).padStart(2,'0')}:${String(Math.floor(minute%60)).padStart(2,'0')}:00+07:00`).valueOf();
 const active=meetings.find(m=>new Date(m.start_at).valueOf()<=time&&new Date(m.end_at).valueOf()>time)||null;
 const upcoming=meetings.filter(m=>new Date(m.start_at).valueOf()>time).sort((a,b)=>new Date(a.start_at)-new Date(b.start_at))[0]||null;
 const working=hour>=8&&hour<17,breakTime=hour>=12&&hour<13;
 return{day,minute,period,activity:!working?'off':breakTime?'break':active?'meeting':'work',active,upcoming,computer:!working?'off':breakTime?'idle':'on',label:!working?'Di luar jam kerja':breakTime?'Istirahat':active?'Simulasi meeting':'Bekerja di komputer'};
}
// Routes stay inside open aisles; scene placement is illustrative, never attendance tracking.
export function walkingRoute(home,seat){
 const [x,,z]=home,lane=z>6?9.1:5.15,side=seat%2?-1:1,restX=side*(5-Math.floor((seat-1)/2)*2);
 return[[x,0,z],[x,0,lane],[side*6.15,0,lane],[side*6.15,0,9.55],[restX,0,9.55],[restX,0,10.55]];
}
export function routePosition(points,metres){
 let remaining=Math.max(0,metres);for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],length=Math.hypot(b[0]-a[0],b[2]-a[2]);if(remaining<=length){const p=length?remaining/length:1;return{position:[a[0]+(b[0]-a[0])*p,0,a[2]+(b[2]-a[2])*p],heading:Math.atan2(b[0]-a[0],b[2]-a[2]),done:false};}remaining-=length;}return{position:points.at(-1),heading:0,done:true};
}
