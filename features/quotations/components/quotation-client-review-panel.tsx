"use client";

import { QUOTATION_CLIENT_LABELS } from "@/features/quotations/constants";
import {
  countQuotationClientSelections,
  totalsForClientSelection,
  type QuotationClientReviewView,
  type QuotationClientSelectionFilter,
} from "@/features/quotations/quotation-client-review";
import type { QuotationItemRow } from "@/features/quotations/types";
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
    <div className="discovery-suite mx-[22px] mb-3">
      <div className="tw-c">
        <div className="tw-ch">
          <span className="tw-p p-b">
            Shortlist linked · proposal v{review.reviewNumber}
          </span>
          <span className="tw-ct">
            Client review · proposal v{review.reviewNumber} ·{" "}
            {CLIENT_PROPOSAL_STATUS_LABEL[review.status]}
          </span>
          <span className="tw-cs">
            {counts.accepted} approved · {counts.inReview} under review ·{" "}
            {counts.rejected} rejected
            {review.changeRequestSummary ? ` · ${review.changeRequestSummary}` : ""}
          </span>
          <span className="tw-sp" />
          {canManage ? (
            <>
              <button
                type="button"
                className="tw-b sm"
                disabled={pending || counts.accepted === 0}
                onClick={onSelectApproved}
              >
                Select approved
              </button>
              <button
                type="button"
                className="tw-b sm"
                disabled={pending || counts.inReview === 0}
                onClick={onSelectUnderReview}
              >
                Select under review
              </button>
              <button
                type="button"
                className="tw-b sm"
                disabled={pending || counts.inReview === 0}
                onClick={onAcceptOnBehalf}
              >
                Mark approved by Thinkway
              </button>
              <button
                type="button"
                className="tw-b sm pri"
                disabled={pending || counts.accepted === 0}
                onClick={onMoveApprovedToCampaign}
                title={
                  quotationApproved
                    ? "Convert approved creators to the campaign"
                    : "Approve this quotation first, then convert the approved creators"
                }
              >
                Move approved to campaign
              </button>
            </>
          ) : null}
        </div>

        <div
          className="tw-ms2"
          style={{ borderTop: "1px solid var(--tw-hair)" }}
          aria-label="Approved selection metrics"
        >
          <div>
            <i>Approved creators</i>
            <b>{approved.creatorCount}</b>
          </div>
          <div>
            <i>Approved base cost</i>
            <b>{F(approved.costEgp)}</b>
          </div>
          <div>
            <i>{QUOTATION_CLIENT_LABELS.totalClientCost}</i>
            <b>{F(approved.revenueEgp)}</b>
          </div>
          <div>
            <i>Approved GP</i>
            <b className="r">{F(approved.gpValueEgp)}</b>
          </div>
          <div>
            <i>Approved GP %</i>
            <b className="r">{approved.gpPct.toFixed(1)}%</b>
          </div>
        </div>

        <div className="tw-fbar">
          <div className="tw-fchips">
            {filters.map((item) => {
              const isOn = filter === item.id;
              const isZero = item.id !== "all" && item.count === 0;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={cn("tw-fchip", isOn && "on", isZero && "z")}
                  aria-pressed={isOn}
                  disabled={isZero}
                  onClick={() => {
                    if (!isZero) onFilter(item.id);
                  }}
                >
                  {item.label}
                  <em>{item.count}</em>
                </button>
              );
            })}
          </div>
          <span className="tw-sp" />
          <span className="tw-cs">
            Selecting rows drives the calculator and the bulk actions below
          </span>
        </div>
      </div>
    </div>
  );
}
