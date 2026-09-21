import type { BankDetails, PaymentRow } from './model';

export const CREATOR_BANK_SAVED = 'thinkway:creator-bank-saved';
export type CreatorBankSaved = { creatorId: string; bank: BankDetails };
export function applySavedCreatorBank(rows: PaymentRow[], change: CreatorBankSaved): PaymentRow[] {
    return rows.map(row => row.creatorId === change.creatorId ? { ...row, bank: change.bank } : row);
}
export function notifyCreatorBankSaved(creatorId: string, bank: BankDetails) {
    window.dispatchEvent(new CustomEvent<CreatorBankSaved>(CREATOR_BANK_SAVED, { detail: { creatorId, bank } }));
}
