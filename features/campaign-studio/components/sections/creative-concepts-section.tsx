"use client";

import { SectionSkeleton } from "./shared/section-skeleton";
import {
  SectionFallbackContent,
  SectionPendingMessage,
  shouldShowPendingPlaceholder,
} from "./shared/section-status-utils";
import {
  ConceptCard,
  ConceptGrid,
  ConceptRow,
  MiniTag,
  TagRow,
} from "./shared/studio-ui-primitives";
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
    <ConceptGrid>
      {concepts.map((concept, index) => (
        <ConceptCard key={concept.name} index={index + 1} title={concept.name}>
          <ConceptRow label="Big idea" value={concept.bigIdea} />
          {concept.hook ? <ConceptRow label="Hook" value={concept.hook} /> : null}
          <ConceptRow label="CTA" value={concept.cta} />
          {concept.hashtags.length > 0 ? (
            <TagRow>
              {concept.hashtags.map((tag) => (
                <MiniTag key={tag}>{tag}</MiniTag>
              ))}
            </TagRow>
          ) : null}
        </ConceptCard>
      ))}
    </ConceptGrid>
  );
}
