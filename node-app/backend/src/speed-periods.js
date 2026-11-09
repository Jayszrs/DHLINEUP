import {withAverages} from './speed.js';

// Periods are anchored to the last recorded date inside the selected filter.
// Sum the original counts/speed first; averaging daily averages is incorrect.
export function speedPeriods(daily) {
 const reference=daily.at(-1)?.work_date;
 const keys=['DAILY','WTD','MTD','YTD'];
 if(!reference)return keys.map(name=>({name,from:null,to:null,...withAverages({max_speed:null})}));
 const week=new Date(reference+'T00:00:00Z');week.setUTCDate(week.getUTCDate()-((week.getUTCDay()+6)%7));
 const starts=[reference,week.toISOString().slice(0,10),reference.slice(0,7)+'-01',reference.slice(0,4)+'-01-01'];
 return keys.map((name,index)=>{
  const rows=daily.filter(r=>r.work_date>=starts[index]&&r.work_date<=reference);
  const aggregate=rows.reduce((a,r)=>({total_count:a.total_count+Number(r.total_count),moving_count:a.moving_count+Number(r.moving_count),speed_sum:a.speed_sum+Number(r.speed_sum),max_speed:r.max_speed===null?a.max_speed:Math.max(a.max_speed??0,Number(r.max_speed))}),{total_count:0,moving_count:0,speed_sum:0,max_speed:null});
  return{name,from:starts[index],to:reference,...withAverages(aggregate)};
 });
}
