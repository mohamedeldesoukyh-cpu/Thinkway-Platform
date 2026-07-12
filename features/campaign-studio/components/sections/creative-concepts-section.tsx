"use client";

import { SectionSkeleton } from "./shared/section-skeleton";
import {
  SectionFallbackContent,
  SectionPendingMessage,
  shouldShowPendingPlaceholder,
} from "./shared/section-status-utils";
import { STUDIO_CLASSES } from "../../constants/studio-tokens";
import { resolveCreativeConcepts } from "../../services/section-data-resolver";
import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CampaignStudioSectionStatus } from "../../types/campaign-studio";

type CreativeConceptsSectionProps = {
  campaignObject?: CampaignObject;
  fallbackText: string;
  status: CampaignStudioSectionStatus;
};

export function CreativeConceptsSection({
  campaignObject,
  fallbackText,
  status,
}: CreativeConceptsSectionProps) {
  if (status === "running" && !fallbackText.trim() && !campaignObject) {
    return <SectionSkeleton variant="cards" />;
  }

  const concepts = resolveCreativeConcepts(campaignObject);
  if (concepts.length === 0) {
    if (shouldShowPendingPlaceholder(status, false)) {
      return <SectionPendingMessage label="Creative concepts pending…" />;
    }
    return <SectionFallbackContent text={fallbackText} />;
  }

  return (
    <div className={STUDIO_CLASSES.conceptGrid}>
      {concepts.map((concept, index) => (
        <div key={concept.name} className={STUDIO_CLASSES.conceptCard}>
          <span className="flex size-[22px] items-center justify-center rounded-full bg-[#7C3AED] text-[11px] font-extrabold text-white">
            {index + 1}
          </span>
          <h4 className="mt-2 text-[13.5px] font-extrabold text-foreground">{concept.name}</h4>
          <div className="mt-2 space-y-1.5 text-[11.5px]">
            <div>
              <p className="text-[9px] font-extrabold tracking-[0.4px] text-[#6B7280] uppercase">
                Big Idea
              </p>
              <p className="mt-0.5 leading-snug text-foreground">{concept.bigIdea}</p>
            </div>
            {concept.hook ? (
              <div>
                <p className="text-[9px] font-extrabold tracking-[0.4px] text-[#6B7280] uppercase">
                  Hook
                </p>
                <p className="mt-0.5 leading-snug text-foreground">{concept.hook}</p>
              </div>
            ) : null}
            <div>
              <p className="text-[9px] font-extrabold tracking-[0.4px] text-[#6B7280] uppercase">
                CTA
              </p>
              <p className="mt-0.5 leading-snug text-foreground">{concept.cta}</p>
            </div>
          </div>
          {concept.hashtags.length > 0 ? (
            <div className="mt-2.5 flex flex-wrap gap-1">
              {concept.hashtags.map((tag) => (
                <span key={tag} className={STUDIO_CLASSES.tag}>
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
