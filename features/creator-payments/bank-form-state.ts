import { bankDetails, type BankDetails } from './model';

export function isEmptyBank(bank: BankDetails) {
    return Object.entries(bank).every(([key, value]) => key === 'registered' ? value === false : typeof value === 'string' && !value.trim());
}
export const duplicateFieldLabels = { nickname: 'AAIB beneficiary nickname', iban: 'IBAN', account_number: 'Account number', beneficiary_name: 'Beneficiary name', beneficiary_address: 'Beneficiary address', email: 'Advice email', mobile: 'Mobile' } as const;
export type BankDuplicate = { account_id: string; creator_id: string; creator_name: string; field: keyof typeof duplicateFieldLabels };
export type BankDraft = { bank: BankDetails; accountMode: string; routeMode: string; makeDefault: boolean; updatedAt: number };
type DraftCache = { selected: string | null; drafts: Record<string, BankDraft> };
export const draftKey = (userId: string, creatorId: string) => `creator-bank-drafts:v1:${userId}:${creatorId}`;
// Tab-scoped storage avoids carrying beneficiary details between browser sessions.
// User + creator + account keys prevent accidental cross-creator draft restoration.
export function readBankDrafts(raw: string | null, now = Date.now()): DraftCache {
    const empty = { selected: null, drafts: {} };
    if (!raw) return empty;
    try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || !parsed.drafts) return empty;
        const drafts: Record<string, BankDraft> = {};
        for (const [key, item] of Object.entries(parsed.drafts)) {
            const d = item as BankDraft;
            if (!d || !Number.isFinite(d.updatedAt) || now - d.updatedAt > 24 * 60 * 60 * 1000 || d.updatedAt > now || !d.bank) continue;
            if (Object.keys(bankDetails()).some(field => field === 'registered' ? typeof d.bank.registered !== 'boolean' : typeof d.bank[field as keyof BankDetails] !== 'string')) continue;
            if (!['iban', 'account'].includes(d.accountMode) || !['swift', 'clearing'].includes(d.routeMode)) continue;
            drafts[key] = d;
        }
        return { selected: typeof parsed.selected === 'string' ? parsed.selected : null, drafts };
    } catch { return empty; }
}
