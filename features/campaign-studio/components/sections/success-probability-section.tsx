"use client";

import { SectionSkeleton } from "./shared/section-skeleton";
import {
  SectionFallbackContent,
  SectionPendingMessage,
  shouldShowPendingPlaceholder,
} from "./shared/section-status-utils";
import { QuadCard } from "./shared/studio-ui-primitives";
import { STUDIO_CLASSES } from "../../constants/studio-tokens";
import { resolveSuccessProbability } from "../../services/section-data-resolver";
import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CampaignStudioSectionStatus } from "../../types/campaign-studio";

type SuccessProbabilitySectionProps = {
  campaignObject?: CampaignObject;
  fallbackText: string;
  status: CampaignStudioSectionStatus;
};

export function SuccessProbabilitySection({
  campaignObject,
  fallbackText,
  status,
}: SuccessProbabilitySectionProps) {
  if (status === "running" && !fallbackText.trim() && !campaignObject) {
    return <SectionSkeleton variant="cards" />;
  }

  const data = resolveSuccessProbability(campaignObject);
  if (!data) {
    if (shouldShowPendingPlaceholder(status, false)) {
      return <SectionPendingMessage label="Success probability pending…" />;
    }
    return <SectionFallbackContent text={fallbackText} />;
  }

  return (
    <div className="min-w-0 space-y-3.5">
      <div className={STUDIO_CLASSES.scoreWrap}>
        <p className="text-[38px] font-black leading-none text-[#0C9D57]">{data.score}%</p>
        <div className="min-w-0 flex-1">
          <div className="h-2 overflow-hidden rounded-lg bg-[#E4E9F5] dark:bg-muted">
            <span
              className="block h-full rounded-lg bg-[#0C9D57]"
              style={{ width: `${data.score}%` }}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-[#6B7280]">
            Objective Achievement Assessment — scored from campaign facts and Director strategy
          </p>
        </div>
      </div>

      <div className={STUDIO_CLASSES.quadGrid}>
        <QuadCard label="Top Strengths" items={data.strengths} labelColor="text-[#0C9D57]" />
        <QuadCard label="Weaknesses" items={data.weaknesses} labelColor="text-[#D97706]" />
        <QuadCard label="Risks" items={data.risks} labelColor="text-[#D6336C]" />
        <QuadCard label="How To Improve" items={data.improvements} labelColor="text-[#0057FF]" />
      </div>
    </div>
  );
}
