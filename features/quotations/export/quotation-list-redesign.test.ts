import assert from 'node:assert/strict';
import {creatorListWholeMoney,creatorListMoney,creatorListViews,creatorListDeliverableChips,buildRedesignedQuotationCreatorList} from './quotation-list-redesign';
import type {QuotationDocument} from './quotation-document';
import {buildQuotationCreatorListHtml,quotationListPdfOptions} from './quotation-creator-list';
import {SHORTLIST_TEMPLATE_OPTIONS,resolveShortlistTemplate} from '@/features/discovery/shortlists/export/shortlist-template';
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
assert.ok(html.includes('title="Test"'), 'Report name normalization removes decorative symbols before HTML escaping');
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
 assert.equal(changed.replace(' class="report--additions"', "").replaceAll("Creator List Additions","Creator List").replaceAll(">Additions<",">Option 2<").replaceAll(">Option 2<",">Opt 2<").replaceAll(">Option 1<",">Opt 1<").replaceAll(">Option 3<",">Opt 3<"), original.replaceAll(">Option 2<",">Opt 2<").replaceAll(">Option 1<",">Opt 1<").replaceAll(">Option 3<",">Opt 3<"), "All layout, content, pricing and fees remain identical except labels and the scoped Additions palette");
 const single={...additions,creatorGroups:[{...group,rows:[{...row,option:"Option 2",serviceDescription:"Option 2 mentioned in description",clientCost:"100 EGP",totalInvestment:"115 EGP",af:"15 EGP"}]}]};
 const singleHtml=buildRedesignedQuotationCreatorList(single);
 assert.ok(singleHtml.includes('>Package</span>'),"Single-option presentation is unchanged");
 assert.ok(singleHtml.includes('Option 2 mentioned in description'),"Deliverable descriptions must not be renamed");
}

assert.ok(!SHORTLIST_TEMPLATE_OPTIONS.some(option => option.id === 'creator-list-additions'), 'Quotation additions must not leak into the separate shortlist export flow');
assert.equal(resolveShortlistTemplate('creator-list-additions'),'detailed');

assert.ok(buildRedesignedQuotationCreatorList({...many, template:"creator-list-additions"}).includes('class="report--additions"'));
assert.ok(!buildRedesignedQuotationCreatorList({...many, template:"creator-list"}).includes('class="report--additions"'));

// Shortlists use the same design and page size without invented commercial offers.
{
 const shortlist = {...doc, source: "shortlist", template: "creator-list", creatorListOrder:["b","a"],
   shortlistCreatorListCost: {amount:12345, currency:"EGP",visible:true},
   creatorGroups: [
    {...group, creator:"Creator Alpha", itemIds:["a"], highestPlatformTier:"Macro", platformMetrics:[{platform:"instagram",followers:"999K",engagement:"2%",views:"50K"}]},
    {...group, creator:"Creator Beta", itemIds:["b"], highestPlatformTier:"Micro", platformMetrics:[]},
   ]} as unknown as QuotationDocument;
 const output=buildRedesignedQuotationCreatorList(shortlist);
 assert.ok(output.includes('class="report--additions report--shortlist"'));
 assert.ok(output.indexOf('title="Creator Beta"') < output.indexOf('title="Creator Alpha"'), "Saved order overrides automatic tier order");
 assert.ok(output.includes('999K'), "Shortlist platform metrics survive without quoted deliverables");
 assert.ok(!output.includes('Rates pending'), "Do not invent quotation prices for shortlists");
 assert.ok(!output.includes('Total average cost · EGP 12,345'));
 assert.ok(output.includes('grid-row:span 4;grid-template-rows:subgrid'));
 const named = {...shortlist,template:'client-list-by-name'} as QuotationDocument;
 assert.ok(buildQuotationCreatorListHtml(named).includes('class="report--additions report--shortlist"'));
 assert.deepEqual(quotationListPdfOptions(named),quotationListPdfOptions(shortlist));
 const multi = {...shortlist,creatorGroups:[{...shortlist.creatorGroups[0],platformMetrics:[{platform:'youtube',followers:'58.1K',engagement:'1.30%',views:'21.7K'},{platform:'facebook',followers:'544.5K',engagement:'1.67%',views:'903.8K'}]}]} as QuotationDocument;
 const metrics = buildQuotationCreatorListHtml(multi);
 assert.ok(!metrics.includes('<span>youtube</span>'));
 assert.ok(!metrics.includes('<span>facebook</span>'));
 assert.ok(metrics.includes('class="aud-e">1.30%'));
 assert.deepEqual(quotationListPdfOptions(shortlist),quotationListPdfOptions({...shortlist,source:"quotation"}));
}

// Recommendation labels are explicit and separate from the creator name.
{
 const recommended = {...doc,source:'shortlist',template:'creator-list',creatorGroups:[{...group,creator:'★ 2 · Creator Alpha'}]} as QuotationDocument;
 for (const template of ['creator-list','client-list-by-name'] as const) {
  const html=buildQuotationCreatorListHtml({...recommended,template});
  assert.ok(html.includes('class="creator-recommendation">★ Recommended · 2</span>'));
  assert.ok(html.includes('title="Creator Alpha">Creator Alpha</h2>'));
  const unstarred=buildQuotationCreatorListHtml({...recommended,template,creatorGroups:[{...group,creator:'Creator Alpha'}]});
  assert.ok(!unstarred.includes('class="creator-recommendation"'));
 }
}

// Only shortlist Client List by Name uses twelve cards (two rows) per page.
{
 const groups = Array.from({length:25},(_,i)=>({...group,creator:'Creator '+i,itemIds:['id-'+i]}));
 const output = buildRedesignedQuotationCreatorList({...doc,source:'shortlist',template:'client-list-by-name',creatorGroups:groups} as QuotationDocument);
 const cardPages = output.split('<section class="page">').slice(1).map(page=>(page.match(/<article class="creator-card">/g)||[]).length).filter(Boolean);
 assert.deepEqual(cardPages,[12,12,1]);
 const original = buildRedesignedQuotationCreatorList({...doc,source:'shortlist',template:'creator-list',creatorGroups:groups} as QuotationDocument);
 assert.deepEqual(original.split('<section class="page">').slice(1).map(page=>(page.match(/<article class="creator-card">/g)||[]).length).filter(Boolean),[6,6,6,6,1]);
}
