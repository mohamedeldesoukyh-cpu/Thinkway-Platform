import test from 'node:test';
import assert from 'node:assert/strict';
import { bankDetails, type PaymentRow } from './model';
import { applySavedCreatorBank } from './bank-sync';
import { validateBank } from './aaib';

test('clearing a saved default immediately removes readiness from every creator line', () => {
 const complete={...bankDetails(),payment_type:'D',currency:'EGP',nickname:'Example',beneficiary_name:'Example Creator',account_number:'00123456789',beneficiary_address:'Cairo',country:'EG',swift:'CIBEEGCX',registered:true};
 const rows=[{creatorId:'one',assignmentId:'a',bank:complete},{creatorId:'one',assignmentId:'b',bank:complete},{creatorId:'two',assignmentId:'c',bank:complete}] as PaymentRow[];
 assert.equal(validateBank(complete).length,0);
 const next=applySavedCreatorBank(rows,{creatorId:'one',bank:bankDetails()});
 assert.equal(next.filter(row=>validateBank(row.bank).length>0).length,2);
 assert.equal(next[0].bank.registered,false);
 assert.equal(next[2],rows[2]);
 assert.equal(rows[0].bank.registered,true);
});
test('a secondary-account save uses the returned default, not the edited account', () => {
 const currentDefault={...bankDetails(),nickname:'Default account'};
 const rows=[{creatorId:'one',bank:currentDefault}] as PaymentRow[];
 const result=applySavedCreatorBank(rows,{creatorId:'one',bank:currentDefault});
 assert.equal(result[0].bank.nickname,'Default account');
});
