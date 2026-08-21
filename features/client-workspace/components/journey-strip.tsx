"use client";

import type { ClientJourneyNodeTone } from "../journey-state";
import {
  campaignStageCopy,
  commercialStageCopy,
  isPricedClientInvestment,
  isValidClientCommercialApproval,
  selectionCalculator,
  selectionStageCopy,
  shortlistStageCopy,
} from "../selection-flow";
import type { ClientWorkspaceView } from "../types";
import { useClientWorkspaceState } from "./client-workspace-state";

const NODES: Array<{ id: "shortlist" | "selection" | "commercial" | "campaign"; label: string; hint: string }> = [
  { id: "shortlist", label: "Creator Shortlist", hint: "What creators does Thinkway recommend?" },
  { id: "selection", label: "Your Selection", hint: "Which creators do you want?" },
  { id: "commercial", label: "Commercial", hint: "What is the final investment?" },
  { id: "campaign", label: "Campaign", hint: "Has the campaign started?" },
];

function nodeCopy(
  view: ClientWorkspaceView,
  id: (typeof NODES)[number]["id"],
  calc: ReturnType<typeof selectionCalculator>
): { label: string; tone: ClientJourneyNodeTone } {
  const journey = view.journey;
  if (!journey) return { label: "—", tone: "idle" };
  const commerciallyApproved = isValidClientCommercialApproval({
    quotationStage: journey.quotationStage,
    selectedCount: calc.selectedCount,
  });
  if (id === "shortlist") {
    return shortlistStageCopy({ available: Boolean(journey.shortlistId) || view.creators.length > 0 });
  }
  if (id === "selection") {
    if (journey.historical) return { label: "Historical", tone: "idle" };
    return selectionStageCopy({
      selectedCount: calc.selectedCount,
      selectionConfirmed: Boolean(journey.selectionConfirmed),
      commerciallyApproved,
    });
  }
  if (id === "commercial") {
    return commercialStageCopy({
      quotationStage: journey.quotationStage,
      selectedCount: calc.selectedCount,
      pricedSelectedCount: calc.pricedSelectedCount,
      pricedInvestment: calc.pricedInvestment,
      currency: view.commercial.currency,
      selectionConfirmed: Boolean(journey.selectionConfirmed),
      hasAnyPrice: view.creators.some((creator) => isPricedClientInvestment(creator.investmentAmount)),
    });
  }
  return campaignStageCopy({
    campaignStarted: journey.campaignStarted,
    commerciallyApproved,
  });
}

export function ClientJourneyStrip({ view }: { view: ClientWorkspaceView }) {
  const { selection } = useClientWorkspaceState();
  const calc = selectionCalculator(view.creators, selection);
  return (
    <nav className="journey" aria-label="Campaign journey">
      <div className="wrap journey-row">
        {NODES.map((node, index) => {
          const copy = nodeCopy(view, node.id, calc);
          return (
            <div key={node.id} className={`journey-node tone-${copy.tone}`}>
              {index > 0 ? <span className="journey-arrow" aria-hidden="true" /> : null}
              <div>
                <p className="journey-k">
                  {index + 1} {node.label}
                </p>
                <p className="journey-v">{copy.label}</p>
                <p className="journey-h">{node.hint}</p>
              </div>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
