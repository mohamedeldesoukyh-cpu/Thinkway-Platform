import assert from 'node:assert/strict';
import { documentReturnPath } from './document-return';
for (const path of ['/campaigns/abc?tab=finance&invoice=123#billing','/finance/invoices?status=issued']) assert.equal(documentReturnPath(path,'/finance/invoices'),path);
for (const path of [undefined,'https://example.com','//example.com','/\\example.com','/ bad']) assert.equal(documentReturnPath(path,'/finance/invoices'),'/finance/invoices');
console.log('document-return: passed');
