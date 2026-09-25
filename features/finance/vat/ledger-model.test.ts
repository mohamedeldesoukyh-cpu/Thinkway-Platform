import assert from 'node:assert/strict';import test from 'node:test';import {accumulatedVatMonths,vatInvoiceEligibility,vatMonths,type VatLedger} from './ledger-model';
const entry={id:'i',date:'2026-01-12',name:'Client',invoice:'INV',country:'EG',currency:'EGP',vatIn:140,vatOut:0,source:'Invoice'};
const payment={id:'p',period:'2026-01-01',country_code:'EG',currency:'EGP',amount:120,paid_at:'2026-02-03',method:'wire',reference:'ref',authority:'Tax',notes:null};
test('VAT keeps months, currencies and countries separate and subtracts payments once',()=>{const data:VatLedger={entries:[entry,{...entry,id:'s',vatIn:0,vatOut:20},{...entry,id:'usd',currency:'USD',vatIn:50},{...entry,id:'feb',date:'2026-02-01',vatIn:10}],payments:[payment],provisional:[{currency:'EGP',amount:999}]};const rows=vatMonths(data);const jan=rows.find(r=>r.period==='2026-01'&&r.currency==='EGP')!;assert.equal(jan.balance,120);assert.equal(jan.payable,0);assert.equal(jan.paid,120);assert.equal(rows.find(r=>r.currency==='USD')?.payable,50);assert.equal(rows.find(r=>r.period==='2026-02')?.payable,10);});
test('partial settlement leaves payable, excess becomes credit, without changing tax month',()=>{const data:VatLedger={entries:[entry],payments:[{...payment,amount:40}],provisional:[]};assert.equal(vatMonths(data)[0].payable,100);data.payments[0].amount=200;assert.equal(vatMonths(data)[0].payable,0);assert.equal(vatMonths(data)[0].credit,60);});
test('excluded and unreviewed invoices do not inflate payable balances',()=>{const data:VatLedger={entries:[entry,{...entry,id:'draft',included:false,vatIn:1000},{...entry,id:'unreviewed',included:false,vatIn:0,vatOut:900},{...entry,id:'undated',date:'',vatIn:300}],payments:[],provisional:[]};assert.equal(data.entries.length,4);assert.equal(vatMonths(data).length,1);assert.equal(vatMonths(data)[0].payable,140);});

test('active generated invoice 2 is Issued and included despite legacy draft status',()=>{const eligibility=vatInvoiceEligibility({status:'draft',regeneration_status:'active',issue_date:'2026-08-12'});assert.deepEqual(eligibility,{included:true,status:'Issued'});const rows=vatMonths({entries:[{...entry,...eligibility,date:'2026-08-12',vatIn:123678.45}],payments:[],provisional:[]});assert.equal(rows[0].payable,123678.45);});
test('VAT follows register lifecycle exclusions and requires an invoice date',()=>{for(const input of [{status:'void',issue_date:'2026-08-12'},{status:'draft',regeneration_status:'regenerated',issue_date:'2026-08-12'},{status:'sent',regeneration_status:'pending_regeneration',issue_date:'2026-08-12'},{status:'draft',regeneration_status:'active',issue_date:null}])assert.equal(vatInvoiceEligibility(input).included,false);});


test('accumulated VAT carries the screenshot credit into later months', () => {
 const data: VatLedger = { entries: [
  {...entry,date:'2026-06-01',vatIn:79310},
  {...entry,date:'2026-07-01',vatIn:0,vatOut:44800},
  {...entry,date:'2026-08-01',vatIn:67678.45},
 ], payments: [], provisional: [] };
 const rows=accumulatedVatMonths(data);
 assert.deepEqual(rows.map(r=>r.accumulated),[102188.45,34510,79310]);
 assert.equal(rows[0].payable,102188.45);
 data.payments=[{...payment,period:'2026-08-01',amount:102188.45}];
 assert.equal(accumulatedVatMonths(data)[0].payable,0);
});

test('carry-forward crosses years, handles payment-only months, and isolates countries/currencies',()=>{
 const data:VatLedger={entries:[{...entry,date:'2025-12-01',vatIn:100},{...entry,date:'2026-02-01',vatIn:50},{...entry,currency:'USD',vatIn:30},{...entry,country:'AE',vatIn:40},{...entry,included:false,vatIn:999}],payments:[{...payment,amount:120}],provisional:[]};
 const rows=accumulatedVatMonths(data);
 assert.equal(rows.find(r=>r.period==='2026-01'&&r.country==='EG'&&r.currency==='EGP')?.credit,20);
 assert.equal(rows.find(r=>r.period==='2026-02')?.payable,30);
 assert.equal(rows.find(r=>r.currency==='USD')?.payable,30);
 assert.equal(rows.find(r=>r.country==='AE')?.payable,40);
});
