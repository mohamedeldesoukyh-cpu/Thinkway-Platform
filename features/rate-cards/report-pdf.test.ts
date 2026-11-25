import assert from "node:assert/strict";
import {test} from "node:test";
import {ratePdfBatches,renderRateCardPdf} from "./report-pdf";
import {PDFDocument} from "pdf-lib";
import type {HtmlToPdfOptions} from "@/lib/io/vendor-io-pdf";
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

test("crashed batches split without losing or duplicating pages",async()=>{
 const html='<html><body>'+[1,2,3,4,5].map(n=>`<section class="page">${n}</section>`).join('')+'<script></script></body></html>';
 const calls:number[][]=[];
 const result=await renderRateCardPdf(html,{} as HtmlToPdfOptions,async batch=>{
  const ids=[...batch.matchAll(/class="page">(\d+)/g)].map(m=>Number(m[1]));calls.push(ids);
  if(ids.length>2)return {ok:false,error:'Protocol error (Page.setDocumentContent): Target closed'};
  const pdf=await PDFDocument.create();
  for(const n of ids)pdf.addPage([100+n,200]);
  return {ok:true,buffer:Buffer.from(await pdf.save())};
 });
 assert.deepEqual(calls,[[1,2,3,4,5],[1,2,3],[1,2],[3],[4,5]]);
 assert.deepEqual((await PDFDocument.load(result)).getPages().map(p=>p.getWidth()),[101,102,103,104,105]);
});

test("does not retry ordinary errors or loop on a crashed single page",async()=>{
 for(const error of ['Timeout exceeded','Target closed']){
  let calls=0;
  await assert.rejects(renderRateCardPdf('<html><body><section class="page">1</section><script></script></body></html>',{} as HtmlToPdfOptions,async()=>{calls++;return {ok:false,error};}),/Report PDF render failed/);
  assert.equal(calls,1);
 }
});
