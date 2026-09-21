import test from 'node:test';
import assert from 'node:assert/strict';
import { bankDetails } from './model';
import { draftKey, isEmptyBank, readBankDrafts } from './bank-form-state';
import { validateBank } from './aaib';

test('cleared details may be saved but cannot pass bank export validation', () => {
 const empty = bankDetails();
 assert.equal(isEmptyBank(empty), true);
 assert.ok(validateBank(empty).length > 0);
 assert.equal(isEmptyBank({ ...empty, registered: true }), false);
 assert.equal(isEmptyBank({ ...empty, nickname: 'Some data' }), false);
});
test('drafts restore separate saved/new accounts and retain an intentional clear', () => {
 const now=Date.now();
 const draft={bank:bankDetails(),accountMode:'iban',routeMode:'swift',makeDefault:false,updatedAt:now};
 const cache=readBankDrafts(JSON.stringify({selected:'one',drafts:{one:draft,new:{...draft,bank:{...draft.bank,nickname:'Incomplete draft'}}}}),now);
 assert.equal(isEmptyBank(cache.drafts.one.bank),true);
 assert.equal(cache.drafts.new.bank.nickname,'Incomplete draft');
 assert.equal(cache.selected,'one');
 assert.notEqual(draftKey('user1','creator1'),draftKey('user2','creator1'));
 assert.notEqual(draftKey('user1','creator1'),draftKey('user1','creator2'));
});
test('malformed and expired drafts are ignored', () => {
 assert.deepEqual(readBankDrafts('{bad'),{selected:null,drafts:{}});
 const draft={bank:bankDetails(),accountMode:'iban',routeMode:'swift',makeDefault:false,updatedAt:1};
 assert.deepEqual(readBankDrafts(JSON.stringify({drafts:{old:draft}}),86400002).drafts,{});
 assert.deepEqual(readBankDrafts(JSON.stringify({drafts:{bad:{...draft,bank:{}}}}),2).drafts,{});
});
