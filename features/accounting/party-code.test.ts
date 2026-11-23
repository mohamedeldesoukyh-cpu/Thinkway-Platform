import assert from 'node:assert/strict';
import { test } from 'node:test';
import { partyCode } from './party-code';

test('Accounting omits party prefixes while preserving the code and name', () => {
  assert.equal(partyCode('CLT-000001'), '000001');
  assert.equal(partyCode('INF-008286 · Vendor name'), '008286 · Vendor name');
  assert.equal(partyCode('VND-123'), '123');
  assert.equal(partyCode('VEN-123'), '123');
  assert.equal(partyCode('CLI-000001'), '000001');
  assert.equal(partyCode('CLT-12345678901234567890'), '12345678901234567890');
  for (const value of ['121001', 'INV-2026-0001', 'CLT-CUSTOM-1', 'INF-Company name']) assert.equal(partyCode(value), value);
  assert.equal(partyCode(null), '');
});
