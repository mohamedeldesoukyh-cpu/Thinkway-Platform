import assert from "node:assert/strict";
import test from "node:test";
import {measureRedisPing} from "./measure-ping";
test("connection setup does not inflate command latency",async()=>{
 let time=0;
 const result=await measureRedisPing({connect:async()=>{time+=280;},ping:async()=>{time+=40;return "PONG";}},()=>time);
 assert.deepEqual(result,{pong:"PONG",connectionLatencyMs:280,latencyMs:40});
});
test("failed connection stays a failed probe",async()=>{
 await assert.rejects(measureRedisPing({connect:async()=>{throw new Error("unreachable");},ping:async()=>"PONG"}),/unreachable/);
});
