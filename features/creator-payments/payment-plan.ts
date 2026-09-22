import { creatorFxRate } from "@/lib/commercial/creator-fx";
import { z } from 'zod';
import type { PaymentDraft, PaymentRow } from './model';

export const paymentDraftSchema = z.object({
    paymentDate: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/),z.literal('')]).optional(),
    fee: z.number().finite().nonnegative(), vat: z.number().min(0).max(100),
    currency: z.string().regex(/^[A-Z]{3}$/), rate: z.number().finite().positive().max(999999999),
    mode: z.enum(['full', 'percent', 'manual']), percent: z.number().min(0).max(100),
    amount: z.number().finite().nonnegative().max(9999999999999),
    invoiceNumber: z.string().max(100).optional(), invoiceDate: z.string().max(10).optional(),
    invoiceAmount: z.number().finite().nonnegative().optional(),
});
export const defaultPaymentDraft = (row: PaymentRow): PaymentDraft => ({ fee: row.fee, vat: row.vat, currency: row.currency, rate: 1, mode: 'manual', percent: 100, amount: 0, paymentDate: '' });

export function changedPaymentPlans(rows: PaymentRow[], drafts: Record<string, PaymentDraft>) {
    return rows.filter(row => {
        const draft = drafts[row.assignmentId];
        if (!draft) return false;
        const saved = defaultPaymentDraft(row);
        return (Object.keys({ ...saved, ...draft }) as (keyof PaymentDraft)[]).some(key => saved[key] !== draft[key]);
    });
}

export function paymentCurrencyRate(row: PaymentRow, currency: string): number {
    try { return creatorFxRate({ from: row.currency, to: currency, sourceRateToEgp: row.currencyRates?.[row.currency] ?? 0, targetRateToEgp: row.currencyRates?.[currency] ?? 0, override: row.costFxOverride }); }
    catch { return 0; }
}
