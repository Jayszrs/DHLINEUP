export function lineupFleet(rows,workDate,link) {
 const selected=rows.filter(r=>r.work_date===workDate);
 const pending=selected.filter(r=>['dh','mine','ftw'].some(key=>r[key]!=='Ya')),groups=new Map();
 for(const row of pending){const unit=String(row.unit||'').trim().toUpperCase(),key=unit||'record:'+row.id;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);}
 const items=[...groups.values()].map(records=>{const r=records[0],assignments=records.map(record=>({id:record.id,name:record.operator_name||'Nama belum tercatat',shift:record.shift,missing:[['dh','DH Line Up'],['mine','Mine Dispatch'],['ftw','FTW']].filter(([key])=>record[key]!=='Ya').map(([key,label])=>`${label}: ${record[key]||'Belum diisi'}`),href:link('detail',{id:record.id})}));return{id:r.id,unit:String(r.unit||'').trim().toUpperCase(),name:[...new Set(assignments.map(a=>a.name))].join(' / '),missing:[...new Set(assignments.flatMap(a=>a.missing))],href:assignments[0].href,shift:[...new Set(assignments.map(a=>a.shift))].join(' / '),assignments};});
 return {date:workDate,total:selected.length,driverCount:new Set(pending.map(r=>r.operator_name).filter(Boolean)).size,items};
}
export function speedFleet(units,workDate,link) {
 return {date:workDate,total:units.filter(r=>r.total_count>0).length,items:units.filter(r=>r.total_count>0).map(r=>({id:r.unit,unit:r.unit,average:r.average,moving_average:r.moving_average,max_speed:r.max_speed,count:r.total_count,href:link('speed-unit',{unit:r.unit,from:workDate,to:workDate})}))};
}
