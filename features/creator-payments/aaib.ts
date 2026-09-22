import type { BankDetails } from "./model";
import { inspectIban } from "./iban";
import purposes from "./purpose-codes.json";
export const BENEFICIARY_FILENAME = "AAIBeConnect - Beneficiary_Registration_Template.xlsx";
export const PAYMENT_FILENAME = "BulkPayment_With_Advice.csv";
// The supplied bank CSV is single-byte text (including two 0xA0 header spaces).
// Preserve it on download; do not replace those bytes with Unicode replacement glyphs.
export function paymentFileBytes(csv: string): Uint8Array<ArrayBuffer> {
    if ([...csv].some(c => c.charCodeAt(0) > 255))
        throw new Error('Use English payment details and invoice references for the supplied AAIB CSV format.');
    return Uint8Array.from(csv, c => c.charCodeAt(0));
}
export function validateBank(bank: BankDetails): string[] {
    const errors: string[] = [];
    const required: [
        string,
        string,
        number
    ][] = [
        ["Beneficiary nickname", bank.nickname, 35], ["Beneficiary name", bank.beneficiary_name, 60],
        ["Account / IBAN", bank.iban || bank.account_number, 34], ["Beneficiary address", bank.beneficiary_address, 60],
    ];
    for (const [label, value, max] of required)
        if (!value.trim() || value.length > max)
            errors.push(`${label} is required (maximum ${max} characters).`);
    if (!['B', 'D', 'I'].includes(bank.payment_type))
        errors.push("Choose AAIB, domestic, or international transfer.");
    if (!/^[A-Z]{3}$/.test(bank.currency))
        errors.push("Choose a three-letter currency.");
    if (!/^[A-Z]{2}$/.test(bank.country))
        errors.push("Bank country requires a two-letter ISO code.");
    if (bank.payment_type === 'D' && bank.currency !== 'EGP')
        errors.push("AAIB domestic transfers require EGP. Use International for foreign currency.");
    if (bank.swift && !/^[A-Z0-9]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(bank.swift))
        errors.push("SWIFT must contain 8 or 11 letters/digits.");
    if (bank.swift && bank.swift.slice(4, 6) !== bank.country)
        errors.push("SWIFT country must match bank country.");
    if (bank.payment_type !== 'B' && !bank.swift) {
        const clearing: Record<string, [
            string,
            number
        ][]> = { AU: [['BSB CODE (AUS)', 6]], CA: [['ROUTING CODE', 9]], IN: [['IFSC CODE', 11]], NZ: [['BSB CODE (NZL)', 6]], ZA: [['NATIONAL CLEARING CODE', 6]], GB: [['SORT CODE', 6]], US: [['CHIPS', 4], ['FEDWIRE', 9]] };
        const rule = clearing[bank.country]?.find(([id]) => id === bank.identifier);
        if (!rule || bank.clearing_code.length !== rule[1])
            errors.push("Provide SWIFT or a valid country-specific clearing identifier/code.");
        for (const key of ['bank_name', 'bank_address', 'bank_branch'] as const)
            if (!bank[key] || bank[key].length > 60)
                errors.push(`${key.replaceAll('_', ' ')} is required (maximum 60 characters) with clearing details.`);
    }
    if (bank.email && (bank.email.length > 50 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bank.email)))
        errors.push("Enter a valid beneficiary email (maximum 50 characters).");
    if (bank.mobile && !/^\d{1,15}$/.test(bank.mobile))
        errors.push("Mobile must contain up to 15 digits.");
    for (const key of ['bank_name','bank_address','bank_branch'] as const) if (bank[key].length>60) errors.push(`${key.replaceAll('_',' ')} must be at most 60 characters.`);
    if (!/^[A-Za-z0-9]+$/.test(bank.iban || bank.account_number)) errors.push('Account / IBAN must contain letters and digits only.');
    if (bank.iban) {
        const iban = bank.iban.replace(/\s/g, '').toUpperCase();
        if (iban.slice(0,2)!==bank.country) errors.push('IBAN country must match bank country.');
        const info = inspectIban(iban);
        if (info.error) errors.push(info.error);
    }
    for (const value of Object.values(bank))
        if (typeof value === 'string' && /[\r\n\t]/.test(value))
            errors.push("Bank fields cannot contain tabs or line breaks.");
    return [...new Set(errors)];
}
export function beneficiaryCells(bank: BankDetails): string[] {
    return [bank.payment_type, bank.currency, bank.nickname, bank.beneficiary_name, bank.iban || bank.account_number,
        bank.beneficiary_address, bank.email, bank.mobile, bank.country, bank.swift, bank.identifier, bank.clearing_code, bank.bank_name, bank.bank_address, bank.bank_branch];
}
export type ExportSettings = {
    debitAccount: string;
    date: string;
    charge: string;
    purpose: string;
    details: string;
    advice: boolean;
};
export type ExportTransfer = {
    bank: BankDetails;
    currency: string;
    amount: number;
    reference: string;
    invoiceNumber?: string;
    invoiceDate?: string;
    invoiceAmount?: number;
};
function csvCell(value: string) {
    if (/^[=+@\-]/.test(value))
        throw new Error("Bank export fields cannot start with spreadsheet formula characters.");
    return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}
