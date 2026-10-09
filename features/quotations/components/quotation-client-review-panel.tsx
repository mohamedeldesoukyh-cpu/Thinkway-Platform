import { QuotationText } from "./quotation-design-locale";



import { QUOTATION_CLIENT_LABELS } from "@/features/quotations/constants";
import {
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
  const approved = totalsForClientSelection(items, review.selectionState, "accepted");
  const filters: Array<{
    id: QuotationClientSelectionFilter;
    label: string;
    count: number;
  }> = [
    { id: "all", label: "All", count: counts.total },
    { id: "accepted", label: "Approved", count: counts.accepted },
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
                <QuotationText>Select approved</QuotationText></button>
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
              <button
                type="button"
                className="q-b q-b--sm q-b--pri"
                disabled={pending || counts.accepted === 0}
                onClick={onMoveApprovedToCampaign}
                title={
                  quotationApproved
                    ? "Convert approved creators to the campaign"
                    : "Approve this quotation first, then convert the approved creators"
                }
              >
                <QuotationText>Move approved to campaign</QuotationText></button>
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
        <span className="q-sp" />
        <span className="q-review-note">
          Client approval is the client's decision. The checkboxes below are for your own bulk actions and change nothing for the client.
        </span>
      </div>
        {review.changeRequestSummary && <p className="q-review-note">{review.changeRequestSummary}</p>}
        <div
          className="q-rev__s"
          aria-label="Approved selection metrics"
        >
          <div>
            <u><QuotationText>Approved creators</QuotationText></u>
            <b>{approved.creatorCount}</b>
          </div>
          <div>
            <u><QuotationText>Approved base cost</QuotationText></u>
            <b>{F(approved.costEgp)}</b>
          </div>
          <div>
            <u>{QUOTATION_CLIENT_LABELS.totalClientCost}</u>
            <b>{F(approved.revenueEgp)}</b>
          </div>
          <div>
            <u><QuotationText>Approved GP</QuotationText></u>
            <b className="r">{F(approved.gpValueEgp)}</b>
          </div>
          <div>
            <u>Approved GP %</u>
            <b className="r">{approved.gpPct.toFixed(1)}%</b>
          </div>
        </div>
      </div>
    </div>
  );
}
