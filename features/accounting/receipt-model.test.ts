import test from 'node:test';
import assert from 'node:assert/strict';
import { receiptPreview,type ReceiptQuote } from './receipt-model';
import { totals } from './journal-model';
const quote:ReceiptQuote={currency:'USD',base:'EGP',rate:'51',date:'2026-02-01',amount:'20',cash:'1020.00',receivable:'1002.47',gain:'17.53',account:'121001',invoiceVersion:2,settled:'0',settledBase:'0',minPostingDate:'2026-01-15'};
test('FX receipt balances base and foreign amounts without inventing foreign FX gain',()=>{
 const lines=receiptPreview(quote,'111001','712001','722001');
 assert.equal(totals(lines).difference,BigInt(0));assert.equal(lines[2].credit,'17.53');assert.equal(lines[2].foreignCredit,null);
 assert.equal(totals(lines.map(l=>({debit:l.foreignDebit??'0',credit:l.foreignCredit??'0'}))).difference,BigInt(0));
});
test('Lower receipt rate debits realized exchange loss',()=>{
 const lines=receiptPreview({...quote,cash:'980.00'},'111001','712001','722001');
 assert.equal(lines[2].account,'722001');assert.equal(lines[2].debit,'22.47');assert.equal(totals(lines).difference,BigInt(0));
});
test('Equal carrying and cash amounts need only two lines',()=>{
 const lines=receiptPreview({...quote,cash:'1002.47'},'111001','712001','722001');assert.equal(lines.length,2);assert.equal(totals(lines).difference,BigInt(0));
});
