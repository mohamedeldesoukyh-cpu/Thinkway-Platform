import assert from 'node:assert/strict';
import {creatorListWholeMoney,creatorListMoney,creatorListViews,creatorListDeliverableChips,buildRedesignedQuotationCreatorList} from './quotation-list-redesign';
import type {QuotationDocument} from './quotation-document';
import {quotationListPdfOptions} from './quotation-creator-list';
assert.deepEqual(creatorListMoney('29,732.78 USD / 1,552,500.08 EGP'),{currency:'EGP',amount:'1,552,500.08',original:'29,732.78 USD'});
assert.equal(creatorListViews('783,981'),'784K');
assert.equal(creatorListViews('3,627,477'),'3.6M');
assert.ok(creatorListDeliverableChips('1× IG Reel + 1× Mirrored TT').includes('chip--tt'));
const row={option:'Option 1',serviceDescription:'—',deliverables:'—',clientCost:'0 EGP',totalInvestment:'0 EGP',af:'0 EGP',afPct:'0%',currency:'EGP',quotedPlatforms:['instagram'],tier:'Mid'};
const group={creator:'<Test>',handle:'@test',profileUrl:'javascript:bad()',avatarUrl:null,categories:['Food'],highestPlatformTier:'Mid',highestPlatformFollowers:0,rows:[row],platformMetrics:[]};
const doc={name:'Campaign',clientName:'Client',serial:'QT-test',issueDateLabel:'15 Oct 2026',hideCostAndFees:false,creatorGroups:Array.from({length:17},()=>group)} as unknown as QuotationDocument;
const html=buildRedesignedQuotationCreatorList(doc);
assert.equal((html.match(/Every creator, side by side/g)||[]).length,2,'Overview pages split at 16 creators');
assert.equal((html.match(/<article class="creator-card">/g)||[]).length,17);
assert.ok(html.includes('Rates pending'));
assert.ok(!html.includes('javascript:'));
assert.ok(html.includes('&lt;Test&gt;'));
assert.ok(!html.includes('>0<small>EGP'));
assert.ok(html.includes('7 / 7'));
const many={...doc,creatorGroups:[{...group,rows:[1,2,3].map(n=>({...row,option:`Option ${n}`,serviceDescription:`Unique deliverable ${n}`,clientCost:'100 EGP',totalInvestment:'115 EGP',af:'15 EGP',afPct:'15%',unitCost:'SECRET_INTERNAL_COST'}))}]} as unknown as QuotationDocument;
const more=buildRedesignedQuotationCreatorList(many);
assert.equal((more.match(/<article class="creator-card">/g)||[]).length,2,'Additional offers have continuation cards');
assert.ok(more.includes('Unique deliverable 3'));
assert.ok(!more.includes('SECRET_INTERNAL_COST'));
console.log('quotation-list-redesign tests passed');

assert.equal(creatorListWholeMoney("749,999.94"), "750,000");
assert.equal(creatorListWholeMoney("112,500.04"), "112,500");
assert.equal(creatorListWholeMoney("25,854.59 USD"), "25,855 USD");

// Additions is a presentation-only variant of the exact same report.
{
 const standard={...many,template:"creator-list"} as QuotationDocument;
 const additions={...many,template:"creator-list-additions"} as QuotationDocument;
 assert.deepEqual(quotationListPdfOptions(additions),quotationListPdfOptions(standard),"PDF dimensions match Creator List");
 const original=buildRedesignedQuotationCreatorList(standard), changed=buildRedesignedQuotationCreatorList(additions);
 assert.ok(changed.includes("Creator List Additions"));
 assert.ok(changed.includes('>Additions</span>'));
 assert.ok(changed.includes('>Option 1</span>'));
 assert.ok(changed.includes('>Option 3</span>'));
 assert.ok(!changed.includes('>Option 2</span>'));
 assert.equal(changed.replaceAll("Creator List Additions","Creator List").replaceAll(">Additions<",">Option 2<").replaceAll(">Option 2<",">Opt 2<").replaceAll(">Option 1<",">Opt 1<").replaceAll(">Option 3<",">Opt 3<"), original.replaceAll(">Option 2<",">Opt 2<").replaceAll(">Option 1<",">Opt 1<").replaceAll(">Option 3<",">Opt 3<"), "All layout, content, pricing and fees remain identical except report/Option 2 labels");
 const single={...additions,creatorGroups:[{...group,rows:[{...row,option:"Option 2",serviceDescription:"Option 2 mentioned in description",clientCost:"100 EGP",totalInvestment:"115 EGP",af:"15 EGP"}]}]};
 const singleHtml=buildRedesignedQuotationCreatorList(single);
 assert.ok(singleHtml.includes('>Package</span>'),"Single-option presentation is unchanged");
 assert.ok(singleHtml.includes('Option 2 mentioned in description'),"Deliverable descriptions must not be renamed");
}
