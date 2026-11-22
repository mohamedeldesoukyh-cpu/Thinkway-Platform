import test from 'node:test';
import assert from 'node:assert/strict';
import {isUnusedJournalLine} from './journal-model';
test('Only completely unused rows are removed; default currency and side do not count as input',()=>{
 const line={account:'',description:'',debit:'0.00',credit:'0',lineCurrency:'EGP'};
 assert.equal(isUnusedJournalLine(line),true);
 for(const change of [{account:'111001'},{description:'Keep my note'},{debit:'10'},{foreignCredit:'1'},{enteredAmount:'-2'},{auxiliaryId:'aux'},{clientId:'client'}])assert.equal(isUnusedJournalLine({...line,...change}),false);
});
