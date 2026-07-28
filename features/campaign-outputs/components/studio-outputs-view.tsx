"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import type { CampaignObject, CampaignObjectSnapshot } from "@/features/campaign-intelligence";
import { deserializeCampaignObject } from "@/features/campaign-intelligence";

import { useCampaignObjectOverlay } from "../hooks/use-campaign-object-overlay";
import { listCampaignOutputs, getOutputContentForDisplay } from "../output-registry";
import { CampaignInputCache } from "../output-fingerprint";
import { marketIntelligenceDisplayKey } from "@/features/market-intelligence/market-intelligence-config";
import { reviewCampaign } from "../director/director-engine";
import { outputActionCommand } from "../integration/output-commands";
import { regenerateStaleOutputsAction } from "../actions/regenerate-stale-outputs";
import type { OutputView } from "../output-registry";
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
  /** Studio message id — required for brief edit actions. */
  messageId?: string;
  /** Called after the campaign brief is saved from the Outputs card. */
  onBriefApplied?: (campaignObject: Record<string, unknown>) => void;
  /**
   * Dispatch a Campaign Copilot command — the SAME path chat uses. Card actions
   * and Apply route through here, so there is one execution path and live sync
   * happens through the normal message flow.
   */
  onSendMessage: (message: string) => void;
  /** True while the Copilot is processing a dispatched command. */
  isCopilotStreaming?: boolean;
  /** Amber plan-readiness alert (reference layout). */
  planReadinessBanner?: ReactNode;
  /** Execution Campaign + Quotation cards row. */
  upNextCards?: ReactNode;
  /** Copilot directive — open this output when the view mounts/rebinds. */
  navigateOutputKind?: CampaignOutputKind | string;
};

