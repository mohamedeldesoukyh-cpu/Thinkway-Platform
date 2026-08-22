"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { formatMoneyKpi } from "@/lib/finance/currency-format";

import { decideReviewAction } from "../actions/client-workspace-actions";
import { TO_BE_CONFIRMED } from "../format";
import { rosterHeadline } from "../presentation";
import {
  AFTER_FINAL_QUOTATION_SECTION,
  APPROVE_FINAL_QUOTATION_LABEL,
} from "../selection-flow";
import { countSelections } from "../status";
import type { ClientWorkspaceView } from "../types";
import { useClientWorkspaceState } from "./client-workspace-state";
import { IconCheck } from "./review-icons";

export function FinalQuotationApprovalCard({
  view,
  token,
}: {
  view: ClientWorkspaceView;
  token: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { selection, selectedCommercial, selectedSummary, goToSection } = useClientWorkspaceState();
  const counts = countSelections(
    selection,
    view.creators.map((creator) => creator.creatorId)
  );
  const deliverableCount = selectedSummary.activityMix.reduce((sum, item) => item.count + sum, 0);
  const investment =
    selectedCommercial.totalInvestment > 0
      ? formatMoneyKpi(selectedCommercial.totalInvestment, selectedCommercial.currency)
      : TO_BE_CONFIRMED;

  if (!view.journey?.canApproveFinalQuotation) return null;

  return (
    <div className="card">
      <p className="ck">Commercial approval</p>
      <h2>{APPROVE_FINAL_QUOTATION_LABEL}</h2>
      <p className="note">
        Creator approval is complete. This is the client action that confirms selected creators,
        deliverables, final investment, quotation terms, and applicable T&amp;C.
      </p>
      <div className="asum">
        <div className="gi">
          <p className="l">Creators</p>
          <p className="v">{rosterHeadline(counts.accepted)}</p>
        </div>
        <div className="gi">
          <p className="l">Investment</p>
          <p className={selectedCommercial.totalInvestment > 0 ? "v" : "v tbc"}>{investment}</p>
        </div>
        <div className="gi">
          <p className="l">Deliverables</p>
          <p className={deliverableCount > 0 ? "v" : "v tbc"}>
            {deliverableCount > 0 ? `${deliverableCount} items` : TO_BE_CONFIRMED}
          </p>
        </div>
      </div>
      <div className="checklist">
        <CheckItem done={counts.accepted > 0} label="Creators reviewed" />
        <CheckItem done={deliverableCount > 0} label="Deliverables reviewed" />
        <CheckItem done={selectedCommercial.totalInvestment > 0} label="Investment reviewed" />
        <CheckItem done={Boolean(view.quotation)} label="Quotation terms reviewed" />
        <CheckItem done label="Applicable T&C accepted on approval" />
      </div>
      {error ? <p style={{ color: "var(--bad)", fontSize: 13 }}>{error}</p> : null}
      <div className="dacts" style={{ justifyContent: "flex-start", marginTop: 18 }}>
        <button
          type="button"
          className="btn pri"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await decideReviewAction({
                token,
                decision: "approved",
                stage: "quotation",
              });
              if (!result.ok) {
                setError(result.message);
                return;
              }
              goToSection(AFTER_FINAL_QUOTATION_SECTION);
              router.refresh();
            })
          }
        >
          <IconCheck />
          {APPROVE_FINAL_QUOTATION_LABEL}
        </button>
        <button type="button" className="btn sec" onClick={() => goToSection("feedback")}>
          Request changes
        </button>
      </div>
    </div>
  );
}

function CheckItem({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="chk">
      <span className={done ? "cbadge done" : "cbadge pend"}>{done ? "Reviewed" : "Pending"}</span>
      <span>{label}</span>
    </div>
  );
}
