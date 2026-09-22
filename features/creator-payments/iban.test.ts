import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bankDetails } from './model';
import { bankFieldRequirement, changeIban, fillFromIban, inspectIban } from './iban';
import { validateBank } from './aaib';
import { IBAN_BANKS } from './iban-banks';

// Synthetic account numbers with independently calculated check digits.
function sample(country: string, bban: string) {
    const numeric = (bban + country + '00').replace(/[A-Z]/g, c => String(c.charCodeAt(0) - 55));
    return country + String(98n - BigInt(numeric) % 97n).padStart(2, '0') + bban;
}
test('Emirates Islamic code 034 fills bank routing after a new IBAN is entered', () => {
    const bank = fillFromIban(changeIban(bankDetails(), sample('AE', '0340000000000000001')));
    assert.equal(bank.bank_name, 'Emirates Islamic Bank PJSC');
    assert.equal(bank.swift, 'MEBLAEAD');
    assert.equal(bank.country, 'AE');
    assert.equal(bank.account_number, '0000000000000001');
    assert.equal(bank.currency, '');
    assert.equal(bank.beneficiary_name, '');
});
test('the UAE directory fills all covered codes and switching banks retires previous routing', () => {
    assert.ok(Object.keys(IBAN_BANKS.AE).length >= 40);
    let bank = bankDetails();
    for (const [code, [name, swift]] of Object.entries(IBAN_BANKS.AE)) {
        assert.match(code, /^\d{3}$/);
        assert.match(swift, /^[A-Z0-9]{4}AE[A-Z0-9]{2}$/);
        bank = fillFromIban(changeIban(bank, sample('AE', code + '0000000000000001')));
        assert.equal(bank.bank_name, name, code);
        assert.equal(bank.swift, swift, code);
        assert.equal(bank.account_number, '0000000000000001');
        assert.equal(bank.registered, false);
        assert.equal(bank.currency, '');
    }
    // Neither legacy merger routing nor an AutoPay placeholder is a safe BIC.
    for (const code of ['027', '045', '051', '052', '999']) {
        const unknown = fillFromIban(changeIban(bank, sample('AE', code + '0000000000000001')));
        assert.equal(unknown.swift, '');
        assert.equal(unknown.bank_name, '');
    }
});
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
test('Sharjah Islamic Bank code 041 fills routing without inferring personal details or currency', () => {
    const bank = fillFromIban({ ...bankDetails(), iban: sample('AE', '0410000000000000001') });
    assert.equal(bank.bank_name, 'Sharjah Islamic Bank');
    assert.equal(bank.swift, 'NBSHAEAS');
    assert.equal(bank.country, 'AE');
    assert.equal(bank.account_number, '0000000000000001');
    assert.equal(bank.currency, '');
    assert.equal(bank.beneficiary_address, '');
    assert.equal(bank.registered, false);
    const changed = fillFromIban(changeIban(bank, sample('AE', '0260000000000000002')));
    assert.equal(changed.swift, 'EBILAEAD');
    assert.equal(changed.bank_name, 'Emirates NBD Bank PJSC');
});
test('Wio bank code 086 fills bank and SWIFT and preserves manually supplied beneficiary data', () => {
    const bank = fillFromIban({ ...bankDetails(), iban: sample('AE', '0860000000000000001'), beneficiary_name: 'Example Creator', currency: 'USD' });
    assert.equal(bank.bank_name, 'Wio Bank PJSC');
    assert.equal(bank.swift, 'WIOBAEAD');
    assert.equal(bank.country, 'AE');
    assert.equal(bank.account_number, '0000000000000001');
    assert.equal(bank.beneficiary_name, 'Example Creator');
    assert.equal(bank.currency, 'USD');
    assert.equal(bank.beneficiary_address, '');
    assert.equal(bank.registered, false);
    const manual = fillFromIban({ ...bank, swift: 'WIOBAEADXXX', bank_name: 'Wio Bank P.J.S.C.' });
    assert.equal(manual.swift, 'WIOBAEADXXX');
    assert.equal(manual.bank_name, 'Wio Bank P.J.S.C.');
    const changed = fillFromIban(changeIban(bank, sample('AE', '9990000000000000001')));
    assert.equal(changed.swift, '');
    assert.equal(changed.bank_name, '');
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

test('Egypt and Saudi directories fill every published code without inventing personal information', () => {
    for (const country of ['EG', 'SA']) {
        assert.ok(Object.keys(IBAN_BANKS[country]).length >= 30);
        for (const [code, [name, swift]] of Object.entries(IBAN_BANKS[country])) {
            const account = country === 'EG' ? '00000000000000001' : '000000000000000001';
            const iban = sample(country, code + (country === 'EG' ? '0002' : '') + account);
            const bank = fillFromIban({ ...bankDetails(), iban });
            assert.equal(bank.bank_name, name, country + code);
            assert.equal(bank.swift, swift, country + code);
            assert.equal(bank.account_number, account);
            assert.equal(bank.country, country);
            assert.equal(bank.currency, '');
            assert.equal(bank.beneficiary_name, '');
            assert.equal(bank.beneficiary_address, '');
            assert.equal(bank.registered, false);
            if (swift) assert.match(swift, new RegExp('^[A-Z0-9]{4}' + country + '[A-Z0-9]{2}$'));
        }
    }
});
test('Egypt 0003 identifies National Bank of Egypt; unknown and legacy routing remains explicit', () => {
    const bank = fillFromIban({ ...bankDetails(), iban: sample('EG', '0003000200000000000000001') });
    assert.equal(bank.bank_name, 'National Bank of Egypt');
    assert.equal(bank.swift, 'NBEGEGCX');
    const legacy = fillFromIban(changeIban(bank, sample('EG', '0013000200000000000000001')));
    assert.match(legacy.bank_name, /Blom/);
    assert.equal(legacy.swift, '');
    const unknown = fillFromIban(changeIban(bank, sample('EG', '9999000200000000000000001')));
    assert.equal(unknown.bank_name, '');
    assert.equal(unknown.swift, '');
});
test('Saudi layout supports alphanumeric accounts but rejects invalid bank codes and lengths', () => {
    const iban = sample('SA', '800000000000000000A1');
    const bank = fillFromIban({ ...bankDetails(), iban });
    assert.equal(bank.swift, 'RJHISARI');
    assert.equal(bank.account_number, '0000000000000000A1');
    assert.equal(bank.payment_type, 'I');
    for (const invalid of [sample('SA', '8A0000000000000000A1'), sample('SA', '80000000000000000A1'), iban.slice(0, -1) + '2']) {
        assert.ok(inspectIban(invalid).error);
    }
});
test('modern UAE alphanumeric BICs pass save validation; malformed BICs do not', () => {
    for (const [code, swift] of [['097', 'E097AEXX'], ['132', 'E132AEXX']]) {
        const bank = fillFromIban({ ...bankDetails(), iban: sample('AE', code + '0000000000000001') });
        assert.equal(bank.swift, swift);
        assert.ok(!validateBank(bank).some(error => error.includes('SWIFT')));
        for (const invalid of ['E13212XX', 'E132AEX', 'E132AE_!']) {
            assert.ok(validateBank({ ...bank, swift: invalid }).some(error => error.includes('SWIFT')));
        }
    }
});
