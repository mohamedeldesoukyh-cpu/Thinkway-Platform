"use client";

import { cn } from "@/lib/utils";

export type CampaignPlanLifecycleHintProps = {
  lifecycleStatus: string;
  canGenerate: boolean;
  canSubmitForReview?: boolean;
  className?: string;
};

export function CampaignPlanLifecycleHint({
  lifecycleStatus,
  canGenerate,
  canSubmitForReview,
  className,
}: CampaignPlanLifecycleHintProps) {
  if (canGenerate) return null;

  let message: string;
  if (lifecycleStatus === "in_review") {
    message =
      "Awaiting Campaign Director approval. Quotation and execution generation unlock after the plan is approved.";
  } else if (lifecycleStatus === "draft" && canSubmitForReview) {
    message =
      "Submit the Campaign Plan for director review from the Presentation section to unlock generation.";
  } else if (lifecycleStatus === "draft") {
    message =
      "Complete key sections and submit the Campaign Plan for review before generating outputs.";
  } else {
    message = `Campaign Plan is ${lifecycleStatus.replaceAll("_", " ")}. Approval is required before generation.`;
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
