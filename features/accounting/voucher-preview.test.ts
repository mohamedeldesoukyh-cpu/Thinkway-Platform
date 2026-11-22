import {test} from 'node:test';
import assert from 'node:assert/strict';
import {voucherReport,type PrintVoucher} from './voucher-preview';
const voucher:PrintVoucher={company:'Isolated',title:'Journal voucher',number:'1',date:'2026-11-22',reference:'',base:'EGP',currency:'EGP',amount:'100',rates:{USD:'50'},lines:[{account:'111001',description:'Bank',currency:'EGP',foreignDebit:'100',foreignCredit:'0',debit:'100',credit:'0'}]};
test('EGP journal has one EGP debit/credit pair and dated USD equivalents',()=>{
 const page=voucherReport(voucher).sections[0];
 assert.deepEqual(page.columns,['Account','Description','Currency','Debit EGP','Credit EGP','Debit USD','Credit USD']);
 assert.deepEqual(page.rows[0].slice(-2),['2.00','0.00']);assert.equal(page.orientation,'landscape');
});
test('foreign journal uses its actual currency name and booked local amounts',()=>{
 const page=voucherReport({...voucher,currency:'AED',lines:[{...voucher.lines[0],currency:'AED',debit:'1300'}]}).sections[0];
 assert.deepEqual(page.columns.slice(3),['Debit AED','Credit AED','Debit EGP','Credit EGP']);
 assert.deepEqual(page.rows[0].slice(-2),['1300','0']);
});
test('missing reporting rate cannot invent a USD equivalent',()=>{
 assert.equal(voucherReport({...voucher,rates:{}}).sections[0].rows[0][5],'Rate required');
});
test('payments and refunds retain a portrait document followed by landscape journal',()=>{
 for(const title of ['Receipt','Payment','Receipt refund','Payment refund']){
  const report=voucherReport({...voucher,title,amount:'-100'});
  assert.deepEqual(report.sections.map(p=>p.orientation),['portrait','landscape']);
  assert.ok(report.sections[0].heading.includes('-100.00'));
 }
});
