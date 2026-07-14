"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { CampaignObject } from "@/features/campaign-intelligence";

import { listCampaignOutputs, getOutputContentForDisplay } from "../output-registry";
import { CampaignInputCache } from "../output-fingerprint";
import { reviewCampaign } from "../director/director-engine";
import { outputActionCommand } from "../integration/output-commands";
import type { CampaignOutputKind } from "../output-types";
import { OutputsCenter } from "./outputs-center";
import type { OutputCardActions } from "./output-card";
import { DirectorRecommendationsPanel } from "./director-recommendations-panel";

export type StudioOutputsViewProps = {
  /** The live Campaign Object (SSOT). Everything below derives from it. */
  campaignObject: CampaignObject;
  /** Which mounted surface to show. */
  mode: "outputs" | "director";
  /** Optional conversation id for export API snapshot resolution. */
  conversationId?: string;
  /**
   * Dispatch a Campaign Copilot command — the SAME path chat uses. Card actions
   * and Apply route through here, so there is one execution path and live sync
   * happens through the normal message flow.
   */
  onSendMessage: (message: string) => void;
  /** True while the Copilot is processing a dispatched command. */
  isCopilotStreaming?: boolean;
};

function buildDisplayContentKey(campaignObject: CampaignObject): string {
  const outputsState = campaignObject.meta.campaignOutputs ?? {};
  const commercials = campaignObject.meta.quotationCommercials;
  const inputCache = new CampaignInputCache(campaignObject);
  const commercialsKey = commercials
    ? [
        commercials.syncedAt,
        commercials.creators.length,
        commercials.clientName ?? "",
        commercials.brandName ?? "",
        commercials.groupName ?? "",
        commercials.agencyOrDirect ?? "",
        commercials.agencyName ?? "",
      ].join(":")
    : "";
  const creatorsKey = inputCache.inputFingerprint("creators");
  const budgetKey = inputCache.inputFingerprint("budget");
  const outputKeys = Object.entries(outputsState)
    .map(([kind, record]) => `${kind}:${record?.version ?? 0}:${record?.status ?? "none"}`)
    .sort()
    .join("|");
  return `${campaignObject.updatedAt}:${commercialsKey}:${creatorsKey}:${budgetKey}:${outputKeys}`;
}

/**
 * Mounts the Campaign Outputs Center and the AI Campaign Director inside the
 * Studio. Read state comes from the live Campaign Object; every mutating action
 * dispatches an existing Copilot command (no duplicated execution paths, no
 * duplicated logic).
 */
export function StudioOutputsView({
  campaignObject,
  mode,
  conversationId,
  onSendMessage,
  isCopilotStreaming = false,
}: StudioOutputsViewProps) {
  const campaignObjectRef = useRef(campaignObject);
  campaignObjectRef.current = campaignObject;

  const displayContentKey = useMemo(
    () => buildDisplayContentKey(campaignObject),
    [
      campaignObject.id,
      campaignObject.updatedAt,
      campaignObject.meta.campaignOutputs,
      campaignObject.meta.quotationCommercials,
    ]
  );

  const outputs = useMemo(
    () => listCampaignOutputs(campaignObjectRef.current),
    [displayContentKey]
  );

  const getContent = useCallback((kind: CampaignOutputKind) => {
    return getOutputContentForDisplay(campaignObjectRef.current, kind);
  }, [displayContentKey]);

  const [pendingKind, setPendingKind] = useState<CampaignOutputKind | null>(null);
  const wasStreamingRef = useRef(false);

  useEffect(() => {
    if (isCopilotStreaming) {
      wasStreamingRef.current = true;
      return;
    }
    if (wasStreamingRef.current) {
      wasStreamingRef.current = false;
      setPendingKind(null);
    }
  }, [isCopilotStreaming]);

  useEffect(() => {
    if (!pendingKind) return;
    const timeout = window.setTimeout(() => setPendingKind(null), 120_000);
    return () => window.clearTimeout(timeout);
  }, [pendingKind]);

  const generatingKind = pendingKind;

  const directorReview = useMemo(
    () => reviewCampaign(campaignObjectRef.current),
    [displayContentKey]
  );

  const actions = useMemo<OutputCardActions>(
    () => ({
      onRegenerate: (kind) => {
        const view = outputs.find((o) => o.kind === kind);
        setPendingKind(kind);
        onSendMessage(
          outputActionCommand(view && view.status === "not_generated" ? "generate" : "regenerate", kind)
        );
      },
      onExport: (kind) => onSendMessage(outputActionCommand("export", kind)),
      onCompare: (kind) => onSendMessage(outputActionCommand("compare", kind)),
    }),
    [outputs, onSendMessage]
  );

  if (mode === "director") {
    return (
      <div className="p-4 sm:p-5">
        <DirectorRecommendationsPanel
          summary={directorReview.summary}
          recommendations={directorReview.recommendations}
          onApply={(command) => onSendMessage(command)}
        />
      </div>
    );
  }

  return (
    <OutputsCenter
      className="h-full min-h-0"
      campaignObject={campaignObject}
      outputs={outputs}
      generatingKind={generatingKind}
      getContent={getContent}
      campaignObjectId={campaignObject.id}
      conversationId={conversationId}
      actions={actions}
    />
  );
}
