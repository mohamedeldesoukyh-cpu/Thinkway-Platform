import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clientServiceDescriptionFromQuotationItem } from '../../features/client-workspace/quotation-client-overlay';
import { exportItemServiceDescription } from '../../features/quotations/export/quotation-export-utils';

test('client link and exports use the quotation description over stale child text', () => {
  const description = '1× IG Reel + 1× IG Story + 1× Mirrored TT';
  const item = { service_description: description, deliverables: [{ service_description: description + ' + 1× IG Story + 1× Mirrored TT' }] };
  assert.equal(clientServiceDescriptionFromQuotationItem(item), description);
  assert.equal(exportItemServiceDescription(item), description);
  item.service_description = 'Custom scope with usage rights';
  assert.equal(clientServiceDescriptionFromQuotationItem(item), item.service_description);
  assert.equal(exportItemServiceDescription(item), item.service_description);
});

test('legacy descriptions remain available when the creator row description is blank', () => {
  const item = { service_description: ' ', deliverables: [{ service_description: 'First scope' }, { service_description: 'First scope' }, { service_description: 'Second scope' }] };
  assert.equal(clientServiceDescriptionFromQuotationItem(item), 'First scope · Second scope');
  assert.equal(exportItemServiceDescription(item), 'First scope · Second scope');
  assert.equal(clientServiceDescriptionFromQuotationItem({}), undefined);
  assert.equal(exportItemServiceDescription({}), '—');
});
