import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveVendorIoTotalDue } from './vendor-io-line-amount';
test('IO Total Due adds cost VAT to the stored ex-VAT fee',()=>{
 assert.equal(resolveVendorIoTotalDue(1000,1000,140),1140);
 assert.equal(resolveVendorIoTotalDue(1000,1000,0),1000);
 assert.equal(resolveVendorIoTotalDue(0,1000,50),1050);
});
