"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { formatMoneyKpi } from "@/lib/finance/currency-format";

import {
  decideReviewAction,
  requestReviewChangesAction,
} from "../actions/client-workspace-actions";
import { CLIENT_CHANGE_AREAS, CLIENT_CHANGE_AREA_LABEL, type ClientChangeArea } from "../constants";
import { TO_BE_CONFIRMED } from "../format";
import { rosterHeadline } from "../presentation";
import { countSelections } from "../status";
import type { ClientWorkspaceView } from "../types";
import { useClientWorkspaceState } from "./client-workspace-state";
import { RosterDiffCard } from "./roster-diff-card";
import { IconCheck } from "./review-icons";

export function ApprovalWorkspace({
  view,
  token,
}: {
  view: ClientWorkspaceView;
  token: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [summary, setSummary] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [areas, setAreas] = useState<ClientChangeArea[]>(["creator"]);
  const [error, setError] = useState<string | null>(null);
  const { selection, selectedCommercial, selectedSummary, goToSection } = useClientWorkspaceState();
  const counts = countSelections(
    selection,
    view.creators.map((creator) => creator.creatorId)
  );
  const journey = view.journey;
  const quotationStage = journey?.quotationStage;
  const shortlistStage = journey?.shortlistStage;
  const showShortlistApproval = Boolean(journey?.canApproveShortlist);
  const showQuotationApproval = Boolean(journey?.canApproveQuotation);
  const quotationApproved = quotationStage === "approved";
  const shortlistApproved = shortlistStage === "approved";
  const deliverableCount = selectedSummary.activityMix.reduce((sum, item) => sum + item.count, 0);
  const investment =
    selectedCommercial.totalInvestment > 0
      ? formatMoneyKpi(selectedCommercial.totalInvestment, selectedCommercial.currency)
      : TO_BE_CONFIRMED;

  function toggle(area: ClientChangeArea) {
    setAreas((current) =>
      current.includes(area) ? current.filter((item) => item !== area) : [...current, area]
    );
  }

  if (quotationApproved) {
    return (
      <div className="card">
        <p className="ck">Quotation approved</p>
        <h2>{view.overview.campaignName}</h2>
        <p className="note">
          Approved {view.review.approvedAt ? new Date(view.review.approvedAt).toLocaleString() : ""}
          {view.review.approvedByLabel ? ` · Approved by ${view.review.approvedByLabel}` : ""}
          . This is the final commercial approval.
        </p>
      </div>
    );
  }

  return (
    <>
      {view.stageDiff ? <RosterDiffCard view={view} /> : null}

      {shortlistApproved && !showShortlistApproval ? (
        <div className="card">
          <p className="ck">Shortlist</p>
          <h2>Shortlist approved for consideration</h2>
          <p className="note">
            This approval accepts the creator roster only. It does not approve prices, deliverables, or
            quotation value.
          </p>
        </div>
      ) : null}

      {showShortlistApproval ? (
        <div className="card">
          <p className="ck">Shortlist</p>
          <h2>Approve this creator shortlist for consideration</h2>
          <p className="note">
            We accept this creator shortlist for consideration. This does not approve prices, the
            quotation, final campaign investment, or lock deliverables.
          </p>
          <div className="checklist">
            <CheckItem done label="Creator roster reviewed" />
            <CheckItem done={view.creators.length > 0} label="Creator fit reviewed" />
            <CheckItem done={counts.rejected < view.creators.length} label="Shortlist accepted for consideration" />
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
                    stage: "shortlist",
                  });
                  if (!result.ok) setError(result.message);
                  router.refresh();
                })
              }
            >
              <IconCheck />
              Approve Shortlist
            </button>
            <button type="button" className="btn sec" onClick={() => goToSection("feedback")}>
              Request changes
            </button>
          </div>
        </div>
      ) : null}

      {showQuotationApproval ? (
        <div className="card">
          <p className="ck">Quotation</p>
          <h2>Approve this quotation</h2>
          <p className="note">
            This is the final commercial approval: creators, deliverables, and campaign investment.
          </p>
          <div className="asum">
            <div className="gi">
              <p className="l">Creators</p>
              <p className="v">{rosterHeadline(view.creators.length)}</p>
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
            <CheckItem done={view.creators.length > 0} label="Creators reviewed" />
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
                  if (!result.ok) setError(result.message);
                  router.refresh();
                })
              }
            >
              <IconCheck />
              Approve Quotation
            </button>
            <button type="button" className="btn sec" onClick={() => goToSection("feedback")}>
              Request changes
            </button>
          </div>
        </div>
      ) : null}

      {!showShortlistApproval && !showQuotationApproval && !quotationApproved ? (
        <div className="card">
          <p className="ck">Approval</p>
          <h2>No decision is open on this version</h2>
          <p className="note">Thinkway will send an updated quotation if commercial terms change.</p>
        </div>
      ) : null}

      {journey?.canRequestQuotationChanges || journey?.canRequestShortlistChanges ? (
        <div className="card">
          <p className="ck">Request changes</p>
          <h2>Tell Thinkway what to update</h2>
          <div className="catchips">
            {CLIENT_CHANGE_AREAS.map((area) => (
              <button
                key={area}
                type="button"
                className={areas.includes(area) ? "catchip on" : "catchip"}
                onClick={() => toggle(area)}
              >
                {CLIENT_CHANGE_AREA_LABEL[area]}
              </button>
            ))}
          </div>
          <textarea
            className="f"
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            placeholder="What needs to change?"
          />
          <div style={{ height: 14 }} />
          <button
            type="button"
            className="btn sec"
            disabled={pending || !summary.trim()}
            onClick={() =>
              startTransition(async () => {
                await requestReviewChangesAction({
                  token,
                  summary,
                  areas,
                  stage: journey?.canRequestQuotationChanges ? "quotation" : "shortlist",
                });
                router.refresh();
              })
            }
          >
            Send request
          </button>
        </div>
      ) : null}

      {journey?.canRejectQuotation ? (
        <div className="card">
          <p className="ck" style={{ color: "var(--bad)" }}>
            Reject quotation
          </p>
          <h2>Rejecting the quotation does not reject the shortlist</h2>
          <textarea
            className="f"
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
            placeholder="Why is this quotation being rejected?"
          />
          <div className="dacts" style={{ justifyContent: "flex-start", marginTop: 14 }}>
            <button
              type="button"
              className="btn no"
              disabled={pending || !rejectReason.trim()}
              onClick={() =>
                startTransition(async () => {
                  const result = await decideReviewAction({
                    token,
                    decision: "rejected",
                    reason: rejectReason,
                    stage: "quotation",
                  });
                  if (!result.ok) setError(result.message);
                  router.refresh();
                })
              }
            >
              Reject quotation
            </button>
          </div>
        </div>
      ) : null}
    </>
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
