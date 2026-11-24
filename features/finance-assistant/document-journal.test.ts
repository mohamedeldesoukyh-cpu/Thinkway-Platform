import test from "node:test";
import assert from "node:assert/strict";
import {validateDocumentJournal} from "./document-journal";
import type {AccountingSetup} from "@/features/accounting/setup-types";
const setup={company:{base_currency:"EGP"},years:[{id:"year",start_date:"2026-01-01",end_date:"2026-12-31"}],accounts:[{code:"610001",active:true,kind:"Posting"},{code:"110001",active:true,kind:"Posting"}]} as AccountingSetup;
const proposal={date:"2026-11-24",reference:"FIXTURE",memo:"Supported expense",currency:"EGP",warnings:[],lines:[{account:"610001",description:"Expense",debit:"100",credit:"0",source:"Page1 total"},{account:"110001",description:"Cash",debit:"0",credit:"100",source:"Page1 paid cash"}]};
test("document proposals must balance and use active real accounts in an open year",()=>{
 assert.equal(validateDocumentJournal(proposal,setup,"year").lines.length,2);
 assert.throws(()=>validateDocumentJournal({...proposal,lines:[proposal.lines[0],{...proposal.lines[1],credit:"99"}]},setup,"year"),/does not balance/);
 assert.throws(()=>validateDocumentJournal({...proposal,lines:[{...proposal.lines[0],account:"999999"},proposal.lines[1]]},setup,"year"),/unavailable/);
 assert.throws(()=>validateDocumentJournal(proposal,{...setup,years:[{...setup.years[0],closed:true}]},"year"),/open fiscal/);
 assert.throws(()=>validateDocumentJournal({...proposal,date:"2025-12-31"},setup,"year"),/open fiscal/);
});
test("document proposals reject fabricated FX, invalid money, source-free rows and hidden party ids",()=>{
 assert.throws(()=>validateDocumentJournal({...proposal,currency:"USD"},setup,"year"),/Foreign-currency/);
 for(const patch of [{debit:"-100"},{credit:"1"},{source:""},{clientId:"11111111-1111-4111-8111-111111111111"}]){
  assert.throws(()=>validateDocumentJournal({...proposal,lines:[{...proposal.lines[0],...patch},proposal.lines[1]]},setup,"year"));
 }
});
