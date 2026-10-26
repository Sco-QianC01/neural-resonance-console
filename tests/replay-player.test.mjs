import {test} from 'node:test';
import assert from 'node:assert/strict';
import {replaySpan,formatClock,formatBytes,replayPosition} from '../src/replay-player.mjs';

// A recording is a tape: these are the numbers the transport shows before and
// during playback, so they are checked without a browser.
const rows=[{ts:1000},{ts:1001.5},{ts:1003},{ts:1010}];

test('a recording spans first to last packet, and a single packet has no length',()=>{
  assert.deepEqual(replaySpan(rows),{start:1000,end:1010,duration:10});
  assert.deepEqual(replaySpan([{ts:5}]),{start:5,end:5,duration:0});
  assert.deepEqual(replaySpan([]),{start:0,end:0,duration:0});
  assert.deepEqual(replaySpan(null),{start:0,end:0,duration:0});
  // Out-of-order timestamps still bound the run instead of reporting a negative
  // length: the player must never show a clock that runs backwards.
  assert.equal(replaySpan([{ts:9},{ts:4},{ts:7}]).duration,5);
});

test('the clock is mm:ss below an hour and h:mm:ss above it',()=>{
  assert.equal(formatClock(0),'00:00');
  assert.equal(formatClock(9),'00:09');
  // Truncated: 59.6 s is still the fifty-ninth second.
  assert.equal(formatClock(59.6),'00:59');
  assert.equal(formatClock(60),'01:00');
  assert.equal(formatClock(3599),'59:59');
  assert.equal(formatClock(3600),'1:00:00');
  assert.equal(formatClock(3661),'1:01:01');
  assert.equal(formatClock(-5),'00:00');
  assert.equal(formatClock(undefined),'00:00');
});

test('the playhead reads position, elapsed time and a single clock string',()=>{
  assert.deepEqual(replayPosition(rows,0),
    {position:0,count:4,elapsed:0,duration:10,ratio:0,clock:'00:00 / 00:10'});
  // Two packets consumed: the playhead sits on the second one, 1.5 s in.
  const middle=replayPosition(rows,2);
  assert.equal(middle.elapsed,1.5);
  assert.equal(middle.clock,'00:01 / 00:10');
  // Consuming every packet reports the full length, not one packet short.
  const end=replayPosition(rows,4);
  assert.equal(end.elapsed,10);assert.equal(end.ratio,1);
  assert.equal(end.clock,'00:10 / 00:10');
  // A scrub past the end is clamped, never negative and never beyond the file.
  assert.equal(replayPosition(rows,99).position,4);
  assert.equal(replayPosition(rows,-3).position,0);
});

test('a single-packet file shows a zero-length tape instead of inventing one',()=>{
  const position=replayPosition([{ts:5}],1);
  assert.equal(position.clock,'00:00 / 00:00');
  assert.equal(position.ratio,0);
  assert.equal(replayPosition(null,0).clock,'00:00 / 00:00');
});

test('file sizes read as a person would say them, and unknown is a dash',()=>{
  assert.equal(formatBytes(0),'—');
  assert.equal(formatBytes(undefined),'—');
  assert.equal(formatBytes(512),'512 B');
  assert.equal(formatBytes(2048),'2.0 KB');
  assert.equal(formatBytes(5.25*1024*1024),'5.3 MB');
});
