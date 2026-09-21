import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bankDetails } from './model';
import { bankFieldRequirement, changeIban, fillFromIban, inspectIban } from './iban';
import { validateBank } from './aaib';

// Synthetic account numbers with independently calculated check digits.
function sample(country: string, bban: string) {
    const numeric = (bban + country + '00').replace(/[A-Z]/g, c => String(c.charCodeAt(0) - 55));
    return country + String(98n - BigInt(numeric) % 97n).padStart(2, '0') + bban;
}
test('IBAN detection preserves leading zeros and fills only supported bank metadata', () => {
    const iban = sample('AE', '0260000000000000001');
    const bank = fillFromIban({ ...bankDetails(), iban, currency: 'USD' });
    assert.equal(bank.country, 'AE');
    assert.equal(bank.account_number, '0000000000000001');
    assert.equal(bank.bank_name, 'Emirates NBD Bank PJSC');
    assert.equal(bank.swift, 'EBILAEAD');
    assert.equal(bank.currency, 'USD');
    assert.equal(bank.payment_type, 'I');
    assert.equal(bank.registered, false);
    assert.equal(bank.beneficiary_name, '');
    const unknown = inspectIban(sample('AE', '9990000000000000001'));
    assert.equal(unknown.detected?.bank_name, undefined);
    assert.equal(unknown.detected?.swift, undefined);
});
test('Egyptian layout extracts account without treating branch code as branch name', () => {
    const info = inspectIban(sample('EG', '0001000200000000000000001'));
    assert.equal(info.error, undefined);
    assert.equal(info.bankCode, '0001');
    assert.equal(info.detected?.account_number, '00000000000000001');
    assert.equal(info.detected?.bank_branch, undefined);
});
test('invalid checksum and country length never populate fields and fail save validation', () => {
    const iban = sample('AE', '0260000000000000001');
    for (const invalid of [iban.slice(0, -1) + '2', sample('AE', '02600000000000000001'), 'AE123']) {
        const initial = { ...bankDetails(), iban: invalid };
        assert.ok(inspectIban(invalid).error);
        assert.deepEqual(fillFromIban(initial), initial);
        assert.ok(validateBank(initial).some(error => /IBAN/.test(error)));
    }
    assert.equal(inspectIban('ae07 0331 2345 6789 0123 456').error, undefined);
});
test('existing values remain unless replacement is chosen; registration is never inferred', () => {
    const bank = { ...bankDetails(), iban: sample('AE', '0260000000000000001'), country: 'EG', account_number: '001', swift: 'MANUALEX', bank_name: 'Manual bank', registered: true, currency: 'USD', payment_type: 'D' };
    assert.deepEqual(fillFromIban(bank), bank);
    const replaced = fillFromIban(bank, true);
    assert.equal(replaced.country, 'AE');
    assert.equal(replaced.swift, 'EBILAEAD');
    assert.equal(replaced.registered, false);
    assert.equal(replaced.currency, 'USD');
    assert.equal(replaced.payment_type, 'D');
});
test('requirements distinguish optional fields and alternative routing and advice fields', () => {
    const bank = { ...bankDetails(), payment_type: 'I', swift: 'EBILAEAD', iban: 'provided' };
    assert.equal(bankFieldRequirement('beneficiary_address', bank), 'Required');
    assert.equal(bankFieldRequirement('account_number', bank), 'Optional');
    assert.equal(bankFieldRequirement('bank_branch', bank), 'Optional');
    assert.equal(bankFieldRequirement('email', bank), 'Required for payment advice');
    assert.equal(bankFieldRequirement('bank_branch', { ...bank, swift: '' }), 'Required without SWIFT');
    assert.equal(bankFieldRequirement('swift', { ...bank, payment_type: 'B' }), 'Optional');
});
test('changing an IBAN removes stale detected routing, without changing personal details or currency', () => {
    const previous = fillFromIban({ ...bankDetails(), iban: sample('AE', '0260000000000000001'), beneficiary_name: 'Example', currency: 'USD' });
    const changed = fillFromIban(changeIban({ ...previous, swift: 'EBILAEADXXX', registered: true }, sample('AE', '9990000000000000002')));
    assert.equal(changed.swift, '');
    assert.equal(changed.bank_name, '');
    assert.equal(changed.account_number, '0000000000000002');
    assert.equal(changed.beneficiary_name, 'Example');
    assert.equal(changed.currency, 'USD');
    assert.equal(changed.registered, false);
});
