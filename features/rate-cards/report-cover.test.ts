import assert from "node:assert/strict";
import {test} from "node:test";
import {buildRateCardReportHtml,rateCardAgencyFeeSummary} from "./report";
import {fixture} from "./report-test-fixture";

test("rate-card cover uses one display name and shows saved client agency fees",()=>{
 const doc={...fixture,client:"National Bank of Egypt (Egypt) S.A.E",brand:"National Bank of Egypt (NBE)"};
 for(const template of ["creator-list","creator-list-details","client-list-by-name"] as const){
  const html=buildRateCardReportHtml(doc,template);
  const cover=html.split('<section class="page">')[0];
  assert.match(cover,/<h1 dir="auto">National Bank of Egypt \(NBE\)<\/h1>/);
  assert.ok(!cover.includes(doc.client));
  assert.equal(cover.includes('class="rate-cover-fees"'),template!=="client-list-by-name");
  if(template!=="client-list-by-name")assert.match(cover,/Client Agency fees<\/strong><span>10%<\/span>/);
 }
});

test("fee summaries distinguish zero, varied and missing fees",()=>{
 const doc=structuredClone(fixture);
 doc.creators=doc.creators.slice(0,1);
 doc.creators[0].rates=doc.creators[0].rates.slice(0,2);
 for(const rate of doc.creators[0].rates)rate.agency_fee_percent=0;
 assert.equal(rateCardAgencyFeeSummary(doc),"0%");
 doc.creators[0].rates[1].agency_fee_percent=10;
 assert.equal(rateCardAgencyFeeSummary(doc),"0% / 10% · varies by item");
 doc.creators[0].rates[1].agency_fee_percent=null;
 assert.equal(rateCardAgencyFeeSummary(doc),"0% · some items not specified");
 doc.creators[0].rates[0].agency_fee_percent=null;
 assert.equal(rateCardAgencyFeeSummary(doc),"Not specified");
});

test("uploaded client logo is embedded on the cover and creator-page headers",()=>{
 const clientLogo="data:image/png;base64,Y2xpZW50LWxvZ28=";
 const html=buildRateCardReportHtml({...fixture,clientLogo},"creator-list");
 assert.match(html,/class="cov__client" data-logo-slot><img/);
 assert.equal((html.match(/class="report-client-logo"/g)??[]).length,2);
 assert.equal(html.split(clientLogo).length-1,3);
 const noLogo=buildRateCardReportHtml(fixture,"creator-list");
 assert.ok(!noLogo.includes('class="report-client-logo"'));
});
