import test from 'node:test';
import assert from 'node:assert/strict';
import {jakartaClock,roomSchedule,walkingRoute,routePosition} from '../frontend/assets/js/occ-schedule.js';
test('OCC daily simulation follows WIB work, lunch and night boundaries without assuming attendance',()=>{
 assert.deepEqual(jakartaClock(new Date('2026-11-11T01:00:00Z')),{day:'2026-11-11',minute:480});
 for(const [minute,activity,computer]of[[479,'off','off'],[480,'work','on'],[719,'work','on'],[720,'break','idle'],[779,'break','idle'],[780,'work','on'],[1019,'work','on'],[1020,'off','off'],[1200,'off','off']]){const state=roomSchedule('2026-11-11',minute);assert.equal(state.activity,activity);assert.equal(state.computer,computer);}
 assert.equal(roomSchedule('2026-11-11',1200).period,'night');assert.equal(roomSchedule('2026-11-11',480).period,'morning');
});
test('only persisted meetings in the selected time window can occupy the conference area',()=>{
 const meetings=[{id:1,title:'Visit BCA Sekuritas',start_at:'2026-11-11T06:00:00Z',end_at:'2026-11-11T07:30:00Z'}];
 assert.equal(roomSchedule('2026-11-11',779,meetings).activity,'break');assert.equal(roomSchedule('2026-11-11',780,meetings).active.id,1);assert.equal(roomSchedule('2026-11-11',870,meetings).active,null);assert.equal(roomSchedule('2026-11-10',780,meetings).active,null);assert.equal(roomSchedule('2026-11-10',780,meetings).upcoming.id,1);
});
test('walking uses ordered aisle segments rather than jumping across desks',()=>{
 const route=walkingRoute([-3,0,8.47],1);const start=routePosition(route,0),moving=routePosition(route,.5),end=routePosition(route,1000);assert.deepEqual(start.position,route[0]);assert.equal(moving.position[0],-3);assert.ok(moving.position[2]>8.47);assert.equal(end.done,true);assert.deepEqual(end.position,route.at(-1));assert.equal(route.some(p=>Math.abs(p[0])===6.15),true);
});
