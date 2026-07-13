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
import { CampaignPlanLifecycleHint } from "./campaign-plan-lifecycle-hint";
import { GenerateCampaignEntry } from "./generate-campaign-entry";

export type GenerateCampaignLauncherProps = {
  campaignObject: CampaignObject;
  conversationId?: string;
  className?: string;
  /** When false, lifecycle hint is omitted (e.g. parent shows one shared hint). */
  showLifecycleHint?: boolean;
  variant?: "default" | "compact";
};

export function GenerateCampaignLauncher({
  campaignObject,
  conversationId,
  className,
  showLifecycleHint = true,
  variant = "default",
}: GenerateCampaignLauncherProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [context, setContext] = useState<CampaignPlanExecutionContext | null>(null);
  const [loadingContext, setLoadingContext] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoadingContext(true);
    void getCampaignPlanExecutionContext({
      campaignObjectId: campaignObject.id,
      conversationId,
    })
      .then((executionResult) => {
        if (cancelled) return;
        if (executionResult === null) {
          setContext(null);
          setError(null);
          return;
        }
        if ("error" in executionResult) {
          setContext(null);
          setError(executionResult.error);
        } else {
          setContext(executionResult);
          setError(null);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setContext(null);
        setError("Failed to load campaign generation context.");
      })
      .finally(() => {
        if (!cancelled) setLoadingContext(false);
      });
    return () => {
      cancelled = true;
    };
  }, [campaignObject.id, campaignObject.updatedAt, conversationId]);

  if (loadingContext) {
    return null;
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

  const compact = variant === "compact";

  return (
    <div className={cn(compact ? "" : "space-y-2", className)}>
      {showLifecycleHint ? (
        <CampaignPlanLifecycleHint
          lifecycleStatus={context.lifecycleStatus}
          canGenerate={context.canGenerate}
          className={
            compact
              ? "rounded-none border-x-0 border-t-0 px-2.5 py-1.5 text-[10px] leading-snug"
              : undefined
          }
        />
      ) : null}
      <GenerateCampaignEntry
        campaignObject={campaignObject}
        context={context}
        variant={variant}
        onGenerate={context.canGenerate && !pending ? launch : undefined}
      />
      {pending ? (
        <p
          className={cn(
            "text-muted-foreground",
            compact ? "px-2.5 pb-1 text-[10px]" : "text-[11px]"
          )}
        >
          Generating execution campaign…
        </p>
      ) : null}
      {error ? (
        <p className={cn("text-red-500", compact ? "px-2.5 pb-1 text-[10px]" : "text-[11px]")}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
