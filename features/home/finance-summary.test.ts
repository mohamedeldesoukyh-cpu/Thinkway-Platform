import test from 'node:test';
import assert from 'node:assert/strict';
import {homeInvoiceBalances,homePoSummary,homeCreatorOutstanding} from './finance-summary';
test('Home AR excludes superseded invoices and ages all overdue balances after currency conversion',()=>{
 const row={status:'paid',regeneration_status:'active',issue_date:'2026-06-01',due_date:'2026-06-30',total:114,amount_paid:114,currency:'EGP'};
 const result=homeInvoiceBalances([row,{...row,status:'draft',total:100,amount_paid:50,currency:'USD',due_date:'2026-09-24'},{...row,status:'void',amount_paid:0},{...row,regeneration_status:'regenerated',amount_paid:0}],(n,c)=>n*(c==='USD'?50:1),'2026-09-25');
 assert.deepEqual(result,{outstanding:2500,overdue:2500,count:1});
});
test('PO usage keeps the budget scope and does not conceal overruns',()=>{
 assert.deepEqual(homePoSummary([{amount:100,consumed:120},{amount:0,consumed:500}]),{total:100,consumed:120,percent:120,missing:1});
});
test('Creator exposure deducts payments and includes VAT while retaining exported reservations as unpaid',()=>{
 assert.equal(homeCreatorOutstanding(228000,'pending',[{status:'paid',cleared_at:null,original_amount:200000}]),28000);
 assert.equal(homeCreatorOutstanding(100,'paid',[]),0);
 assert.equal(homeCreatorOutstanding(100,'pending',[{status:'exported',cleared_at:null,original_amount:80}]),100);
 assert.equal(homeCreatorOutstanding(100,'pending',[{status:'paid',cleared_at:'2026-01-01',original_amount:80}]),100);
});
