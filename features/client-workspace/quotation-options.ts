import type { ClientReviewSourceSnapshot, ClientReviewSourceSnapshotCreator } from './types';
/** Resolve only the selected client-facing lines, never internal costs. */
export function applyCreatorQuotationOptions<T extends ClientReviewSourceSnapshotCreator>(creator: T): T {
    const options = creator.quotationOptions;
    if (!options?.length || creator.selectedQuotationItemIds === undefined)
        return creator;
    const selected = new Set(creator.selectedQuotationItemIds);
    const lines = options.filter(option => selected.has(option.itemId));
    const valid = lines.length === selected.size && lines.every(line => line.investmentAmount != null && line.investmentAmount > 0);
    return { ...creator,
        investmentAmount: valid && lines.length ? lines.reduce((sum, line) => sum + (line.investmentAmount ?? 0), 0) : undefined,
        agencyFeeAmount: valid && lines.length ? lines.reduce((sum, line) => sum + (line.agencyFeeAmount ?? 0), 0) : undefined,
        deliverables: lines.map(line => line.deliverables).filter(Boolean).join(' + ') || undefined,
        serviceDescription: lines.map(line => line.serviceDescription || line.deliverables).filter(Boolean).join(' + ') || undefined,
        deliverableItems: undefined,
        originalInvestmentAmount: undefined,
        originalInvestmentCurrency: undefined,
    };
}
export function chosenQuotationItemIds(creator: ClientReviewSourceSnapshotCreator): string[] {
    return creator.selectedQuotationItemIds ?? creator.quotationOptions?.slice(0, 1).map(option => option.itemId) ?? [];
}
export function validateQuotationOptionChoice(creator: ClientReviewSourceSnapshotCreator, ids: unknown): ids is string[] {
    return Array.isArray(ids) && ids.length <= (creator.quotationOptions?.length ?? 0) &&
        new Set(ids).size === ids.length && ids.every(id => typeof id === 'string' && creator.quotationOptions?.some(option => option.itemId === id));
}
/** Keep stored commercial projections consistent with the selected creator lines. */
export function reconcileQuotationOptionTotals(snapshot: ClientReviewSourceSnapshot): ClientReviewSourceSnapshot {
    if (!snapshot.creators.some(creator => creator.selectedQuotationItemIds !== undefined))
        return snapshot;
    const priced = snapshot.creators.filter(creator => creator.quotationEligible !== false && (creator.investmentAmount ?? 0) > 0);
    const creatorInvestment = priced.reduce((sum, creator) => sum + (creator.investmentAmount ?? 0), 0);
    const feeAmount = priced.reduce((sum, creator) => sum + (creator.agencyFeeAmount ?? 0), 0);
    const lines = priced.map(creator => ({ creatorId: creator.creatorId, label: creator.displayName, amount: creator.investmentAmount! }));
    return { ...snapshot,
        commercial: { ...snapshot.commercial, creatorInvestment, feeAmount, totalInvestment: creatorInvestment + feeAmount, quotationTotal: creatorInvestment, lines },
        quotation: snapshot.quotation ? { ...snapshot.quotation, lines } : undefined,
    };
}
