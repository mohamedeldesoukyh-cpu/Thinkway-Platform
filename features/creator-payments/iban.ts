import type { BankDetails } from './model';

// Country layouts: CBUAE / CBE IBAN standards. Never convert account digits to numbers.
// https://centralbank.ae/en/our-operations/payments-and-settlements/regulations-and-standards/iban/
// https://www.cbe.org.eg/en/payment-systems-and-services/payment-systems/iban
export function inspectIban(value: string) {
    const iban = value.replace(/\s/g, '').toUpperCase();
    const country = iban.slice(0, 2);
    if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban))
        return { iban, error: 'Enter a complete IBAN, including its country code.' };
    const length = ({ AE: 23, EG: 29 } as Record<string, number>)[country];
    if (length && (iban.length !== length || !/^\d+$/.test(iban.slice(4))))
        return { iban, error: `${country} IBANs must have ${length} characters with digits after the country code.` };
    const digits = (iban.slice(4) + iban.slice(0, 4)).replace(/[A-Z]/g, c => String(c.charCodeAt(0) - 55));
    let mod = 0;
    for (const digit of digits) mod = (mod * 10 + Number(digit)) % 97;
    if (mod !== 1) return { iban, error: 'IBAN checksum is invalid. Check the number with the creator.' };
    const bankCode = country === 'AE' ? iban.slice(4, 7) : country === 'EG' ? iban.slice(4, 8) : undefined;
    const account = country === 'AE' ? iban.slice(7) : country === 'EG' ? iban.slice(12) : undefined;
    const detected: Partial<BankDetails> = { country };
    if (account) detected.account_number = account;
    // Only verified bank mappings belong here. Unknown banks stay manual.
    // Bank 026: https://www.emiratesnbd.com/-/media/enbd/files/others/form-center/retail-banking/service-forms/direct_debit_authority_loans_emirates_nbd.pdf
    // BIC: https://www.emiratesnbd.com/en/help-and-support/receiving-a-transfer-or-payment
    if (country === 'AE' && bankCode === '026') {
        detected.bank_name = 'Emirates NBD Bank PJSC';
        detected.swift = 'EBILAEAD';
    }
    // CBUAE UAEWPS AUX500 sponsoring-bank directory: 041 = Sharjah Islamic Bank.
    // https://www.gcaa.gov.ae/en/epublication/EPublications/Forms%20Download/Safety%20Affairs/General%20Publications/UAE%20Central%20Bank%20WPS/UAEWPS%20AUX500%20-%20V2018-001%20-%20SPONSORING%20EMPLOYERS%20INTO%20UAEWPS.pdf
    // Bank-issued BIC: https://www.sib.ae/docs/default-source/default-document-library/merchant-services-agreement-form_june-2025.pdf
    if (country === 'AE' && bankCode === '041') {
        detected.bank_name = 'Sharjah Islamic Bank';
        detected.swift = 'NBSHAEAS';
    }
    return { iban, country, bankCode, detected, error: undefined };
}

export function fillFromIban(bank: BankDetails, replace = false): BankDetails {
    const info = inspectIban(bank.iban);
    if (!info.detected) return bank;
    const next = { ...bank };
    for (const [key, value] of Object.entries(info.detected)) {
        const field = key as Exclude<keyof BankDetails, 'registered'>;
        if (replace || !next[field]) next[field] = String(value);
    }
    // Non-Egyptian accounts must not default to domestic. Currency is never inferred.
    if (!next.payment_type && info.country !== 'EG') next.payment_type = 'I';
    if (JSON.stringify(next) !== JSON.stringify(bank)) next.registered = false;
    return next;
}

export function changeIban(bank: BankDetails, value: string): BankDetails {
    const iban = value.replace(/\s/g, '').toUpperCase();
    if (iban === bank.iban) return bank;
    const next = { ...bank, iban, registered: false };
    // Retire details associated with the previous IBAN so a new/unknown bank
    // cannot silently inherit a previously detected bank's routing information.
    for (const [key, previous] of Object.entries(inspectIban(bank.iban).detected ?? {})) {
        const field = key as Exclude<keyof BankDetails, 'registered'>;
        if (next[field] === previous || (field === 'swift' && next.swift.slice(0, 8) === previous)) next[field] = '';
    }
    return next;
}

export function bankFieldRequirement(key: keyof BankDetails, bank: BankDetails): string {
    if (['payment_type', 'currency', 'nickname', 'beneficiary_name', 'beneficiary_address', 'country'].includes(key)) return 'Required';
    if (key === 'iban') return bank.account_number ? 'Optional' : 'Required, or account number';
    if (key === 'account_number') return bank.iban ? 'Optional' : 'Required if no IBAN';
    if (key === 'email') return 'Required for payment advice';
    if (key === 'swift') return bank.payment_type === 'B' ? 'Optional' : 'Required, or clearing details';
    if (['identifier', 'clearing_code', 'bank_name', 'bank_branch', 'bank_address'].includes(key))
        return bank.payment_type !== 'B' && !bank.swift ? 'Required without SWIFT' : 'Optional';
    return 'Optional';
}
