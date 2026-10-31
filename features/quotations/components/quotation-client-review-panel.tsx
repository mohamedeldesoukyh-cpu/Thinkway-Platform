import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { QuotationText } from "./quotation-design-locale";



import { QUOTATION_CLIENT_LABELS } from "@/features/quotations/constants";
import {
  QUOTATION_CLIENT_SELECTION_LABEL,
  countQuotationClientSelections,
  totalsForClientSelection,
  type QuotationClientReviewView,
  type QuotationClientSelectionFilter,
} from "@/features/quotations/quotation-client-review";
import type { QuotationDetail, QuotationItemRow } from "@/features/quotations/types";
import { CLIENT_PROPOSAL_STATUS_LABEL } from "@/features/client-workspace/constants";

import { F } from "@/lib/discovery/suite/helpers";
import { cn } from "@/lib/utils";

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
  /** Link / sync / validity chrome (HTML first `.tw-ch` in pgQuotation). */
  detail: Pick<
    QuotationDetail,
    | "shortlist_id"
    | "shortlist_serial"
    | "campaign_header_id"
    | "campaign_document_number"
    | "sync_enabled"
    | "validity_date"
    | "valid_days_remaining"
    | "is_expired"
  >;
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
  detail,
}: Props) {
  const counts = countQuotationClientSelections(items, review.selectionState);
  const selected = totalsForClientSelection(items, review.selectionState, "accepted");
  const filters: Array<{
    id: QuotationClientSelectionFilter;
    label: string;
    count: number;
  }> = [
    { id: "all", label: "All", count: counts.total },
    { id: "accepted", label: QUOTATION_CLIENT_SELECTION_LABEL.accepted, count: counts.accepted },
    { id: "in_review", label: "Under review", count: counts.inReview },
    { id: "rejected", label: "Rejected", count: counts.rejected },
  ];

  return (
    <div className="q-wrap q-review-wrap">
      <div className="q-card q-rev">
        <div className="q-rev__t">
          <h2><QuotationText>Client review</QuotationText></h2>
          <span className="q-p q-p--blue">proposal v{review.reviewNumber}</span>
          <span className={cn("q-p", review.status === "approved" ? "q-p--ok" : review.status === "rejected" ? "q-p--bad" : "q-p--wrn")}>
            {CLIENT_PROPOSAL_STATUS_LABEL[review.status]}
          </span>
          <span className="q-sp" />
          {canManage ? (
            <>
              <button
                type="button"
                className="q-b q-b--sm"
                disabled={pending || counts.accepted === 0}
                onClick={onSelectApproved}
              >
                <QuotationText>Select client selection</QuotationText></button>
              <button
                type="button"
                className="q-b q-b--sm"
                disabled={pending || counts.inReview === 0}
                onClick={onSelectUnderReview}
              >
                <QuotationText>Select under review</QuotationText></button>
              <button
                type="button"
                className="q-b q-b--sm"
                disabled={pending || counts.inReview === 0}
                onClick={onAcceptOnBehalf}
              >
                <QuotationText>Mark approved by Thinkway</QuotationText></button>
              <Tooltip><TooltipTrigger asChild><button
                type="button"
                className="q-b q-b--sm q-b--pri"
                disabled={pending || !quotationApproved || counts.accepted === 0}
                onClick={onMoveApprovedToCampaign}

              >
                <QuotationText>Move client selection to campaign</QuotationText></button></TooltipTrigger><TooltipContent>
                  {quotationApproved ? "Move client selection uses only client-selected creators. To move your checked lines, use Move selected to campaign below." : "Approve this quotation first, then move the client-selected creators to the campaign."}
                </TooltipContent></Tooltip>
            </>
          ) : null}
        </div>

      <div className="q-rev__f">
        <div className="tw-fchips">
          {filters.map((item) => {
            const isOn = filter === item.id;
            const isZero = item.id !== "all" && item.count === 0;
            return (
              <button
                key={item.id}
                type="button"
                className={cn("q-chip", item.id === "accepted" && "ok", item.id === "in_review" && "wr", item.id === "rejected" && "bd")}
                aria-pressed={isOn}
                disabled={isZero}
                onClick={() => {
                  if (!isZero) onFilter(item.id);
                }}
              >
                <QuotationText>{item.label}</QuotationText>
                <em>{item.count}</em>
              </button>
            );
          })}
        </div>

      </div>
        <p className="q-review-note"><QuotationText>Client selection is not quotation approval.</QuotationText></p>
        {review.changeRequestSummary && <p className="q-review-note">{review.changeRequestSummary}</p>}
        <div
          className="q-rev__s"
          aria-label="Client selection metrics"
        >
          <div>
            <u><QuotationText>Selected creators</QuotationText></u>
            <b>{selected.creatorCount}</b>
          </div>
          <div>
            <u><QuotationText>Selected base cost</QuotationText></u>
            <b>{F(selected.costEgp)}</b>
          </div>
          <div>
            <u>{QUOTATION_CLIENT_LABELS.totalClientCost}</u>
            <b>{F(selected.revenueEgp)}</b>
          </div>
          <div>
            <u><QuotationText>Selected GP</QuotationText></u>
            <b className="r">{F(selected.gpValueEgp)}</b>
          </div>
          <div>
            <u><QuotationText>Selected GP %</QuotationText></u>
            <b className="r">{selected.gpPct.toFixed(1)}%</b>
          </div>
        </div>
      </div>
    </div>
  );
}
