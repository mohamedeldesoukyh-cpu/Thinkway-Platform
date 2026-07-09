"use client";

import { ExecutiveCard } from "./shared/executive-card";
import { SectionSkeleton } from "./shared/section-skeleton";
import {
  SectionFallbackContent,
  SectionPendingMessage,
  shouldShowPendingPlaceholder,
} from "./shared/section-status-utils";
import {
  executiveStrategyReasoningToFields,
  resolveExecutiveStrategyReasoning,
  resolveGroundedStrategyFields,
} from "../../services/section-data-resolver";
import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CampaignStudioSectionStatus } from "../../types/campaign-studio";

type ExecutiveStrategySectionProps = {
  campaignObject?: CampaignObject;
  fallbackText: string;
  status: CampaignStudioSectionStatus;
};

export function ExecutiveStrategySection({
  campaignObject,
  fallbackText,
  status,
}: ExecutiveStrategySectionProps) {
  if (status === "running" && !campaignObject) {
    return <SectionSkeleton variant="cards" />;
  }

  const reasoning = resolveExecutiveStrategyReasoning(campaignObject);
  const fields = reasoning
    ? executiveStrategyReasoningToFields(reasoning)
    : resolveGroundedStrategyFields(campaignObject);
  if (fields.length === 0) {
    if (shouldShowPendingPlaceholder(status, false)) {
      return <SectionPendingMessage label="Executive strategy pending…" />;
    }
    return <SectionFallbackContent text={fallbackText} />;
  }

  return (
    <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
      {fields.map((field) => (
        <ExecutiveCard
          key={field.label}
          label={field.label}
          value={field.value}
          accent={field.grounding.source === "Client" ? "green" : field.grounding.source === "Industry" ? "purple" : "neutral"}
          grounding={field.grounding}
        />
      ))}
    </div>
  );
}
