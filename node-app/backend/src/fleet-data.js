export function lineupFleet(rows,workDate,link) {
 const selected=rows.filter(r=>r.work_date===workDate);
 const items=selected.filter(r=>['dh','mine','ftw'].some(key=>r[key]!=='Ya')).map(r=>({id:r.id,unit:r.unit,name:r.operator_name||'Nama belum tercatat',missing:[['dh','DH Line Up'],['mine','Mine Dispatch'],['ftw','FTW']].filter(([key])=>r[key]!=='Ya').map(([key,label])=>`${label}: ${r[key]||'Belum diisi'}`),href:link('detail',{id:r.id}),shift:r.shift}));
 return {date:workDate,total:selected.length,driverCount:new Set(items.map(r=>r.name)).size,items};
}
export function speedFleet(units,workDate,link) {
 return {date:workDate,total:units.filter(r=>r.total_count>0).length,items:units.filter(r=>r.total_count>0).map(r=>({id:r.unit,unit:r.unit,average:r.average,moving_average:r.moving_average,max_speed:r.max_speed,count:r.total_count,href:link('speed-unit',{unit:r.unit,from:workDate,to:workDate})}))};
}
