"use client";

import { isQuotationCommercialWorkspaceEnabled } from "@/lib/quotations/commercial-workspace/feature-flag";

import { QuotationCommercialSummaryDialog } from "@/features/quotations/components/quotation-commercial-summary-dialog";
import { QuotationCommercialWorkspaceDialog } from "@/features/quotations/components/quotation-commercial-workspace-dialog";
import type { QuotationRowDraft } from "@/features/quotations/quotation-row-math";
import type { QuotationItemRow } from "@/features/quotations/types";

type Props = {
  quotationId: string;
  items: QuotationItemRow[];
  drafts: Record<string, QuotationRowDraft | undefined>;
  onDraftChange: (id: string, patch: Partial<QuotationRowDraft>) => void;
  onDraftsMerge: (next: Record<string, QuotationRowDraft>) => void;
  canManage: boolean;
  triggerClassName?: string;
  /** Quotation header currency for KPI / dual-cost display. */
  displayCurrency?: string;
  displayFxRateToEgp?: number;
  issueDate?: string | null;
};

/**
 * Feature-flagged entry: Commercial Workspace (editable) vs legacy read-only summary.
 */
export function QuotationCommercialEntry(props: Props) {
  if (isQuotationCommercialWorkspaceEnabled()) {
    return (
      <QuotationCommercialWorkspaceDialog
        quotationId={props.quotationId}
        items={props.items}
        drafts={props.drafts}
        onDraftChange={props.onDraftChange}
        onDraftsMerge={props.onDraftsMerge}
        canManage={props.canManage}
        triggerClassName={props.triggerClassName}
        displayCurrency={props.displayCurrency}
        displayFxRateToEgp={props.displayFxRateToEgp}
        issueDate={props.issueDate}
      />
    );
  }

  return (
    <QuotationCommercialSummaryDialog
      items={props.items}
      drafts={props.drafts}
      triggerClassName={props.triggerClassName}
    />
  );
}
