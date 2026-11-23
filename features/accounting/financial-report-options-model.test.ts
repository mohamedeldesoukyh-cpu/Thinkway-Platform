import test from 'node:test';
import assert from 'node:assert/strict';
import {financialReportSections,type FinancialSource} from './financial-report-options-model';
import {CHART} from './chart';
const source:FinancialSource={currency:'EGP',accounts:[{account:'112001',name:'Bank',currency:'EGP',opening:'100',debit:'200',credit:'0',closing:'300'},{account:'411001',name:'Revenue',currency:'EGP',opening:'-100',debit:'0',credit:'200',closing:'-300'}],auxiliaries:[{id:'a',name:'1 · Bank A',account:'112001',currency:'EGP',opening:'40',debit:'120',credit:'0',closing:'160'},{id:'b',name:'2 · Bank B',account:'112001',currency:'EGP',opening:'60',debit:'80',credit:'0',closing:'140'}]};
test('large balances and negative equity render without parsing formatted money',()=>{
 const s:FinancialSource={currency:'EGP',auxiliaries:[],accounts:[
  {account:'112001',name:'Bank',currency:'EGP',opening:'0',debit:'1234567.89',credit:'0',closing:'1234567.89'},
  {account:'411001',name:'Revenue',currency:'EGP',opening:'0',debit:'0',credit:'1234567.89',closing:'-1234567.89'},
 ]};
 for(const detailed of [false,true])for(const mode of ['trial','profit','balance'] as const){
  const report=financialReportSections(s,CHART,mode,detailed,true,true)[0];
  assert.ok(report.rows.some(row=>row.includes('1,234,567.89')));
  if(mode==='balance')assert.equal(report.rows.at(-1)?.at(-1),'0.00');
 }
});
test('P&L uses period movement while balance sheet includes accumulated earnings',()=>{const p=financialReportSections(source,CHART,'profit',false,false)[0];assert.equal(p.rows.at(-1)?.at(-1),'200.00');assert.equal(p.rows[0][0],'410000');const b=financialReportSections(source,CHART,'balance',false,false)[0];assert.equal(b.rows.find(r=>r[1]==='Unclosed earnings')?.at(-1),'300.00');assert.equal(b.rows.at(-1)?.at(-1),'0.00');});
test('Auxiliary detail reconciles to its GL without adding twice to financial totals',()=>{const b=financialReportSections(source,CHART,'balance',true,true)[0];assert.equal(b.rows.find(r=>r[1]==='Total assets')?.at(-1),'300.00');assert.equal(b.rows.filter(r=>r[2]==='Auxiliary detail').length,2);assert.equal(b.rows.find(r=>r[1]==='1 · Bank A')?.at(-1),'160.00');const t=financialReportSections(source,CHART,'trial',true,true)[0];assert.deepEqual(t.rows.at(-1),['','Total','0.00','200.00','200.00','0.00','300.00','300.00']);});
test('Foreign currency financial reports never consolidate distinct currencies',()=>{const s={...source,accounts:[...source.accounts,{...source.accounts[0],currency:'USD',opening:'1',debit:'2',closing:'3'}]};const pages=financialReportSections(s,CHART,'balance',true,false);assert.equal(pages.length,2);assert.match(pages[1].heading,/USD/);assert.equal(pages[1].rows.find(r=>r[1]==='Total assets')?.at(-1),'3.00');});

test('trial splits closing balances into Debtor and Creditor without netting totals',()=>{for(const detail of [false,true]){const t=financialReportSections(source,CHART,'trial',detail,false)[0];assert.deepEqual(t.columns.slice(-2),['Debtor','Creditor']);assert.deepEqual(t.rows[0].slice(-2),['300.00','0.00']);assert.deepEqual(t.rows[1].slice(-2),['0.00','300.00']);assert.deepEqual(t.rows.at(-1)?.slice(-2),['300.00','300.00']);}});

test('Third Parties and own auxiliaries are independently selected without double-counting',()=>{
 const s:FinancialSource={...source,accounts:[...source.accounts,{account:'121001',name:'Receivables',currency:'EGP',opening:'0',debit:'50',credit:'0',closing:'50'}],auxiliaries:[...source.auxiliaries,{id:'client',name:'Shared client',account:'121001',currency:'EGP',opening:'0',debit:'50',credit:'0',closing:'50'}]};
 for(const mode of ['trial','profit','balance'] as const){
 const own=financialReportSections(s,CHART,mode,true,true,false)[0];assert.ok(!own.rows.some(r=>r[1]==='Shared client'));
 const parties=financialReportSections(s,CHART,mode,true,false,true)[0];if(mode!=='profit')assert.ok(parties.rows.some(r=>r[1]==='Shared client'));assert.ok(!parties.rows.some(r=>r[1]==='1 · Bank A'));
 }
 assert.equal(financialReportSections(s,CHART,'trial',true,true,true)[0].rows.at(-1)?.[6],'350.00');
});
