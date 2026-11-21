import { test } from 'node:test';
import assert from 'node:assert/strict';
import { invoicePreview } from './invoice-model';
const source={number:'DEV-TEST',date:'2026-01-01',currency:'EGP',net:'100.05',vat:'14.01',total:'114.06'};
test('invoice preview balances exact cents with customer debit and revenue/VAT credits',()=>{
 assert.deepEqual(invoicePreview(source,'121001','411001','231001'),[
 {account:'121001',debit:'114.06',credit:'0.00'},{account:'411001',debit:'0.00',credit:'100.05'},{account:'231001',debit:'0.00',credit:'14.01'}]);
});
test('zero VAT creates no empty journal line and inconsistent totals fail closed',()=>{
 assert.equal(invoicePreview({...source,vat:'0.00',total:'100.05'},'121001','411001','').length,2);
 assert.throws(()=>invoicePreview({...source,total:'114.05'},'121001','411001','231001'),/reconcile/);
 assert.throws(()=>invoicePreview({...source,net:'-1.00'},'121001','411001','231001'));
});
