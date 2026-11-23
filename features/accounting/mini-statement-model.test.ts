import test from 'node:test';
import assert from 'node:assert/strict';
import { lineStatementSelection } from './mini-statement-model';

test('mini statement retains GL and auxiliary scope',()=>{
 assert.deepEqual(lineStatementSelection({account:'112001',auxiliaryId:'shared-bank'}),{account:'112001',auxiliary:'shared-bank',kind:'all',party:''});
 assert.deepEqual(lineStatementSelection({account:'112002',auxiliaryId:'shared-bank'}),{account:'112002',auxiliary:'shared-bank',kind:'all',party:''});
});
test('automatic journal third party is retained on a generic GL',()=>{
 assert.deepEqual(lineStatementSelection({account:'121001',clientId:'client-a'}),{account:'121001',auxiliary:'',kind:'client',party:'client-a'});
 assert.deepEqual(lineStatementSelection({account:'211001',vendorId:'vendor-a'}),{account:'211001',auxiliary:'',kind:'vendor',party:'vendor-a'});
});
test('dedicated account supplies its party and empty lines do not open a report',()=>{
 assert.equal(lineStatementSelection({account:''}),null);
 assert.equal(lineStatementSelection({account:'121002'},{clientId:'client-b'})?.party,'client-b');
 assert.equal(lineStatementSelection({account:'211002'},{vendorId:'vendor-b'})?.kind,'vendor');
});
