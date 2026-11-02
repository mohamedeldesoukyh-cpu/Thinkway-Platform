import assert from "node:assert/strict";
import { test } from "node:test";
import { createQuotationRateLoader } from "./quotation-display-rate";

test("rates are shared in flight and cached by currency and issue date", async () => {
 let calls=0; let time=0;
 const loader=createQuotationRateLoader(async(input)=>{
  calls++; const params=new URL(String(input),"https://example.test").searchParams;
  return Response.json({currency:params.get("currency"),asOf:params.get("asOf"),rate:15.5});
 },()=>time);
 const first=loader("AED","2026-10-29");
 assert.equal(first,loader("AED","2026-10-29"));
 assert.equal((await first).rate,15.5);
 await loader("AED","2026-10-29"); assert.equal(calls,1);
 await loader("AED","2026-10-30"); assert.equal(calls,2);
 await loader("USD","2026-10-29"); assert.equal(calls,3);
 time=60001; await loader("AED","2026-10-29"); assert.equal(calls,4);
});
test("EGP never needs a network lookup",async()=>{
 const loader=createQuotationRateLoader(async()=>{throw Error("Unexpected fetch");});
 assert.equal((await loader("EGP")).rate,1);
});
test("failed or invalid rates are not cached and can be retried",async()=>{
 let calls=0;
 const loader=createQuotationRateLoader(async()=>Response.json({currency:"AED",asOf:null,rate:++calls===1?0:15.5}));
 await assert.rejects(loader("AED"));
 assert.equal((await loader("AED")).rate,15.5);
 assert.equal(calls,2);
});
test("a mismatched currency or date is rejected",async()=>{
 const loader=createQuotationRateLoader(async()=>Response.json({currency:"USD",asOf:null,rate:52}));
 await assert.rejects(loader("AED"));
});
