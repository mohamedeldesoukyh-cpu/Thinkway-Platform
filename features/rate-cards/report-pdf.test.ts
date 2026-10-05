import assert from "node:assert/strict";
import {test} from "node:test";
import {ratePdfBatches} from "./report-pdf";
import {buildRateCardReportHtml} from "./report";
import {fixture} from "./report-test-fixture";

test("large PDF batches retain every numbered page exactly once and preserve links",()=>{
 const doc={...fixture,creators:Array.from({length:269},(_,i)=>({...fixture.creators[0],group:{...fixture.creators[0].group,creator:`Creator ${i+1}`}}))};
 const html=buildRateCardReportHtml(doc,"client-list-by-name");
 const batches=ratePdfBatches(html);
 assert.equal(batches.length,8);
 assert.equal(batches.reduce((sum,b)=>sum+(b.match(/<section class="page(?: [^"]*)?">/g)?.length??0),0),47);
 assert.equal(batches.reduce((sum,b)=>sum+(b.match(/<article class="creator-card">/g)?.length??0),0),269);
 for(const [i,batch] of batches.entries()){
  assert.ok((batch.match(/<section class="page(?: [^"]*)?">/g)?.length??0)<=6);
  assert.match(batch,/data-creator-list-ready/);
  assert.match(batch,/href="https:\/\/www.instagram.com\/creator\//);
  assert.ok(batch.includes(`<span>${i*6+1} / 47</span>`));
 }
 assert.equal(batches.filter(b=>b.includes('class="page page--cov"')).length,1);
 assert.equal(batches.filter(b=>b.includes('class="page page--end"')).length,1);
 assert.throws(()=>ratePdfBatches(html,0));
});
