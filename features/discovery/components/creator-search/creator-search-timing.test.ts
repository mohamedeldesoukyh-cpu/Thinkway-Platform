import { test } from "node:test";
import assert from "node:assert/strict";
import { createSearchDebouncer } from "./creator-search-timing";
test("typing is debounced; only latest value fires",t=>{
  t.mock.timers.enable({apis:["setTimeout"]});const d=createSearchDebouncer();const calls:string[]=[];
  d.schedule(()=>calls.push("old"));t.mock.timers.tick(200);d.schedule(()=>calls.push("new"));t.mock.timers.tick(279);assert.deepEqual(calls,[]);t.mock.timers.tick(1);assert.deepEqual(calls,["new"]);
});
test("Enter submits immediately and cancels delayed duplicate",t=>{
  t.mock.timers.enable({apis:["setTimeout"]});const d=createSearchDebouncer();const calls:string[]=[];
  d.schedule(()=>calls.push("stale"));d.submit(()=>calls.push("@amina"));assert.deepEqual(calls,["@amina"]);t.mock.timers.tick(500);assert.deepEqual(calls,["@amina"]);
});
test("external clear/unmount prevents stale draft returning",t=>{
  t.mock.timers.enable({apis:["setTimeout"]});const d=createSearchDebouncer();let count=0;d.schedule(()=>count++);d.cancel();t.mock.timers.tick(1000);assert.equal(count,0);
});
