"use client";

import { Loader2Icon } from "lucide-react";
import { memo, useCallback } from "react";

import type { UnifiedCreatorResult } from "@/lib/creators/types";

import { CreatorSearchExactRow } from "./creator-search-exact-row";

export type CreatorSearchRecommendation = {
  creator: UnifiedCreatorResult;
  relevanceScore: number;
  matchedAttributes: string[];
};

type Props = {
  recommendations: CreatorSearchRecommendation[];
  loading?: boolean;
  platformFilter?: string[];
  selectedIds: Set<string>;
  shortlistedIds: Set<string>;
  onToggleSelect: (creator: UnifiedCreatorResult) => void;
  onOpenCreator: (creator: UnifiedCreatorResult) => void;
  onToggleShortlist: (creator: UnifiedCreatorResult) => void;
  onRejectCreator: (creator: UnifiedCreatorResult) => void;
};

const CreatorSearchRecommendedRow = memo(function CreatorSearchRecommendedRow({
  recommendation,
  selected,
  addedToShortlist,
  platformFilter,
  onToggleSelect,
  onOpenCreator,
  onToggleShortlist,
  onRejectCreator,
}: {
  recommendation: CreatorSearchRecommendation;
  selected: boolean;
  addedToShortlist: boolean;
  platformFilter?: string[];
  onToggleSelect: (creator: UnifiedCreatorResult) => void;
  onOpenCreator: (creator: UnifiedCreatorResult) => void;
  onToggleShortlist: (creator: UnifiedCreatorResult) => void;
  onRejectCreator: (creator: UnifiedCreatorResult) => void;
}) {
  const { creator, relevanceScore, matchedAttributes } = recommendation;

  const handleToggleSelect = useCallback(
    () => onToggleSelect(creator),
    [onToggleSelect, creator]
  );
  const handleOpenCreator = useCallback(
    () => onOpenCreator(creator),
    [onOpenCreator, creator]
  );
  const handleToggleShortlist = useCallback(
    () => onToggleShortlist(creator),
    [onToggleShortlist, creator]
  );
  const handleReject = useCallback(
    () => onRejectCreator(creator),
    [onRejectCreator, creator]
  );

  return (
    <div className="border-b border-border/60 last:border-b-0">
      <CreatorSearchExactRow
        creator={creator}
        selected={selected}
        addedToShortlist={addedToShortlist}
        platformFilter={platformFilter}
        showCampaignRelevance
        onToggleSelect={handleToggleSelect}
        onOpenCreator={handleOpenCreator}
        onToggleShortlist={handleToggleShortlist}
        onReject={handleReject}
        meta={
          <div className="flex min-w-0 flex-col items-end gap-1 text-right">
            <span className="rounded-full bg-[rgba(0,87,255,0.1)] px-2 py-0.5 text-[10px] font-semibold text-[#0057FF]">
              {relevanceScore}% match
            </span>
            {matchedAttributes.length > 0 ? (
              <div className="flex max-w-[220px] flex-wrap justify-end gap-1">
                {matchedAttributes.slice(0, 4).map((label) => (
                  <span
                    key={label}
                    className="inline-flex items-center rounded-full border border-[#9edfc8] bg-[#ecfdf5] px-1.5 py-0.5 text-[9px] font-medium text-[#168a66]"
                  >
                    ✓ {label}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        }
      />
    </div>
  );
});

export function CreatorSearchRecommendedSection({
  recommendations,
  loading = false,
  platformFilter,
  selectedIds,
  shortlistedIds,
  onToggleSelect,
  onOpenCreator,
  onToggleShortlist,
  onRejectCreator,
}: Props) {
  if (!loading && recommendations.length === 0) return null;

  return (
    <section className="border-t border-border/80 bg-muted/20">
      <div className="border-b border-border/60 px-4 py-3 md:px-5">
        <h3 className="text-sm font-semibold text-foreground">Recommended Creators</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          We couldn&apos;t find exact matches. Showing the closest creators ranked by relevance.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" />
          Finding similar creators…
        </div>
      ) : (
        <div>
          {recommendations.map((recommendation) => (
            <CreatorSearchRecommendedRow
              key={recommendation.creator.unified_id}
              recommendation={recommendation}
              selected={selectedIds.has(recommendation.creator.unified_id)}
              addedToShortlist={shortlistedIds.has(recommendation.creator.unified_id)}
              platformFilter={platformFilter}
              onToggleSelect={onToggleSelect}
              onOpenCreator={onOpenCreator}
              onToggleShortlist={onToggleShortlist}
              onRejectCreator={onRejectCreator}
            />
          ))}
        </div>
      )}
    </section>
  );
}
