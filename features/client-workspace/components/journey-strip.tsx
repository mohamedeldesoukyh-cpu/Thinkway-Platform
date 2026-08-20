"use client";

import {
  QUOTATION_STAGE_LABEL,
  SHORTLIST_STAGE_LABEL,
  quotationStageTone,
  shortlistStageTone,
  type ClientJourneyNodeId,
  type ClientJourneyNodeTone,
} from "../journey-state";
import type { ClientWorkspaceView } from "../types";

const NODES: Array<{ id: ClientJourneyNodeId; label: string }> = [
  { id: "shortlist", label: "Shortlist" },
  { id: "quotation", label: "Quotation" },
  { id: "final_approval", label: "Final Approval" },
  { id: "campaign", label: "Campaign" },
  { id: "performance", label: "Performance" },
  { id: "invoice", label: "Invoice" },
];

function nodeCopy(view: ClientWorkspaceView, id: ClientJourneyNodeId): { label: string; tone: ClientJourneyNodeTone } {
  const journey = view.journey;
  if (!journey) {
    return { label: "—", tone: "idle" };
  }
  if (id === "shortlist") {
    return { label: SHORTLIST_STAGE_LABEL[journey.shortlistStage], tone: shortlistStageTone(journey.shortlistStage) };
  }
  if (id === "quotation") {
    return { label: QUOTATION_STAGE_LABEL[journey.quotationStage], tone: quotationStageTone(journey.quotationStage) };
  }
  if (id === "final_approval") {
    if (journey.quotationStage === "approved") return { label: "Approved", tone: "ok" };
    if (journey.quotationStage === "rejected") return { label: "Rejected", tone: "bad" };
    if (journey.quotationStage === "updated") return { label: "Approval required", tone: "attention" };
    if (journey.canApproveQuotation) return { label: "Awaiting client", tone: "active" };
    return { label: "Not started", tone: "idle" };
  }
  if (id === "campaign") {
    return journey.campaignStarted
      ? { label: "In campaign", tone: "ok" }
      : { label: "Not started", tone: "idle" };
  }
  if (id === "performance") {
    return journey.performanceStarted
      ? { label: "Available in campaign", tone: "active" }
      : { label: "Not started", tone: "idle" };
  }
  return { label: "Not started", tone: "idle" };
}

export function ClientJourneyStrip({ view }: { view: ClientWorkspaceView }) {
  return (
    <nav className="journey" aria-label="Campaign journey">
      <div className="wrap journey-row">
        {NODES.map((node, index) => {
          const copy = nodeCopy(view, node.id);
          return (
            <div key={node.id} className={`journey-node tone-${copy.tone}`}>
              {index > 0 ? <span className="journey-arrow" aria-hidden="true" /> : null}
              <div>
                <p className="journey-k">{node.label}</p>
                <p className="journey-v">{copy.label}</p>
              </div>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
