"use client";

/**
 * Temporary hierarchy review surface — mounts the live CampaignStudioPanel (variant=main)
 * with a fixture Campaign Object. Not linked from product nav. Remove after hierarchy sign-off.
 */

import { useMemo, useState } from "react";

import { CampaignStudioPanel } from "@/features/ai-workspace/components/campaign-studio-panel";
import type { AiMessage } from "@/features/ai-workspace/types";
import { buildCampaignObjectFixture } from "@/features/campaign-outputs/output-test-fixture";

const HIERARCHY_PREVIEW_CONVERSATION_ID = "00000000-0000-4000-8000-000000000002";

export default function CampaignModeHierarchyPreviewPage() {
  const [viewHint, setViewHint] = useState<
    "studio" | "outputs" | "director" | "decision" | undefined
  >(undefined);

  const message = useMemo((): AiMessage => {
    const campaignObject = buildCampaignObjectFixture({
      facts: {
        brandName: "Tafareeh Tea",
        clientName: "Tafareeh",
        objective: "Ramadan 2026 brand lift",
        geography: ["Egypt"],
        platforms: ["Instagram", "TikTok", "YouTube"],
        budget: { amount: 1_200_000, currency: "EGP" },
        durationWeeks: 6,
      },
    });
    // Ensure Decision mode unlocks for hierarchy review
    (campaignObject.meta as { workflowStatus?: string }).workflowStatus = "completed";
    campaignObject.id = "TW-2026-0124";
    return {
      id: "hierarchy-preview-msg",
      conversationId: HIERARCHY_PREVIEW_CONVERSATION_ID,
      role: "assistant",
      content: "Campaign Studio hierarchy preview",
      createdAt: new Date().toISOString(),
      metadata: {
        workflow: true,
        // Must be create-campaign — useCampaignStudio no-ops on any other workflowId.
        workflowId: "create-campaign",
        workflowName: "Tafareeh Tea — Ramadan 2026",
        workflowStatus: "completed",
        workflowStep: 6,
        workflowTotalSteps: 6,
        completedTasks: ["intake", "strategy", "creators", "content", "commercial", "package"],
        pendingTasks: [],
        campaignObject,
      },
    };
  }, []);

  return (
    <div className="flex h-screen flex-col bg-[#E8ECF2]">
      <div className="flex flex-wrap items-center gap-2 bg-[#0B0F1A] px-3 py-2 text-white">
        <b className="text-xs tracking-wide">Live panel hierarchy review</b>
        {(
          [
            ["studio", "1 · Studio"],
            ["outputs", "2 · Outputs"],
            ["director", "3 · Director"],
            ["decision", "4 · Decision"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className="rounded-md bg-white/15 px-2.5 py-1 text-[11px] font-semibold hover:bg-[#0057FF]"
            onClick={() => setViewHint(id)}
          >
            {label}
          </button>
        ))}
        <span className="text-[11px] text-white/60">
          Remounts panel with initialView — use in-panel tabs for true live switch
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden p-3">
        <div className="h-full overflow-hidden rounded-2xl border border-[#CFD6E4] bg-white shadow-lg">
          <CampaignStudioPanel
            key={viewHint ?? "default"}
            message={message}
            conversationId={HIERARCHY_PREVIEW_CONVERSATION_ID}
            variant="main"
            initialView={viewHint}
            onSendMessage={() => {}}
          />
        </div>
      </div>
    </div>
  );
}
