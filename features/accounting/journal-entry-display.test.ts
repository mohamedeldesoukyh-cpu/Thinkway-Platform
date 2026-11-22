import test from 'node:test';
import assert from 'node:assert/strict';
import { amountPatch, balancingSuggestion, entryAmount, entrySide, reportingAmount } from './journal-entry-display';
const line = {account:'111001',description:'',debit:'5000.00',credit:'0',lineCurrency:'USD',foreignDebit:'100.00',foreignCredit:'0'};
test('single amount moves between debit and credit without retaining both sides',()=>{
 const credit = {...line,...amountPatch('C',entryAmount(line))};
 assert.equal(entrySide(credit),'C'); assert.equal(credit.foreignDebit,'0'); assert.equal(credit.foreignCredit,'100.00');
 assert.equal(entrySide({...line,...amountPatch('C','0')}),'C');
 assert.equal(entryAmount({...line,...amountPatch('D','12.34')}),'12.34');
});
test('new line balances prior debit or credit in the same currency without overwriting input',()=>{
 const empty={account:'112001',description:'',debit:'0',credit:'0'};
 assert.equal(entrySide(empty),'D');
 assert.deepEqual(balancingSuggestion([line,empty],1,'EGP',{USD:'50'}),{side:'C',autoBalance:true,foreignDebit:'0',foreignCredit:'100.00',lineCurrency:'USD'});
 const credit={...line,debit:'0',credit:'5000.00',foreignDebit:'0',foreignCredit:'100'};
 assert.equal(balancingSuggestion([credit,empty],1,'EGP',{USD:'50'})?.side,'D');
 assert.equal(balancingSuggestion([line,{...empty,foreignDebit:'10'}],1,'EGP',{USD:'50'}),null);
 assert.equal(balancingSuggestion([line,{...empty,side:'D'}],1,'EGP',{USD:'50'}),null);
 assert.equal(balancingSuggestion([line,empty],1,'EGP',{}),null);
 assert.equal(balancingSuggestion([line,empty],0,'EGP',{USD:'50'}),null);
});
test('suggested second line follows first-line side and amount until manually overridden',()=>{
 const automatic={account:'112001',description:'',debit:'0',credit:'5000',...balancingSuggestion([line,{account:'112001',description:'',debit:'0',credit:'0'}],1,'EGP',{USD:'50'})};
 const credit={...line,debit:'0',credit:'7500',...amountPatch('C','150')};
 const next=balancingSuggestion([credit,automatic],1,'EGP',{USD:'50'});
 assert.equal(next?.side,'D'); assert.equal(next?.foreignDebit,'150.00'); assert.equal(next?.foreignCredit,'0');
 assert.equal(balancingSuggestion([credit,{...automatic,...amountPatch('C','80')}],1,'EGP',{USD:'50'}),null);
});
test('third line debits the sum of two manual credits and balances mixed prior lines',()=>{
 const first={account:'111001',description:'',debit:'0',credit:'100',...amountPatch('C','100')};
 const second={account:'112001',description:'',debit:'0',credit:'50',...amountPatch('C','50')};
 const third={account:'112002',description:'',debit:'0',credit:'0'};
 const result=balancingSuggestion([first,second,third],2,'EGP',{});
 assert.equal(result?.side,'D'); assert.equal(result?.foreignDebit,'150.00');
 const mixed={...second,debit:'40',credit:'0',...amountPatch('D','40')};
 assert.equal(balancingSuggestion([first,mixed,third],2,'EGP',{})?.foreignDebit,'60.00');
});
test('reporting columns preserve stored LC and original USD amounts',()=>{
 assert.equal(reportingAmount(line,'EGP','EGP',{USD:'51'}),'5000.00');
 assert.equal(reportingAmount(line,'USD','EGP',{USD:'51'}),'100.00');
 const egp={...line,lineCurrency:'EGP',foreignDebit:'5000.00'};
 assert.equal(reportingAmount(egp,'USD','EGP',{USD:'50'}),'100.00');
 assert.equal(reportingAmount(egp,'USD','EGP',{}),'Rate required');
 assert.equal(reportingAmount(egp,'USD','EGP',{USD:'0'}),'Rate required');
 assert.equal(reportingAmount({...egp,debit:'1'},'USD','EGP',{USD:'3'}),'0.33');
});
