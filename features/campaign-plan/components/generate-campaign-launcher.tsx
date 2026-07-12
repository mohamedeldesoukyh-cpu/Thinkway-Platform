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
  const [loadingContext, setLoadingContext] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoadingContext(true);
    void getCampaignPlanExecutionContext({
      campaignObjectId: campaignObject.id,
      conversationId,
    }).then((result) => {
      if (cancelled) return;
      if ("error" in result) {
        setContext(null);
        setError(result.error);
      } else {
        setContext(result);
        setError(null);
      }
      setLoadingContext(false);
    });
    return () => {
      cancelled = true;
    };
  }, [campaignObject.id, conversationId]);

  if (loadingContext) {
    return (
      <p className={cn("text-[11px] text-muted-foreground", className)}>
        Checking Campaign Plan readiness…
      </p>
    );
  }

  if (!context?.canGenerate) return null;

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
      <GenerateCampaignEntry
        campaignObject={campaignObject}
        context={context}
        onGenerate={pending ? undefined : launch}
      />
      {pending ? (
        <p className="text-[11px] text-muted-foreground">Generating execution campaign…</p>
      ) : null}
      {error ? <p className="text-[11px] text-red-500">{error}</p> : null}
    </div>
  );
}