function buildDisplayContentKey(campaignObject: CampaignObject): string {
  const outputsState = campaignObject.meta.campaignOutputs ?? {};
  const commercials = campaignObject.meta.quotationCommercials;
  const schedule = campaignObject.meta.mediaPlanSchedule;
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
  const scheduleKey = schedule
    ? [
        (schedule.weekWeights ?? []).join(","),
        (schedule.assignments ?? [])
          .map((entry) => `${entry.creatorId}@${entry.week}-${entry.dayIndex}`)
          .join("|"),
        marketIntelligenceDisplayKey(campaignObject),
      ].join(":")
    : marketIntelligenceDisplayKey(campaignObject);
  const presentationKey = JSON.stringify(campaignObject.meta.mediaPlanPresentation ?? null);
  const briefKey = inputCache.inputFingerprint("brief");
  const creatorsKey = inputCache.inputFingerprint("creators");
  const budgetKey = inputCache.inputFingerprint("budget");
  const timelineKey = inputCache.inputFingerprint("timeline");
  const mediaPlan = outputsState.media_plan;
  const mediaPlanStart =
    (mediaPlan?.content?.data as { scheduledStartDate?: string; campaignStartDate?: string } | undefined)
      ?.scheduledStartDate ??
    (mediaPlan?.content?.data as { campaignStartDate?: string } | undefined)?.campaignStartDate ??
    "";
  const outputKeys = Object.entries(outputsState)
    .map(
      ([kind, record]) =>
        `${kind}:${record?.version ?? 0}:${record?.status ?? "none"}:${record?.updatedAt ?? ""}`
    )
    .sort()
    .join("|");
  return `${campaignObject.updatedAt}:${presentationKey}:${commercialsKey}:${scheduleKey}:${briefKey}:${creatorsKey}:${budgetKey}:${timelineKey}:${mediaPlanStart}:${outputKeys}`;
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
  messageId,
  onBriefApplied,
  onSendMessage,
  isCopilotStreaming = false,
  planReadinessBanner,
  upNextCards,
  navigateOutputKind,
}: StudioOutputsViewProps) {
  const { effectiveCampaignObject: overlayCampaignObject, setLocalCampaignObject } =
    useCampaignObjectOverlay(campaignObject);
  const effectiveCampaignObject = overlayCampaignObject ?? campaignObject;

  const displayContentKey = useMemo(
    () => buildDisplayContentKey(effectiveCampaignObject),
    [
      effectiveCampaignObject.id,
      effectiveCampaignObject.updatedAt,
      effectiveCampaignObject.meta.campaignOutputs,
      effectiveCampaignObject.meta.quotationCommercials,
      effectiveCampaignObject.meta.mediaPlanSchedule,
      effectiveCampaignObject.meta.mediaPlanPresentation,
      effectiveCampaignObject.meta.campaignFacts,
      effectiveCampaignObject.sections.summary?.content,
    ]
  );

  const handleBriefApplied = useCallback(
    (raw: Record<string, unknown>) => {
      setLocalCampaignObject(
        deserializeCampaignObject(raw as CampaignObjectSnapshot)
      );
      onBriefApplied?.(raw);
    },
    [onBriefApplied, setLocalCampaignObject]
  );

  const outputs = useMemo(
    () => listCampaignOutputs(effectiveCampaignObject),
    [displayContentKey]
  );

  const getContent = useCallback((kind: CampaignOutputKind) => {
    return getOutputContentForDisplay(effectiveCampaignObject, kind);
  }, [displayContentKey]);

  const [pendingKind, setPendingKind] = useState<CampaignOutputKind | null>(null);
  const [regeneratingAll, setRegeneratingAll] = useState(false);
  const [regenerateError, setRegenerateError] = useState<string | null>(null);
  const pendingBaselineRef = useRef<{
    status: OutputView["status"];
    version: number;
    updatedAt?: string;
  } | null>(null);

  // Keep generating UI until the registry reflects a real change (not merely when streaming stops).
  useEffect(() => {
    if (!pendingKind || isCopilotStreaming) return;

    const view = outputs.find((output) => output.kind === pendingKind);
    const baseline = pendingBaselineRef.current;
    if (!view || !baseline) return;

    const changed =
      view.status !== baseline.status ||
      view.version !== baseline.version ||
      view.updatedAt !== baseline.updatedAt;

    if (changed) {
      setPendingKind(null);
      pendingBaselineRef.current = null;
    }
  }, [outputs, pendingKind, isCopilotStreaming]);

  useEffect(() => {
    if (!pendingKind) return;
    const timeout = window.setTimeout(() => {
      setPendingKind(null);
      pendingBaselineRef.current = null;
    }, 120_000);
    return () => window.clearTimeout(timeout);
  }, [pendingKind]);

  const generatingKind = pendingKind;

  const handleRegenerateAllStale = useCallback(async () => {
    if (!conversationId || regeneratingAll || isCopilotStreaming) return;

    setRegeneratingAll(true);
    setRegenerateError(null);

    const result = await regenerateStaleOutputsAction({
      conversationId,
      campaignObjectId: effectiveCampaignObject.id,
    });

    setRegeneratingAll(false);

    if (!result.ok) {
      setRegenerateError(result.message);
      return;
    }

    const next = deserializeCampaignObject(result.campaignObject as CampaignObjectSnapshot);
    setLocalCampaignObject(next);
    onBriefApplied?.(result.campaignObject);
  }, [
    conversationId,
    regeneratingAll,
    isCopilotStreaming,
    effectiveCampaignObject.id,
    setLocalCampaignObject,
    onBriefApplied,
  ]);

  const directorReview = useMemo(
    () => reviewCampaign(effectiveCampaignObject),
    [displayContentKey]
  );

  const actions = useMemo<OutputCardActions>(
    () => ({
      onRegenerate: (kind) => {
        // One Copilot request per user action — ignore clicks while a turn is in flight.
        if (isCopilotStreaming) return;
        const view = outputs.find((o) => o.kind === kind);
        if (view) {
          pendingBaselineRef.current = {
            status: view.status,
            version: view.version,
            updatedAt: view.updatedAt,
          };
        }
        setPendingKind(kind);
        onSendMessage(
          outputActionCommand(view && view.status === "not_generated" ? "generate" : "regenerate", kind)
        );
      },
      onExport: (kind) => {
        if (isCopilotStreaming) return;
        onSendMessage(outputActionCommand("export", kind));
      },
      onCompare: (kind) => {
        if (isCopilotStreaming) return;
        onSendMessage(outputActionCommand("compare", kind));
      },
      onHistory: (kind) => {
        if (isCopilotStreaming) return;
        onSendMessage(
          kind === "media_plan"
            ? "Show Media Plan version history and compare the last two versions"
            : outputActionCommand("compare", kind)
        );
      },
    }),
    [outputs, onSendMessage, isCopilotStreaming]
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
      campaignObject={effectiveCampaignObject}
      outputs={outputs}
      generatingKind={generatingKind}
      regeneratingAll={regeneratingAll}
      onRegenerateAllStale={
        conversationId ? handleRegenerateAllStale : undefined
      }
      regenerateAllError={regenerateError}
      regenerateAllDisabled={isCopilotStreaming}
      getContent={getContent}
      campaignObjectId={effectiveCampaignObject.id}
      conversationId={conversationId}
      messageId={messageId}
      onBriefApplied={handleBriefApplied}
      onCampaignObjectUpdated={setLocalCampaignObject}
      actions={actions}
      planReadinessBanner={planReadinessBanner}
      upNextCards={upNextCards}
      navigateOutputKind={navigateOutputKind}
    />
  );
}
