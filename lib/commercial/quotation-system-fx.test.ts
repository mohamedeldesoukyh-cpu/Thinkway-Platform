import test from "node:test";
import assert from "node:assert/strict";
import { needsQuotationSystemFx } from "./quotation-system-fx";
test("USD identity placeholders must resolve the system rate",()=>{
 for(const rate of [undefined,null,0,-1,NaN,1]) assert.equal(needsQuotationSystemFx("USD",rate),true);
});
test("valid foreign rates below one and EGP identity do not refresh",()=>{
 for(const rate of [0.12,52.2151,150]) assert.equal(needsQuotationSystemFx("USD",rate),false);
 assert.equal(needsQuotationSystemFx("EGP",1),false);
});
