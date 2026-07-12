"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import type { CampaignObject } from "@/features/campaign-intelligence";

import {
  generateCampaignFromPlanAction,
  getCampaignPlanExecutionContext,
  type CampaignPlanExecutionContext,
} from "../actions/generate-campaign-from-plan";
import { getCampaignPlanApprovalContext } from "../actions/campaign-plan-approval";
import { CampaignPlanLifecycleHint } from "./campaign-plan-lifecycle-hint";
import { GenerateCampaignEntry } from "./generate-campaign-entry";

export type GenerateCampaignLauncherProps = {
  campaignObject: CampaignObject;
  conversationId?: string;
  className?: string;
};

export function GenerateCampaignLauncher({
  campaignObject,
  conversationId,
  className,
}: GenerateCampaignLauncherProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [context, setContext] = useState<CampaignPlanExecutionContext | null>(null);
  const [canSubmitForReview, setCanSubmitForReview] = useState(false);
  const [loadingContext, setLoadingContext] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoadingContext(true);
    void Promise.all([
      getCampaignPlanExecutionContext({
        campaignObjectId: campaignObject.id,
        conversationId,
      }),
      getCampaignPlanApprovalContext({
        campaignObjectId: campaignObject.id,
        conversationId,
        campaignObject,
      }),
    ]).then(([executionResult, approvalResult]) => {
      if (cancelled) return;
      if ("error" in executionResult) {
        setContext(null);
        setError(executionResult.error);
      } else {
        setContext(executionResult);
        setError(null);
      }
      setCanSubmitForReview(
        !("error" in approvalResult) && approvalResult.canSubmitForReview
      );
      setLoadingContext(false);
    });
    return () => {
      cancelled = true;
    };
  }, [campaignObject, campaignObject.id, conversationId]);

  if (loadingContext) {
    return (
      <p className={cn("text-[11px] text-muted-foreground", className)}>
        Checking Campaign Plan readiness…
      </p>
    );
  }

  if (!context) {
    return error ? (
      <p className={cn("text-[11px] text-red-500", className)}>{error}</p>
    ) : null;
  }

  const launch = () => {
    startTransition(async () => {
      setError(null);
      const result = await generateCampaignFromPlanAction({
        campaignObjectId: campaignObject.id,
        conversationId,
        brandId: context.brandId ?? undefined,
      });
      if (result.ok) router.push(result.href);
      else setError(result.message);
    });
  };

  return (
    <div className={cn("space-y-2", className)}>
      <CampaignPlanLifecycleHint
        lifecycleStatus={context.lifecycleStatus}
        canGenerate={context.canGenerate}
        canSubmitForReview={canSubmitForReview}
      />
      <GenerateCampaignEntry
        campaignObject={campaignObject}
        context={context}
        onGenerate={context.canGenerate && !pending ? launch : undefined}
      />
      {pending ? (
        <p className="text-[11px] text-muted-foreground">Generating execution campaign…</p>
      ) : null}
      {error ? <p className="text-[11px] text-red-500">{error}</p> : null}
    </div>
  );
}
