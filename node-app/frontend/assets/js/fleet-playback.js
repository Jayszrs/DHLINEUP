const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export const distance=(a,b)=>Math.hypot((a[0]-b[0])*111195,(a[1]-b[1])*111195*Math.cos(a[0]*Math.PI/180));
const bearing=(a,b)=>Math.atan2((b[1]-a[1])*Math.cos(a[0]*Math.PI/180),b[0]-a[0]);
export function positionAt(route,t,maxGap=900){
 const points=route?.points;if(!points?.length||t<points[0][2]||t>points.at(-1)[2]+maxGap)return null;
 let lo=0,hi=points.length-1;while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(points[mid][2]<=t)lo=mid;else hi=mid-1;}
 const a=points[lo],b=points[lo+1],age=t-a[2],gap=b?b[2]-a[2]:0;
 // Sparse observations cannot establish the shape of a haul road between fixes.
 const interpolate=b&&!route.breaks?.includes(lo+1)&&a[3]>0&&b[3]>0&&gap>0&&gap<=Math.min(120,maxGap)&&distance(a,b)<=60;
 if(!interpolate&&age>maxGap)return null;
 const ratio=interpolate?clamp(age/gap,0,1):0,previous=route.breaks?.includes(lo)?a:points[Math.max(0,lo-1)];
 return{lat:a[0]+(interpolate?b[0]-a[0]:0)*ratio,lon:a[1]+(interpolate?b[1]-a[1]:0)*ratio,speed:a[3],time:a[2],age,heading:interpolate?bearing(a,b):bearing(previous,a),gap:!interpolate&&age>90,interpolated:!!interpolate};
}
export function parkingState(position){return !position?'unavailable':position.gap?'gap':position.speed<=0?'stopped':null;}

// A discarded anomaly also separates observations; it must not reconnect two road segments.
export function prepareRoute(route){
 const boundaries=new Set(route.breaks||[]),observations=[];let segment=0;
 for(const[index,point]of(route.points||[]).entries()){if(boundaries.has(index))segment++;if(!Array.isArray(point)||point.length<4||!point.every(Number.isFinite)||point[3]<0||point[3]>=80)continue;observations.push({point,index,segment});}
 observations.sort((a,b)=>a.point[2]-b.point[2]);const breaks=[];
 for(let i=1;i<observations.length;i++)if(observations[i].segment!==observations[i-1].segment||observations[i].index!==observations[i-1].index+1)breaks.push(i);
 return{...route,points:observations.map(item=>item.point),breaks};
}
