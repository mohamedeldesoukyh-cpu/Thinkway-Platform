import test from 'node:test';
import assert from 'node:assert/strict';
import {statementDocument,statementDocumentHtml,statementType,statementTrx} from './statement-document';
import type {Statement,StatementRow} from './statement-model';
const row=(v:Partial<StatementRow>):StatementRow=>({id:'a',line:1,account:'121001',name:'Receivables',auxiliary:'Client <one>',date:'2026-11-01',number:'JV-2026-000001',reference:'Reference',description:'حملة إعلانية & details',party:'C1',currency:'USD',report_currency:'EGP',debit:'100',credit:'0',foreign_debit:'2',foreign_credit:'0',balance:'100',...v});
export const fixture:Statement={currency:'EGP',count:3,accounts:[{account:'121001',name:'Receivables',currency:'EGP',opening:'10',debit:'100',credit:'20',closing:'90'},{account:'122001',name:'Other receivables',currency:'EGP',opening:'5',debit:'7',credit:'0',closing:'12'}],rows:[row({transaction_type:'invoice',document_number:'SI-001'}),row({id:'c',account:'122001',name:'Other receivables',date:'2026-11-03',debit:'7',balance:'12'}),row({id:'b',date:'2026-11-02',transaction_type:'receipt',document_number:'RC-001',debit:'0',credit:'20',foreign_debit:'0',foreign_credit:'0.4',balance:'90'})]};
const options={title:'Statement of Account',company:'Thinkway',from:'2026-01-01',to:'2026-11-24',dateBasis:'Journal date',party:'Client <one>',kind:'client',consolidate:false,details:true};
test('all statement sections use portrait, retain source and JV references, and escape content',()=>{
 const report=statementDocument(fixture,options);assert.equal(report.sections.length,2);assert.ok(report.sections.every(s=>s.orientation==='portrait'));
 assert.match(report.sections[0].rows[0][1],/SI-001\nJV-2026-000001/);assert.equal(report.sections[0].rows[1][2],'RC');
 const html=statementDocumentHtml(report);assert.match(html,/size:A4 portrait/);assert.match(html,/Client &lt;one&gt;/);assert.match(html,/حملة إعلانية &amp; details/);assert.match(html,/TRX/);assert.match(html,/data-statement-ready/);
});
test('consolidated running balance follows chronological entries across accounts exactly',()=>{
 const report=statementDocument(fixture,{...options,consolidate:true});assert.deepEqual(report.sections[0].rows.map(r=>r.at(-1)),['115.00','95.00','102.00']);assert.equal(report.sections[0].statement?.closing,'102.00');
});
test('transaction labels do not relabel journal numbers; foreign amounts are not invented',()=>{
 assert.equal(statementType(row({transaction_type:'payment',reversed:true})),'PY · Reversal');
 assert.equal(statementType(row({transaction_type:'journal'})),'JV');
 assert.match(statementTrx(row({})),/USD\n2.00 Dr/);
 assert.equal(statementTrx(row({foreign_debit:null,foreign_credit:null})),'USD · Amount unavailable');
});
test('summary statements use the same portrait template and keep currencies separate',()=>{
 const s={...fixture,accounts:[...fixture.accounts,{...fixture.accounts[0],currency:'USD',opening:'0',debit:'2',credit:'0',closing:'2'}]};
 const report=statementDocument(s,{...options,details:false});assert.equal(report.sections.length,3);assert.ok(report.sections.every(s=>s.orientation==='portrait'));assert.equal(report.sections[2].statement?.currency,'USD');
});
