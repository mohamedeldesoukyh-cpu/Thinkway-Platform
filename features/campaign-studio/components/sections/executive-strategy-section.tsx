"use client";

import { SectionSkeleton } from "./shared/section-skeleton";
import {
  SectionFallbackContent,
  SectionPendingMessage,
  shouldShowPendingPlaceholder,
} from "./shared/section-status-utils";
import { ReasonCard } from "./shared/studio-ui-primitives";
import { STUDIO_CLASSES } from "../../constants/studio-tokens";
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
    <div className={STUDIO_CLASSES.reasonGrid}>
      {fields.map((field) => (
        <ReasonCard
          key={field.label}
          label={field.label}
          value={field.value}
          badge={
            field.grounding.confidence != null
              ? `${field.grounding.confidence}%`
              : undefined
          }
        />
      ))}
    </div>
  );
}
