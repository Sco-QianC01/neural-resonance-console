import test from 'node:test';import assert from 'node:assert/strict';
import {timeBounds,timeTailStrength,temporalProjection} from '../src/temporal-model.mjs';
test('time tail is based on playback seconds and remains bounded',()=>{
 assert.equal(timeTailStrength(97,100),0);
 assert.equal(timeTailStrength(98.5,100),.5);
 assert.equal(timeTailStrength(100,100),1);
 assert.equal(timeTailStrength(102,100),1);
 assert.equal(timeTailStrength(99,100,0),0);
});
test('time depth comes from source timestamps and preserves source coordinates',()=>{
 const points=[{timestamp:1000,attention:40,relaxation:60},{timestamp:9000,attention:40,relaxation:60}];
 const saved=structuredClone(points),bounds=timeBounds(points,60),project=temporalProjection(900,650,{x:[0,100],y:[0,100]},bounds);
 assert.deepEqual(bounds,[1000,61000]);assert.notDeepEqual(project.point(points[0]),project.point(points[1]));assert.deepEqual(points,saved);
 assert.equal(project.depth(points[1]),8);assert.equal(project.depth(points[0]),0);
});
test('rotation changes projection only and remains finite in small viewports',()=>{
 const point={timestamp:2500,attention:70,relaxation:30},range={x:[45,95],y:[5,55]};
 const a=temporalProjection(320,340,range,[1000,11000]),b=temporalProjection(320,340,range,[1000,11000],{yaw:-.4,pitch:.2});
 assert.notDeepEqual(a.point(point),b.point(point));assert.equal(b.depth(point),1.5);
 for(const vertex of b.corners)assert.ok(Number.isFinite(vertex.x)&&Number.isFinite(vertex.y));
 assert.equal(a.point({...point,attention:101}),null);
});
