"use client";

import { useEffect, useState } from "react";

import type { CampaignObject } from "@/features/campaign-intelligence";
import { getCampaignPlanExecutionContext } from "@/features/campaign-plan/actions/generate-campaign-from-plan";
import { CampaignPlanLifecycleHint } from "@/features/campaign-plan/components/campaign-plan-lifecycle-hint";

export type OutputsPlanReadinessBannerProps = {
  campaignObject: CampaignObject;
  conversationId?: string;
};

/**
 * Amber alert above the Outputs up-next grid when the plan is not yet approved.
 */
export function OutputsPlanReadinessBanner({
  campaignObject,
  conversationId,
}: OutputsPlanReadinessBannerProps) {
  const [lifecycleStatus, setLifecycleStatus] = useState<string | null>(null);
  const [canGenerate, setCanGenerate] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void getCampaignPlanExecutionContext({
      campaignObjectId: campaignObject.id,
      conversationId,
    }).then((result) => {
      if (cancelled || !result || "error" in result) return;
      setLifecycleStatus(result.lifecycleStatus);
      setCanGenerate(result.canGenerate);
    });
    return () => {
      cancelled = true;
    };
  }, [campaignObject.id, campaignObject.updatedAt, conversationId]);

  if (!lifecycleStatus) return null;

  return (
    <CampaignPlanLifecycleHint
      lifecycleStatus={lifecycleStatus}
      canGenerate={canGenerate}
      variant="banner"
    />
  );
}
