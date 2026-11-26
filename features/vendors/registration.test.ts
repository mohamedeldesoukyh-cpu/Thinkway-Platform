import assert from 'node:assert/strict';
import { test } from 'node:test';
import { z } from 'zod';
import { mergeVendorRegistrationMetadata, vendorRegistrationShape } from './registration';

const schema = z.object(vendorRegistrationShape);

test('registration updates preserve unrelated creator metadata and both document numbers', () => {
  const original = { source: 'discovery', trade_license: 'CR-123', national_id_number: 'ID-456' };
  const next = mergeVendorRegistrationMetadata(original, schema.parse({ legal_document_type: 'national_id', national_id_number: 'ID-789' }));
  assert.deepEqual(next, { ...original, legal_document_type: 'national_id', national_id_number: 'ID-789' });
  assert.equal(original.national_id_number, 'ID-456');
});

test('disabling agency retains saved details omitted by the disabled fieldset', () => {
  const original = { has_management_agency: true, agency_name: 'Agency', agency_email: 'contact@example.com' };
  assert.deepEqual(mergeVendorRegistrationMetadata(original, schema.parse({ has_management_agency: 'false' })), { ...original, has_management_agency: false });
});

test('agency and registration edits persist, including intentional clearing', () => {
  const next = mergeVendorRegistrationMetadata({ agency_phone: '123', source: 'manual' }, schema.parse({ has_management_agency: 'true', agency_name: ' Agency ', agency_phone: '', legal_address_city: 'Cairo', vat_number: 'VAT-1' }));
  assert.deepEqual(next, { agency_phone: null, source: 'manual', has_management_agency: true, agency_name: 'Agency', legal_address_city: 'Cairo', vat_number: 'VAT-1' });
});

test('invalid document types, email addresses and dates are rejected', () => {
  for (const input of [{ legal_document_type: 'passport' }, { agency_email: 'invalid' }, { legal_document_expiry: 'not-a-date' }, { legal_document_expiry: '2026-02-31' }]) {
    assert.equal(schema.safeParse(input).success, false);
  }
});
