"use client";

import { Badge } from "@/components/ui/badge";

import { SectionSkeleton } from "./shared/section-skeleton";
import {
  SectionFallbackContent,
  SectionPendingMessage,
  shouldShowPendingPlaceholder,
} from "./shared/section-status-utils";
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
    <div className="grid min-w-0 gap-3 sm:grid-cols-3">
      {concepts.map((concept, index) => (
        <div
          key={concept.name}
          className="min-w-0 overflow-hidden rounded-xl border border-border/70 bg-gradient-to-b from-background to-violet-50/30 p-3 dark:to-violet-950/10"
        >
          <div className="mb-2 flex min-w-0 items-center gap-2">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-violet-600 text-[10px] font-bold text-white">
              {index + 1}
            </span>
            <p className="min-w-0 break-words text-sm font-bold text-foreground">{concept.name}</p>
          </div>
          <div className="min-w-0 space-y-1.5 break-words text-[11px]">
            {concept.targetEmotion ? (
              <div>
                <span className="font-bold text-violet-600 uppercase">Target Emotion</span>
                <p className="text-foreground">{concept.targetEmotion}</p>
              </div>
            ) : null}
            <div>
              <span className="font-bold text-violet-600 uppercase">Big Idea</span>
              <p className="text-foreground">{concept.bigIdea}</p>
            </div>
            {concept.contentStyle ? (
              <div>
                <span className="font-bold text-muted-foreground uppercase">Content Style</span>
                <p className="text-foreground">{concept.contentStyle}</p>
              </div>
            ) : null}
            {concept.creatorStyle ? (
              <div>
                <span className="font-bold text-muted-foreground uppercase">Creator Style</span>
                <p className="text-foreground">{concept.creatorStyle}</p>
              </div>
            ) : null}
            {concept.visualDirection ? (
              <div>
                <span className="font-bold text-muted-foreground uppercase">Visual Direction</span>
                <p className="text-muted-foreground">{concept.visualDirection}</p>
              </div>
            ) : null}
            <div>
              <span className="font-bold text-muted-foreground uppercase">Hook</span>
              <p className="italic text-foreground">{concept.hook}</p>
            </div>
            <div>
              <span className="font-bold text-[#1D9E75] uppercase">CTA</span>
              <p className="font-semibold text-foreground">{concept.cta}</p>
            </div>
            <div className="flex flex-wrap gap-1 pt-1">
              {concept.hashtags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-[9px]">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
