"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import type { CampaignObject } from "@/features/campaign-intelligence";

import {
  generateQuotationFromPlanAction,
  getCampaignPlanQuotationContext,
  type CampaignPlanQuotationContext,
} from "../actions/generate-quotation-from-plan";
import { CampaignPlanLifecycleHint } from "./campaign-plan-lifecycle-hint";
import { GenerateQuotationEntry } from "./generate-quotation-entry";

export type GenerateQuotationLauncherProps = {
  campaignObject: CampaignObject;
  conversationId?: string;
  className?: string;
};

export function GenerateQuotationLauncher({
  campaignObject,
  conversationId,
  className,
}: GenerateQuotationLauncherProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [context, setContext] = useState<CampaignPlanQuotationContext | null>(null);
  const [loadingContext, setLoadingContext] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoadingContext(true);
    void getCampaignPlanQuotationContext({
      campaignObjectId: campaignObject.id,
      conversationId,
    }).then((quotationResult) => {
      if (cancelled) return;
      if ("error" in quotationResult) {
        setContext(null);
        setError(quotationResult.error);
      } else {
        setContext(quotationResult);
        setError(null);
      }
      setLoadingContext(false);
    });
    return () => {
      cancelled = true;
    };
  }, [campaignObject, campaignObject.id, conversationId]);

  if (loadingContext) {
    return (
      <p className={cn("text-[11px] text-muted-foreground", className)}>
        Checking quotation readiness…
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
      const result = await generateQuotationFromPlanAction({
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
      />
      <GenerateQuotationEntry
        campaignObject={campaignObject}
        context={context}
        onGenerate={context.canGenerate && !pending ? launch : undefined}
      />
      {pending ? (
        <p className="text-[11px] text-muted-foreground">Generating quotation…</p>
      ) : null}
      {error ? <p className="text-[11px] text-red-500">{error}</p> : null}
    </div>
  );
}
