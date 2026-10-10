export type EntranceState = "approved_setup" | "awaiting" | "creators" | "quotation" | "changes" | "shortlistok" | "rejected";
export function entranceState(journey: {
    selectedCount?: number;
    historical?: boolean;
    quotationStage: string;
    shortlistStage: string;
    canApproveFinalQuotation?: boolean;
    canConfirmCreators?: boolean;
    selectionConfirmed?: boolean;
}, status: string): EntranceState {
    if (journey.historical)
        return 'awaiting';
    if (journey.quotationStage === 'rejected' || status === 'rejected')
        return 'rejected';
    if (journey.quotationStage === 'changes_requested' || journey.shortlistStage === 'changes_requested')
        return 'changes';
    if (journey.canApproveFinalQuotation || journey.quotationStage === 'updated' || (journey.selectionConfirmed && ['sent_for_approval', 'viewed'].includes(journey.quotationStage)))
        return 'quotation';
    if (journey.canConfirmCreators || ['sent_for_approval', 'viewed'].includes(journey.quotationStage))
        return 'creators';
    if (journey.quotationStage === 'approved')
        return journey.selectedCount === 0 ? 'awaiting' : 'approved_setup';
    if (journey.shortlistStage === 'approved')
        return 'shortlistok';
    return 'awaiting';
}
export const ENTRANCE_COPY = {
    approved_setup: { tone: 'ok', before: 'Approved. Now we ', accent: 'bring it to life', after: '.', body: 'Everything we’ve prepared is waiting inside — the roster, the deliverables and the commercials, laid out the way your team reads them.', cta: 'Review campaign' },
    awaiting: { tone: 'info', before: 'Your next ', accent: 'campaign', after: ' starts here.', body: 'We’ve put together a proposal for your review. Take a look when you’re ready.', cta: 'Review campaign' },
    creators: { tone: 'info', before: 'Choose the ', accent: 'creators', after: ' you want.', body: 'The shortlist is ready. You’ll pick the creators inside the workspace — nothing is decided until you choose.', cta: 'Review and select creators' },
    quotation: { tone: 'wrn', before: 'Your ', accent: 'quotation', after: ' is ready for review.', body: 'Final pricing is prepared and waiting for your approval inside the workspace.', cta: 'Review quotation' },
    changes: { tone: 'wrn', before: 'Your feedback is ', accent: 'shaping', after: ' what comes next.', body: 'We’ve received your notes and are working through them.', cta: 'Review updates' },
    shortlistok: { tone: 'ok', before: 'Shortlist ', accent: 'approved', after: '.', body: 'With the roster agreed, the quotation can follow.', cta: 'Review shortlist' },
    rejected: { tone: 'bad', before: 'This proposal was ', accent: 'not approved', after: '.', body: 'The record stays available for reference. Your Thinkway contact will follow up on next steps.', cta: 'View details' },
} as const;
export function distinctNextStep(status: string, action: string) { return Boolean(action.trim() && action.trim().toLowerCase() !== status.trim().toLowerCase()); }
