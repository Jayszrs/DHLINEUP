import test from'node:test';import assert from'node:assert/strict';
import{lineupFleet,speedFleet}from'../backend/src/fleet-data.js';
const link=(page,query)=>'/'+page+'?'+new URLSearchParams(query);
test('driver visualization uses selected-date identities and preserves explicit negative statuses',()=>{
 const rows=[{id:'a',work_date:'2026-10-26',unit:'DT1',operator_name:'Driver A',dh:'Ya',mine:'Ya',ftw:'Ya'},{id:'b',work_date:'2026-10-26',unit:'DT2',operator_name:'Driver B',dh:'Ya',mine:'Belum dicek',ftw:'Tidak'},{id:'c',work_date:'2026-11-09',unit:'DT3',operator_name:'Driver C',dh:'Ya',mine:'Tidak',ftw:'Tidak'}];
 const scene=lineupFleet(rows,'2026-10-26',link);assert.equal(scene.total,2);assert.equal(scene.items.length,1);assert.equal(scene.items[0].name,'Driver B');assert.deepEqual(scene.items[0].missing,['Mine Dispatch: Belum dicek','FTW: Tidak']);assert.equal(lineupFleet(rows,'2026-10-16',link).items.length,0);
});
test('speed visualization excludes unrecorded units and links exact selected date',()=>{
 const scene=speedFleet([{unit:'DT1',total_count:2,average:10,moving_average:20,max_speed:20},{unit:'DT2',total_count:0,average:null}],'2026-10-23',link);assert.equal(scene.items.length,1);assert.equal(scene.items[0].average,10);assert.ok(scene.items[0].href.includes('from=2026-10-23'));assert.ok(scene.items[0].href.includes('to=2026-10-23'));
});
