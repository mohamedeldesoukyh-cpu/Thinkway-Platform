"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { formatMoneyKpi } from "@/lib/finance/currency-format";

import {
  confirmCreatorsAction,
  decideReviewAction,
  removeUnpricedSelectedAction,
  requestReviewChangesAction,
} from "../actions/client-workspace-actions";
import { CLIENT_CHANGE_AREAS, CLIENT_CHANGE_AREA_LABEL, type ClientChangeArea } from "../constants";
import { TO_BE_CONFIRMED } from "../format";
import { approvalWorkspaceKind } from "../journey-state";
import { rosterHeadline } from "../presentation";
import { APPROVE_FINAL_QUOTATION_LABEL, CONFIRM_CREATORS_LABEL, CONFIRM_CREATORS_SUPPORTING_TEXT, INVALID_ZERO_SELECTION_APPROVAL_MESSAGE, UNPRICED_APPROVAL_MESSAGE } from "../selection-flow";
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
  const selectedCount = counts.accepted;
  const approvalKind = approvalWorkspaceKind({
    historical: Boolean(journey?.historical),
    quotationStage: quotationStage ?? "draft",
    canApproveShortlist: Boolean(journey?.canApproveShortlist),
    canApproveQuotation: Boolean(journey?.canApproveQuotation),
    selectedCount,
  });
  const showConfirmCreators = Boolean(journey?.canConfirmCreators);
  const showQuotationApproval = Boolean(journey?.canApproveFinalQuotation);
  const unpricedCount = selectedCommercial.unpricedSelectedCount ?? 0;
  const showUnpricedGate =
    Boolean(journey?.selectionConfirmed) &&
    Boolean(journey?.canApproveQuotation) &&
    unpricedCount > 0 &&
    !showQuotationApproval;
  const quotationApproved = approvalKind === "quotation_approved";
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

  if (approvalKind === "historical") {
    const approvedOn = view.review.approvedAt
      ? new Date(view.review.approvedAt).toLocaleDateString("en-GB")
      : null;
    const versionLabel =
      view.review.source === "quotation"
        ? `Quotation v${view.review.reviewNumber}`
        : `Shortlist v${view.review.reviewNumber}`;
    const statusLabel = "Historical / Superseded";
    return (
      <div className="card">
        <p className="ck">Historical version</p>
        <h2>
          {versionLabel} · {statusLabel}
        </h2>
        <p className="note">
          Historical / Superseded · Read only.
          {approvedOn ? ` Approved on ${approvedOn}.` : ""} This version is not the current journey
          and cannot be approved, rejected, or sent for changes.
        </p>
      </div>
    );
  }

  if (quotationApproved) {
    return (
      <div className="card">
        <p className="ck">Campaign</p>
        <h2>{view.overview.campaignName}</h2>
        <p className="note">
          Final quotation approved
          {view.review.approvedAt ? ` · ${new Date(view.review.approvedAt).toLocaleString()}` : ""}
          {view.review.approvedByLabel ? ` · ${view.review.approvedByLabel}` : ""}
          . Campaign is ready to start.
        </p>
      </div>
    );
  }

  if (quotationStage === "approved" && selectedCount === 0) {
    return (
      <div className="card">
        <p className="ck">Campaign</p>
        <h2>Selection required</h2>
        <p className="note">{INVALID_ZERO_SELECTION_APPROVAL_MESSAGE}</p>
      </div>
    );
  }

  return (
    <>
      {view.stageDiff ? <RosterDiffCard view={view} /> : null}

      {journey?.selectionConfirmed && !showConfirmCreators ? (
        <div className="card">
          <p className="ck">Your Selection</p>
          <h2>Client Approved</h2>
          <p className="note">
            The client has approved the creators to include in this quotation. This is not quotation
            approval and does not start the campaign.
          </p>
        </div>
      ) : null}

      {showConfirmCreators ? (
        <div className="card">
          <p className="ck">Your Selection</p>
          <h2>{CONFIRM_CREATORS_LABEL}</h2>
          <p className="note">{CONFIRM_CREATORS_SUPPORTING_TEXT}</p>
          <div className="checklist">
            <CheckItem done={counts.accepted > 0} label="Creators selected" />
            <CheckItem done={unpricedCount === 0} label="Confirmed pricing where available" />
          </div>
          {error ? <p style={{ color: "var(--bad)", fontSize: 13 }}>{error}</p> : null}
          <div className="dacts" style={{ justifyContent: "flex-start", marginTop: 18 }}>
            <button
              type="button"
              className="btn pri"
              disabled={pending || counts.accepted === 0 || unpricedCount > 0}
              onClick={() =>
                startTransition(async () => {
                  const result = await confirmCreatorsAction({ token });
                  if (!result.ok) setError(result.message);
                  router.refresh();
                })
              }
            >
              <IconCheck />
              {CONFIRM_CREATORS_LABEL}
            </button>
            <button type="button" className="btn sec" onClick={() => goToSection("feedback")}>
              Request changes
            </button>
          </div>
        </div>
      ) : null}

      {showUnpricedGate ? (
        <div className="card">
          <p className="ck">Commercial</p>
          <h2>{UNPRICED_APPROVAL_MESSAGE}</h2>
          <p className="note">
            Remove unpriced creators to approve the priced selection, or wait for Thinkway to confirm
            investment. Unpriced creators remain on the shortlist.
          </p>
          {error ? <p style={{ color: "var(--bad)", fontSize: 13 }}>{error}</p> : null}
          <div className="dacts" style={{ justifyContent: "flex-start", marginTop: 18 }}>
            <button
              type="button"
              className="btn pri"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await removeUnpricedSelectedAction({ token });
                  if (!result.ok) setError(result.message);
                  router.refresh();
                })
              }
            >
              Remove unpriced creators
            </button>
            <button type="button" className="btn sec" disabled>
              Wait for pricing
            </button>
          </div>
        </div>
      ) : null}

      {showQuotationApproval ? (
        <div className="card">
          <p className="ck">Campaign</p>
          <h2>{APPROVE_FINAL_QUOTATION_LABEL}</h2>
          <p className="note">
            This is the only client action that means commercial approval: selected creators,
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
      ) : null}

      {!showConfirmCreators && !showQuotationApproval && !showUnpricedGate && !quotationApproved ? (
        <div className="card">
          <p className="ck">Campaign</p>
          <h2>No commercial decision is open yet</h2>
          <p className="note">
            Confirm your creator selection first. Thinkway will send an updated quotation if commercial
            terms change.
          </p>
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
