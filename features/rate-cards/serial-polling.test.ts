import test from 'node:test';
import assert from 'node:assert/strict';
import {startSerialPolling} from './serial-polling';

test('paused import sends no enrichment status requests',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});let calls=0;
 const stop=startSerialPolling(async()=>{calls++;},false);
 t.mock.timers.tick(60000);await Promise.resolve();assert.equal(calls,0);stop();
});
test('slow status requests never overlap and stopping prevents a queued successor',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});let calls=0;let finish!:()=>void;
 const stop=startSerialPolling(async()=>{calls++;await new Promise<void>(r=>{finish=r;});},true);
 assert.equal(calls,1);t.mock.timers.tick(60000);assert.equal(calls,1);
 finish();await Promise.resolve();await Promise.resolve();
 t.mock.timers.tick(4999);assert.equal(calls,1);
 t.mock.timers.tick(1);assert.equal(calls,2);
 stop();finish();await Promise.resolve();await Promise.resolve();t.mock.timers.tick(60000);assert.equal(calls,2);
});
test('an in-flight batch sees cancellation before dispatching another creator',async()=>{
 let finish!:()=>void;let calls=0;
 const stop=startSerialPolling(async active=>{calls++;await new Promise<void>(r=>{finish=r;});if(active())calls++;},true);
 stop();finish();await Promise.resolve();await Promise.resolve();assert.equal(calls,1);
});
