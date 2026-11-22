import assert from 'node:assert/strict';
import { test } from 'node:test';
import { invoiceAccountingWeights } from './invoice-accounting-components';
test('invoice accounting freezes revenue, usage rights and calculated agency fees separately',()=>{
 assert.deepEqual(invoiceAccountingWeights({revenue_before_vat:100,usage_rights_amount:20,agency_fee_percent:10}),{assignment_revenue:100,usage_rights_revenue:20,agency_fee:12});
 assert.deepEqual(invoiceAccountingWeights({revenue_before_vat:100,usage_rights_amount:20,agency_fee_percent:10,agency_fee_amount:7}),{assignment_revenue:100,usage_rights_revenue:20,agency_fee:7});
});
test('missing commercial masters remain unsplit instead of inventing revenue components',()=>{
 assert.equal(invoiceAccountingWeights({}),null);
 assert.deepEqual(invoiceAccountingWeights({revenue:40,usage_rights_amount:-2}),{assignment_revenue:40,usage_rights_revenue:0,agency_fee:0});
});
