import test from 'node:test';
import assert from 'node:assert/strict';
import {isLedgerAccount,partyDirectory,lineDetailComplete} from './account-hierarchy';
import {journalLineSchema} from './journal-validation';
import type {SavedAccount} from './setup-types';
const account:SavedAccount={code:'121001',name:'Receivable',nameAr:'',parent:'120000',kind:'Control',subledger:'Customer',type:'Asset',normal:'Debit',active:true,version:1};
const line={account:'121001',description:'Test',debit:'10',credit:'0'};
test('Main headings and legacy person accounts cannot be selected as GL accounts',()=>{
 assert.equal(isLedgerAccount({...account,kind:'Group'}),false);
 assert.equal(isLedgerAccount({...account,code:'121008',clientId:'party'}),false);
 assert.equal(isLedgerAccount(account),true);
});
test('Auxiliary cell requires the configured directory identity and never substitutes another kind',()=>{
 assert.equal(partyDirectory(account),'client');
 assert.equal(lineDetailComplete(account,{...line,auxiliaryId:'aux'}),false);
 assert.equal(lineDetailComplete(account,{...line,vendorId:'vendor'}),false);
 assert.equal(lineDetailComplete(account,{...line,clientId:'client'}),true);
 const bank={...account,kind:'Posting' as const,subledger:undefined,hasAuxiliary:true};
 assert.equal(partyDirectory(bank),null);
 assert.equal(lineDetailComplete(bank,{...line,clientId:'client'}),false);
 assert.equal(lineDetailComplete(bank,{...line,auxiliaryId:'aux'}),true);
 assert.equal(lineDetailComplete({...bank,hasAuxiliary:false},line),true);
});
test('Journal request validation retains Third Party identity for database enforcement',()=>{
 const id='00000000-0000-4000-8000-000000000001';
 assert.equal(journalLineSchema.parse({...line,clientId:id}).clientId,id);
 assert.equal(journalLineSchema.parse({...line,vendorId:id}).vendorId,id);
});

 test('Revenue and cost use an existing GL third-party directory',()=>{
 const revenue={code:'411001',name:'Revenue',kind:'Posting',type:'Revenue',normal:'Credit',active:true,nameAr:'',version:1,parent:null,directorySource:'121001',directoryKind:'Customer'} as import('./setup-types').SavedAccount;
 assert.equal(partyDirectory(revenue),'client');assert.equal(lineDetailComplete(revenue,{clientId:'client'} as import('./journal-model').JournalLine),true);assert.equal(lineDetailComplete(revenue,{auxiliaryId:'old-component'} as import('./journal-model').JournalLine),false);
 assert.equal(partyDirectory({...revenue,directorySource:'211001',directoryKind:'Supplier / creator'}),'vendor');
 });
