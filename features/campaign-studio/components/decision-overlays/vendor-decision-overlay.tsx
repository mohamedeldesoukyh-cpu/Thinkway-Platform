"use client";

import type { CampaignStudioDecisionMode } from "@/features/campaign-decision-workspace/types/studio-decision-mode";
import { ClientCreatorEvaluator } from "@/features/campaign-decision-workspace/components/client-creator-evaluator";
import { CreatorActionControls } from "@/features/campaign-decision-workspace/components/creator-action-controls";
import { cn } from "@/lib/utils";

type VendorDecisionOverlayProps = {
  decisionMode: CampaignStudioDecisionMode;
  className?: string;
};

export function VendorDecisionOverlay({ decisionMode, className }: VendorDecisionOverlayProps) {
  return (
    <div className={cn("mt-4 space-y-3", className)}>
      <div className="rounded-xl border border-violet-300/40 bg-violet-50/50 p-3 dark:border-violet-800 dark:bg-violet-950/20">
        <p className="mb-2 text-xs font-medium text-violet-700 dark:text-violet-300">
          Decision Mode · Creator Actions
        </p>
        <p className="mb-2 text-[11px] text-muted-foreground">
          Click a creator above to open profile · Apply sandbox actions below
        </p>
        <CreatorActionControls
          creators={decisionMode.creators}
          onAction={decisionMode.onCreatorAction}
          bare
        />
      </div>

      <ClientCreatorEvaluator
        assessments={decisionMode.clientCreatorAssessments}
        onEvaluateUrls={decisionMode.evaluateClientCreatorUrls}
      />
    </div>
  );
}
