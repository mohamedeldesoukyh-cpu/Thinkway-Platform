import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateInvoiceAttachment, INVOICE_ATTACHMENT_MAX_BYTES } from './invoice-attachment-model';

test('tax invoice attachments accept supported files at the size limit', () => {
  for (const type of ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']) {
    assert.equal(validateInvoiceAttachment({ name: 'tax-invoice.pdf', type, size: INVOICE_ATTACHMENT_MAX_BYTES }), null);
  }
});
test('tax invoice attachments reject empty, oversized and executable files', () => {
  for (const file of [
    { name: 'empty.pdf', type: 'application/pdf', size: 0 },
    { name: 'large.pdf', type: 'application/pdf', size: INVOICE_ATTACHMENT_MAX_BYTES + 1 },
    { name: 'script.html', type: 'text/html', size: 100 },
    { name: ' ', type: 'image/png', size: 100 },
  ]) assert.ok(validateInvoiceAttachment(file));
});
