"use client";

import { useMemo } from "react";

import type { CampaignObject } from "@/features/campaign-intelligence";

import { listCampaignOutputs, getCampaignOutput } from "../output-registry";
import { reviewCampaign } from "../director/director-engine";
import { outputActionCommand } from "../integration/output-commands";
import { OutputsCenter } from "./outputs-center";
import type { OutputCardActions } from "./output-card";
import { DirectorRecommendationsPanel } from "./director-recommendations-panel";

export type StudioOutputsViewProps = {
  /** The live Campaign Object (SSOT). Everything below derives from it. */
  campaignObject: CampaignObject;
  /** Which mounted surface to show. */
  mode: "outputs" | "director";
  /**
   * Dispatch a Campaign Copilot command — the SAME path chat uses. Card actions
   * and Apply route through here, so there is one execution path and live sync
   * happens through the normal message flow.
   */
  onSendMessage: (message: string) => void;
};

/**
 * Mounts the Campaign Outputs Center and the AI Campaign Director inside the
 * Studio. Read state comes from the live Campaign Object; every mutating action
 * dispatches an existing Copilot command (no duplicated execution paths, no
 * duplicated logic).
 */
export function StudioOutputsView({ campaignObject, mode, onSendMessage }: StudioOutputsViewProps) {
  const outputs = useMemo(() => listCampaignOutputs(campaignObject), [campaignObject]);

  const actions = useMemo<OutputCardActions>(
    () => ({
      // "Generate" vs "Regenerate" is decided from the output's current status.
      onRegenerate: (kind) => {
        const view = outputs.find((o) => o.kind === kind);
        onSendMessage(
          outputActionCommand(view && view.status === "not_generated" ? "generate" : "regenerate", kind)
        );
      },
      onExport: (kind) => onSendMessage(outputActionCommand("export", kind)),
      onCompare: (kind) => onSendMessage(outputActionCommand("compare", kind)),
      // Open/Preview render locally from the cached view; nothing to dispatch.
    }),
    [outputs, onSendMessage]
  );

  if (mode === "director") {
    const review = reviewCampaign(campaignObject);
    return (
      <div className="p-4 sm:p-5">
        <DirectorRecommendationsPanel
          summary={review.summary}
          recommendations={review.recommendations}
          onApply={(command) => onSendMessage(command)}
        />
      </div>
    );
  }

  return (
    <OutputsCenter
      outputs={outputs}
      getContent={(kind) => getCampaignOutput(campaignObject, kind)?.content}
      actions={actions}
    />
  );
}
