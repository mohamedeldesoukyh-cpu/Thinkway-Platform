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
  const deliverableCount = selectedSummary.activityMix.reduce((sum, item) => sum + item.count, 0);
  const investment =
    selectedCommercial.totalInvestment > 0
      ? formatMoneyKpi(selectedCommercial.totalInvestment, selectedCommercial.currency)
      : TO_BE_CONFIRMED;
  const quotationTotal =
    view.commercial.quotationTotal > 0
      ? formatMoneyKpi(view.commercial.quotationTotal, view.commercial.currency)
      : TO_BE_CONFIRMED;

  function toggle(area: ClientChangeArea) {
    setAreas((current) =>
      current.includes(area) ? current.filter((item) => item !== area) : [...current, area]
    );
  }

  if (view.review.status === "approved") {
    return (
      <div className="card">
        <p className="ck">Proposal approved</p>
        <h2>{view.overview.campaignName}</h2>
        <p className="note">
          Approved {view.review.approvedAt ? new Date(view.review.approvedAt).toLocaleString() : ""} · Proposal v
          {view.review.reviewNumber}
          {view.review.approvedByLabel ? ` · Approved by ${view.review.approvedByLabel}` : ""}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="card">
        <p className="ck">Ready for approval</p>
        <h2>Review and lock this selection</h2>
        <div className="asum">
          <div className="gi">
            <p className="l">Campaign</p>
            <p className="v">{view.overview.campaignName}</p>
          </div>
          <div className="gi">
            <p className="l">Creators</p>
            <p className="v">
              {counts.accepted} selected · {rosterHeadline(view.creators.length)}
            </p>
          </div>
          <div className="gi">
            <p className="l">Quotation</p>
            <p className={view.commercial.quotationTotal > 0 ? "v" : "v tbc"}>{quotationTotal}</p>
          </div>
          <div className="gi">
            <p className="l">Selected investment</p>
            <p className={selectedCommercial.totalInvestment > 0 ? "v" : "v tbc"}>{investment}</p>
          </div>
          <div className="gi">
            <p className="l">Deliverables</p>
            <p className={deliverableCount > 0 ? "v" : "v tbc"}>
              {deliverableCount > 0 ? `${deliverableCount} items` : TO_BE_CONFIRMED}
            </p>
          </div>
        </div>
        <p className="note">Proposal v{view.review.reviewNumber} · Current</p>
        <div className="checklist">
          <CheckItem done label="Campaign reviewed" />
          <CheckItem done={counts.accepted > 0} label="Creator selection reviewed" />
          <CheckItem done={deliverableCount > 0} label="Deliverables reviewed" />
          <CheckItem done={selectedCommercial.totalInvestment > 0} label="Investment reviewed" />
        </div>
        {error ? <p style={{ color: "var(--bad)", fontSize: 13 }}>{error}</p> : null}
        {view.canDecide ? (
          <div className="dacts" style={{ justifyContent: "flex-start", marginTop: 18 }}>
            <button
              type="button"
              className="btn pri"
              disabled={pending || counts.accepted === 0}
              onClick={() =>
                startTransition(async () => {
                  const result = await decideReviewAction({ token, decision: "approved" });
                  if (!result.ok) setError(result.message);
                  router.refresh();
                })
              }
            >
              <IconCheck />
              Approve selection
            </button>
            <button
              type="button"
              className="btn sec"
              onClick={() => goToSection("feedback")}
            >
              Request changes
            </button>
          </div>
        ) : (
          <p className="note">This proposal is no longer open for decision.</p>
        )}
      </div>

      {view.canDecide ? (
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
                await requestReviewChangesAction({ token, summary, areas });
                router.refresh();
              })
            }
          >
            Send request
          </button>
        </div>
      ) : null}

      {view.canDecide ? (
        <div className="card">
          <p className="ck" style={{ color: "var(--bad)" }}>
            Reject proposal
          </p>
          <h2>Rejecting requires a reason</h2>
          <textarea
            className="f"
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
            placeholder="Why is this proposal being rejected?"
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
                  });
                  if (!result.ok) setError(result.message);
                  router.refresh();
                })
              }
            >
              Reject proposal
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
