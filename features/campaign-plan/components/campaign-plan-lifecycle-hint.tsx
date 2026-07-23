"use client";

import { AlertCircleIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type CampaignPlanLifecycleHintProps = {
  lifecycleStatus: string;
  canGenerate: boolean;
  className?: string;
  variant?: "inline" | "banner";
};

export function CampaignPlanLifecycleHint({
  lifecycleStatus,
  canGenerate,
  className,
  variant = "inline",
}: CampaignPlanLifecycleHintProps) {
  if (canGenerate) return null;

  let message: string;
  if (lifecycleStatus === "in_review") {
    message =
      "Awaiting Campaign Director approval. Quotation and execution generation unlock after the plan is approved.";
  } else if (lifecycleStatus === "draft") {
    message =
      "Complete the Campaign Plan readiness checklist and submit for director review from the Presentation section.";
  } else {
    message = `Campaign Plan is ${lifecycleStatus.replaceAll("_", " ")}. Approval is required before generation.`;
  }

  if (variant === "banner") {
    return (
      <div className={cn("oc-alert-banner", className)}>
        <AlertCircleIcon aria-hidden />
        <p>{message}</p>
      </div>
    );
  }

  return (
    <p
      className={cn(
        "rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-800 dark:text-amber-200",
        className
      )}
    >
      {message}
    </p>
  );
}