export function createPaymentCsv(header: string, settings: ExportSettings, transfers: ExportTransfer[], today: string): string {
    if (!/^[A-Z0-9]{1,34}$/.test(settings.debitAccount))
        throw new Error("Enter a valid AAIB debit account / IBAN (maximum 34 characters).");
    const date = new Date(`${settings.date}T00:00:00Z`);
    const start = new Date(`${today}T00:00:00Z`);
    const days = (date.getTime() - start.getTime()) / 86400000;
    if (!Number.isFinite(days) || days < 0 || days > 14 || date.toISOString().slice(0, 10) !== settings.date)
        throw new Error("Transfer date must be today or within 14 days.");
    if (!['SHA', 'BEN', 'OUR'].includes(settings.charge))
        throw new Error("Select SHA, BEN, or OUR charges.");
    if (!settings.details.trim() || settings.details.length > 100 || /[\r\n\t]/.test(settings.details))
        throw new Error("Payment details are required (maximum 100 characters, one line).");
    const rows: string[][] = [];
    const references = new Set<string>();
    for (const t of transfers) {
        const issues = validateBank(t.bank);
        if (issues.length)
            throw new Error(`${t.bank.nickname}: ${issues.join(' ')}`);
        if (!t.bank.registered)
            throw new Error(`${t.bank.nickname}: confirm registration with AAIB first.`);
        if (t.currency !== t.bank.currency)
            throw new Error(`${t.bank.nickname}: payment currency must match the registered beneficiary.`);
        const codes = t.bank.payment_type === 'I' ? purposes.international : purposes.domestic;
        if (!codes.some(c => c.value === settings.purpose))
            throw new Error(`Purpose code is not valid for ${t.bank.nickname}'s transfer type.`);
        if (!Number.isFinite(t.amount) || t.amount <= 0 || t.amount.toFixed(2).length > 16)
            throw new Error("Invalid transfer amount.");
        if (!/^[A-Za-z0-9 ]{1,16}$/.test(t.reference) || references.has(t.reference))
            throw new Error("Customer references must be unique and at most 16 characters.");
        references.add(t.reference);
        if (settings.advice && !t.bank.email)
            throw new Error(`${t.bank.nickname}: email is required for advice.`);
        const mail = settings.advice ? t.reference : '';
        const formatted = settings.date.split('-').reverse().join('/');
        rows.push(['TRF', settings.debitAccount, t.bank.nickname, '', '', '', '', '', '', '', '', formatted, t.currency, t.amount.toFixed(2), settings.charge, settings.purpose, settings.details, t.reference, '', '', settings.advice ? 'Y' : 'N', settings.advice ? t.bank.email : '', mail]);
        if (settings.advice) {
            if (!t.invoiceNumber?.trim() || t.invoiceNumber.length > 100 || !t.invoiceDate || !/^\d{4}-\d{2}-\d{2}$/.test(t.invoiceDate) || !Number.isFinite(t.invoiceAmount) || (t.invoiceAmount ?? 0) < t.amount)
                throw new Error(`${t.bank.nickname}: enter the actual invoice number, date and amount for advice.`);
            const invoiceDate = new Date(`${t.invoiceDate}T00:00:00Z`);
            if (!Number.isFinite(invoiceDate.getTime()) || invoiceDate.toISOString().slice(0, 10) !== t.invoiceDate)
                throw new Error('Invalid invoice date.');
            rows.push(['INV', mail, '0', 'Invoice Amount', 'Adjustment', 'Net Amount', 'Invoice Date', 'Bill Number', ...Array(15).fill('')]);
            rows.push(['INV', '', '1', t.invoiceAmount!.toFixed(2), ((t.invoiceAmount ?? 0) - t.amount).toFixed(2), t.amount.toFixed(2), t.invoiceDate.split('-').reverse().join('/'), t.invoiceNumber, ...Array(15).fill('')]);
        }
    }
    const csv = header.replace(/[\r\n]+$/, '') + '\r\n' + rows.map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
    paymentFileBytes(csv);
    return csv;
}
