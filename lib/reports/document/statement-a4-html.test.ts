import assert from 'node:assert/strict';
import { test } from 'node:test';
import { statementCurrencyModel, renderStatementHtml } from './statement-a4-html';
import type { StatementsReportData, StatementLedgerLine } from '../statements/statement-types';
const line=(date:string,debit:number,credit=0,currency='EGP'):StatementLedgerLine=>({date,debit,credit,currency,balance:0,document_number:'INV-2026-00001',campaign_name:'Campaign',kind:credit?'payment':'invoice'});
const report=(lines:StatementLedgerLine[],patch:Partial<StatementsReportData>={}):StatementsReportData=>({type:'client',entity_id:'id',entity_name:'Client <script>',entity_code:'CLT-000004',group_name:null,from_date:'2026-04-01',to_date:'2026-04-30',currency:'EGP',currency_context:{} as StatementsReportData['currency_context'],lines,history_lines:lines,totals:{total_debit:0,total_credit:0,closing_balance:0},clients:[],vendors:[],...patch});
test('opening balance, period-only totals and closing use integer minor units',()=>{
 const m=statementCurrencyModel(report([line('2026-03-01',100.10),line('2026-04-01',20.20),line('2026-04-02',0,30.30),line('2026-05-01',200)]),'EGP');
 assert.deepEqual([m.opening,m.debit,m.credit,m.balance],[10010,2020,3030,9000]);
 assert.equal(m.aging.reduce((a,b)=>a+b,0)-m.unapplied,m.balance);
});
test('empty period retains opening, credit balances and currencies remain separate',()=>{
 const r=report([line('2026-03-01',0,20),line('2026-03-01',900,0,'USD')]);
 const m=statementCurrencyModel(r,'EGP');assert.equal(m.rows.length,0);assert.equal(m.balance,-2000);assert.equal(m.unapplied,2000);assert.equal(statementCurrencyModel(r,'USD').balance,90000);
});
test('vendor credit invoices raise balance and payment debits reduce it',()=>{
 const m=statementCurrencyModel(report([line('2026-04-01',0,100),line('2026-04-02',25)],{type:'vendor'}),'EGP');assert.equal(m.balance,7500);
});
test('due-date aging and escaped display-only client references',()=>{
 const r=report([{...line('2026-04-01',100),due_date:'2026-05-01'}]);const m=statementCurrencyModel(r,'EGP');assert.equal(m.dueBased,true);assert.equal(m.aging[0],10000);
 const html=renderStatementHtml(r);assert.ok(html.includes('CLT-4'));assert.ok(!html.includes('CLT-000004'));assert.ok(html.includes('Client &lt;script&gt;'));assert.ok(html.includes('Download PDF'));assert.ok(html.includes('@page{size:A4'));assert.equal(r.entity_code,'CLT-000004');
});
