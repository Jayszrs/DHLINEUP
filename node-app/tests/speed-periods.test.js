import test from 'node:test';
import assert from 'node:assert/strict';
import {speedPeriods} from '../backend/src/speed-periods.js';
test('speed periods use weighted counts, Monday WTD and the selected data boundary',()=>{
 const rows=[['2025-12-31',2,1,10],['2026-09-30',5,5,50],['2026-10-25',10,5,100],['2026-10-26',30,10,400],['2026-10-31',20,10,100]].map(([work_date,total_count,moving_count,speed_sum])=>({work_date,total_count,moving_count,speed_sum,max_speed:50}));
 const [daily,wtd,mtd,ytd]=speedPeriods(rows);
 assert.equal(daily.average,5);assert.equal(wtd.from,'2026-10-26');assert.equal(wtd.average,10);assert.equal(wtd.moving_average,25);
 assert.equal(mtd.total_count,60);assert.equal(ytd.total_count,65);
 assert.equal(speedPeriods(rows.slice(0,4))[0].to,'2026-10-26');
});
test('empty speed periods have no invented percentages or zero averages',()=>{
 for(const period of speedPeriods([])){assert.equal(period.average,null);assert.equal(period.moving_ratio,null);assert.equal(period.from,null);}
});
