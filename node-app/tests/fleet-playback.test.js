import test from 'node:test';
import assert from 'node:assert/strict';
import {positionAt,parkingState} from '../frontend/assets/js/fleet-playback.js';

test('sparse GPS observations hold the last fix instead of crossing unknown roads',()=>{
 const route={points:[[0,117,100,25],[.01,117,700,30]]},position=positionAt(route,400);
 assert.equal(position.lat,0);assert.equal(position.lon,117);assert.equal(position.time,100);assert.equal(position.speed,25);assert.equal(position.interpolated,false);assert.equal(parkingState(position),'gap');
});
test('nearby fresh moving observations interpolate within their observed segment',()=>{
 const route={points:[[0,117,100,20],[.0004,117,160,22]]},position=positionAt(route,130);
 assert.ok(Math.abs(position.lat-.0002)<1e-9);assert.equal(position.interpolated,true);assert.equal(position.speed,20);assert.equal(parkingState(position),null);
});
test('a stopped observation stays still and is eligible for illustrative parking',()=>{
 const route={points:[[0,117,100,0],[.0004,117,160,20]]},position=positionAt(route,130);
 assert.equal(position.lat,0);assert.equal(position.interpolated,false);assert.equal(parkingState(position),'stopped');
});
test('breaks and missing or expired observations never create synthetic movement',()=>{
 const route={points:[[0,117,100,20],[.0004,117,160,20]],breaks:[1]};
 assert.equal(positionAt(route,130).lat,0);assert.equal(positionAt(route,99),null);assert.equal(positionAt(route,1061),null);assert.equal(positionAt(null,100),null);assert.equal(parkingState(null),'unavailable');
});
