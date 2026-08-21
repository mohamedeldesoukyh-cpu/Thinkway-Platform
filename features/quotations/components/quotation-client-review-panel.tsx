"use client";

import { Button } from "@/components/ui/button";
import { QUOTATION_CLIENT_LABELS } from "@/features/quotations/constants";
import {
  QUOTATION_CLIENT_SELECTION_LABEL,
  countQuotationClientSelections,
  totalsForClientSelection,
  type QuotationClientReviewView,
  type QuotationClientSelectionFilter,
} from "@/features/quotations/quotation-client-review";
import type { QuotationItemRow } from "@/features/quotations/types";
import { CLIENT_PROPOSAL_STATUS_LABEL } from "@/features/client-workspace/constants";
import { cn } from "@/lib/utils";

function money(n: number): string {
  return `${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0)} EGP`;
}

type Props = {
  review: QuotationClientReviewView;
  items: QuotationItemRow[];
  filter: QuotationClientSelectionFilter;
  onFilter: (filter: QuotationClientSelectionFilter) => void;
  canManage: boolean;
  quotationApproved: boolean;
  onSelectApproved: () => void;
  onSelectUnderReview: () => void;
  onAcceptOnBehalf: () => void;
  onMoveApprovedToCampaign: () => void;
  pending?: boolean;
};

export function QuotationClientReviewPanel({
  review,
  items,
  filter,
  onFilter,
  canManage,
  quotationApproved,
  onSelectApproved,
  onSelectUnderReview,
  onAcceptOnBehalf,
  onMoveApprovedToCampaign,
  pending,
}: Props) {
  const counts = countQuotationClientSelections(items, review.selectionState);
  const approved = totalsForClientSelection(items, review.selectionState, "accepted");
  const filters: Array<{ id: QuotationClientSelectionFilter; count: number }> = [
    { id: "all", count: counts.total },
    { id: "accepted", count: counts.accepted },
    { id: "in_review", count: counts.inReview },
    { id: "rejected", count: counts.rejected },
  ];

  return (
    <div className="mx-4 mb-3 rounded-xl border border-[#d9e4fb] bg-[#f5f8ff] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#274690]">
            Client review · Proposal v{review.reviewNumber} · {CLIENT_PROPOSAL_STATUS_LABEL[review.status]}
          </p>
          <p className="mt-1 text-sm text-[var(--text)]">
            {counts.accepted} approved · {counts.inReview} under review · {counts.rejected} rejected
            {review.changeRequestSummary ? ` · ${review.changeRequestSummary}` : ""}
          </p>
        </div>
        {canManage ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" disabled={pending || counts.accepted === 0} onClick={onSelectApproved}>
              Select approved
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={pending || counts.inReview === 0} onClick={onSelectUnderReview}>
              Select under review
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={pending || counts.inReview === 0} onClick={onAcceptOnBehalf}>
              Mark as approved by Thinkway
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={pending || counts.accepted === 0}
              onClick={onMoveApprovedToCampaign}
              title={
                quotationApproved
                  ? "Convert approved creators to the campaign"
                  : "Approve this quotation first, then convert the approved creators"
              }
            >
              Move approved to campaign
            </Button>
          </div>
        ) : null}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Metric label="Approved creators" value={String(approved.creatorCount)} />
        <Metric label="Approved base cost" value={money(approved.costEgp)} />
        <Metric label={QUOTATION_CLIENT_LABELS.totalClientCost} value={money(approved.revenueEgp)} emphasis />
        <Metric label="Approved GP" value={money(approved.gpValueEgp)} />
        <Metric label="Approved GP%" value={`${approved.gpPct.toFixed(1)}%`} />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {filters.map((item) => (
          <button
            key={item.id}
            type="button"
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-semibold",
              filter === item.id
                ? "border-[var(--navy,#0B0F1A)] bg-[var(--navy,#0B0F1A)] text-white"
                : "border-[#d9e4fb] bg-white text-[var(--text)]"
            )}
            onClick={() => onFilter(item.id)}
          >
            {item.id === "all" ? "All" : QUOTATION_CLIENT_SELECTION_LABEL[item.id]} · {item.count}
          </button>
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="rounded-lg bg-white px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("text-sm font-bold tabular-nums", emphasis && "text-[#0057FF]")}>{value}</div>
    </div>
  );
}
