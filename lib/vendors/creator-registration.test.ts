import assert from 'node:assert/strict';
import { test } from 'node:test';
import { creatorRegistration } from './creator-registration';

test('selected document, address and agency map from one creator record', () => {
  const result = creatorRegistration({ tax_registration_number: 'CURRENT', city: 'Old city', metadata: {
    legal_document_type: 'national_id', national_id_number: 'ID-1', trade_license: 'CR-2', tax_id: 'OLD',
    legal_address_line1: 'Street', legal_address_city: 'Cairo', legal_address_country: 'Egypt',
    has_management_agency: true, agency_name: 'Agency', agency_email: 'contact@example.com',
  } });
  assert.equal(result.documentLabel, 'ID');
  assert.equal(result.documentNumber, 'ID-1');
  assert.equal(result.address, 'Street, Cairo, Egypt');
  assert.equal(result.taxId, 'CURRENT');
  assert.equal(result.agency?.name, 'Agency');
});

test('disabled agency data is retained but not included, cleared canonical tax does not revive stale data', () => {
  const result = creatorRegistration({ tax_registration_number: null, metadata: { tax_id: 'OLD', has_management_agency: false, agency_name: 'Agency' } });
  assert.equal(result.agency, null);
  assert.equal(result.taxId, null);
});

test('legacy registration is readable without silently using the wrong selected document', () => {
  assert.equal(creatorRegistration({ metadata: { national_id: 'Legacy ID' } }).documentNumber, 'Legacy ID');
  assert.equal(creatorRegistration({ metadata: { legal_document_type: 'trade_license', national_id: 'Legacy ID' } }).documentNumber, null);
});
