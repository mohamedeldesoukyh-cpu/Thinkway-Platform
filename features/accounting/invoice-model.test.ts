import { test } from 'node:test';
import assert from 'node:assert/strict';
import { invoicePreview,convertInvoiceAmount,localInvoicePreview } from './invoice-model';
const source={number:'DEV-TEST',date:'2026-01-01',currency:'EGP',net:'100.05',vat:'14.01',total:'114.06'};
test('invoice preview balances exact cents with customer debit and revenue/VAT credits',()=>{
 assert.deepEqual(invoicePreview(source,'121001','411001','231001'),[
 {account:'121001',debit:'114.06',credit:'0.00'},{account:'411001',debit:'0.00',credit:'100.05'},{account:'231001',debit:'0.00',credit:'14.01'}]);
});
test('FX conversion rounds component credits and derives a balanced local receivable',()=>{
 assert.equal(convertInvoiceAmount('100.05','50.12345678'),'5014.85');
 const result=localInvoicePreview({...source,net:'0.01',vat:'0.01',total:'0.02'},'1.5','121001','411001','231001');
 assert.equal(result[0].debit,'0.04');
 assert.equal(result[1].credit,'0.02');
 assert.equal(result[2].credit,'0.02');
 assert.equal(convertInvoiceAmount('999999999999.99','1.00000001'),'1000000009999.99');
 for(const rate of ['0','-1','1e2','NaN'])assert.throws(()=>convertInvoiceAmount('1',rate));
 assert.throws(()=>localInvoicePreview({...source,net:'0.01',vat:'0',total:'0.01'},'0.01','121001','411001','231001'),/below/);
});
test('zero VAT creates no empty journal line and inconsistent totals fail closed',()=>{
 assert.equal(invoicePreview({...source,vat:'0.00',total:'100.05'},'121001','411001','').length,2);
 assert.throws(()=>invoicePreview({...source,total:'114.05'},'121001','411001','231001'),/reconcile/);
 assert.throws(()=>invoicePreview({...source,net:'-1.00'},'121001','411001','231001'));
});
