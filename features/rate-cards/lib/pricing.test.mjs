import * as P from './pricing.js';
let fail=0;
const eq=(a,b,m)=>{const ok=JSON.stringify(a)===JSON.stringify(b);
  console.log((ok?'  PASS  ':'  FAIL  ')+m+(ok?'':`  got ${JSON.stringify(a)} want ${JSON.stringify(b)}`));
  if(!ok)fail++;};
const M=(a,c='EGP')=>({amount:a,currency:c});

console.log('-- the brief\'s worked example --');
eq(+P.grossProfitPct(M(7500),M(9750)).toFixed(2),23.08,'GP of 7,500 -> 9,750 is 23.08%');
eq(+P.markupPct(M(7500),M(9750)).toFixed(2),30.00,'Markup of 7,500 -> 9,750 is 30.00%');

console.log('-- missing vs zero vs incomparable --');
eq(P.isMissing(M(null)),true,'null amount is missing');
eq(P.isMissing(M(0)),false,'zero is NOT missing');
eq(P.isZero(M(0)),true,'zero is recognised as a real price');
eq(P.grossProfitPct(M(7500),M(0)),null,'GP is null when client price is 0 (no divide by zero)');
eq(P.markupPct(M(0),M(9750)),null,'Markup is null when cost is 0');
eq(P.grossProfitPct(M(7500),M(null)),null,'GP is null when a price is missing');
eq(P.incomparableReason(M(7500),M(0)),'Client price is zero','reason is explained, not guessed');

console.log('-- currencies never converted --');
eq(P.grossProfitPct(M(7500,'EGP'),M(620,'USD')),null,'no GP across EGP/USD');
eq(P.markupPct(M(7500,'EGP'),M(620,'USD')),null,'no markup across EGP/USD');
eq(P.incomparableReason(M(7500,'EGP'),M(620,'USD')),'Currencies differ','reason names the mismatch');
eq(P.isPriced({amount:100,currency:null}),false,'an amount without a currency is not usable');

console.log('-- periodic services --');
eq(P.periodicTotal(M(2200),12),{amount:26400,currency:'EGP'},'12 months x 2,200 = 26,400');
eq(P.effectiveEventDays(null),1,'blank event days defaults to 1');
eq(P.effectiveEventDays(3),3,'explicit event days kept');
eq(P.quantitiesDiffer({creatorQty:12,clientQty:6}),true,'differing durations are detected');
eq(P.periodicTotal(M(null),12).amount,null,'missing rate gives a missing total, not 0');

console.log('-- agency fees stay distinct --');
eq(P.agencyFeeSummary([10,10,10]),{uniform:true,value:10,values:[10]},'uniform fee collapses');
eq(P.agencyFeeSummary([10,7.5,12]).uniform,false,'differing fees are NOT blended');
eq(P.agencyFeeSummary([10,7.5,12]).values,[7.5,10,12],'all distinct fees reported');
eq(P.isValidAgencyFee(101),false,'fee above 100 rejected');
eq(P.isValidAgencyFee(null),true,'absent fee allowed');

console.log('-- travel uplifts --');
eq(P.mergeUplifts({tuA:30,tuB:50,itu:100},{tuA:40}),{tuA:40,tuB:50,itu:100},'only the supplied field changes');
eq(P.mergeUplifts({tuA:30,tuB:50,itu:100},{tuB:null}),{tuA:30,tuB:50,itu:100},'blank PRESERVES the existing value');
eq(P.isValidUplift(150),true,'uplift may exceed 100%');
eq(P.isValidUplift(-1),false,'negative uplift rejected');

console.log('-- bulk pricing --');
eq(Math.round(P.priceFromTargetGp(M(7500),35).amount),11538,'target GP 35% on 7,500 -> 11,538');
eq(P.priceFromTargetGp(M(7500),100).amount,null,'GP of 100% has no solution');
eq(P.priceFromMarkup(M(7500),30).amount,9750,'markup 30% on 7,500 -> 9,750');
const lines=[{id:'a',label:'A',cost:M(7500),price:M(9750)},
             {id:'b',label:'B',cost:M(12000),price:M(null)},
             {id:'c',label:'C',cost:M(null),price:M(null)}];
eq(P.previewBulk(lines,{kind:'targetGp',pct:35},'fillMissing').map(c=>c.lineId),['b','c'],
   'fillMissing skips lines that already have a price');
eq(P.previewBulk(lines,{kind:'targetGp',pct:35},'overwrite').map(c=>c.lineId),['a','b','c'],
   'overwrite touches every line');
eq(P.previewBulk(lines,{kind:'targetGp',pct:35},'overwrite').find(c=>c.lineId==='c').skipped,
   'No creator cost to calculate from','a line with no cost is reported, not silently dropped');
eq(P.previewBulk(lines,{kind:'feeOnly',agencyFeePct:10},'overwrite').length,0,
   'fee-only changes no prices');
eq(P.previewKey({kind:'targetGp',pct:35},'overwrite')===P.previewKey({kind:'targetGp',pct:40},'overwrite'),
   false,'changing the rule invalidates the preview key');

console.log('-- import rounding --');
eq(P.roundImported(12.3456789),{value:12.3457,rounded:true},'amount rounds to 4dp and flags it');
eq(P.roundImported(12.5),{value:12.5,rounded:false},'already-clean value is not flagged');
eq(P.validateQuantity(2.5,1,365),'Must be a whole number between 1 and 365',
   'fractional quantity is rejected, never rounded');
eq(P.validateQuantity(400,1,365),'Must be between 1 and 365','out-of-range quantity rejected');
eq(P.validateQuantity(12,1,120),null,'valid month count accepted');

console.log('-- formatting --');
eq(P.formatMoney(M(134680)),'134,680','grouped thousands');
eq(P.formatMoney(M(null)),null,'missing formats as null so the UI can say "Not set"');
eq(P.formatMoney(M(0)),'0','zero formats as 0, not blank');
eq(/^[0-9,]+$/.test(P.formatMoney(M(134680),'ar')),true,'Arabic keeps Latin numerals');
eq(P.formatPct(null),'—','null percentage renders as em-dash');

console.log(fail? `\n${fail} FAILURES` : '\nALL PRICING TESTS PASSED');
process.exit(fail?1:0);
