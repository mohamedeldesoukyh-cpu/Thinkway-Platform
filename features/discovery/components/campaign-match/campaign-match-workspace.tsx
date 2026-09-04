"use client";

import { useRef, useState, useTransition } from "react";
import { SparklesIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CreatorDetailSheet } from "@/features/campaigns/components/creator-detail-sheet-lazy";
import {
  DiscoveryCreatorExactHeader,
  DiscoveryCreatorExactRow,
} from "@/features/discovery/components/discovery-creator-exact-row";
import {
  DiscoveryEmptyState,
  DiscoveryLoadingState,
} from "@/features/discovery/components/design-system";
import {
  InterestChips,
  RelevanceScore,
} from "@/features/discovery/components/discovery-interest-chips";
import { matchDiscoveryCreatorsBriefAction } from "@/features/discovery/actions";
import type { CampaignCreatorMatch } from "@/lib/creators/types";

export function CampaignMatchWorkspace() {
  const [brief, setBrief] = useState("");
  const [matches, setMatches] = useState<CampaignCreatorMatch[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailCreator, setDetailCreator] = useState<
    CampaignCreatorMatch["creator"] | null
  >(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const [isPending, startTransition] = useTransition();
  const briefRef = useRef<HTMLTextAreaElement>(null);

  const allSelected =
    matches.length > 0 &&
    matches.every((m) => selectedIds.has(m.creator.unified_id));
  const indeterminate = selectedIds.size > 0 && !allSelected;

  function toggleSelect(unifiedId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(unifiedId)) next.delete(unifiedId);
      else next.add(unifiedId);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(matches.map((m) => m.creator.unified_id)));
  }

  function runMatch() {
    const trimmed = brief.trim();
    if (!trimmed) {
      toast.error("Enter a campaign brief to match creators.");
      return;
    }

    startTransition(async () => {
      try {
        const rows = await matchDiscoveryCreatorsBriefAction({
          brief: trimmed,
          limit: 20,
        });
        setMatches(rows);
        setHasRun(true);
        setSelectedIds(new Set());
        if (rows.length === 0) {
          toast.message("No creators matched this brief.");
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Match failed");
      }
    });
  }

  return (
    <div className="discovery-search-exact-root overflow-hidden rounded-[var(--radius-lg)] border border-[var(--tw-border)] bg-background">
      <div className="border-b border-[var(--tw-border)] bg-[var(--surface)] px-4 py-3.5">
        <p className="text-[12.5px] font-bold text-foreground">
          Match workspace
        </p>
        <p className="mt-0.5 text-xs text-[var(--text-3)]">
          Score creators against your brief using unified browse + fit ranking.
        </p>
      </div>

      <div className="space-y-3 border-b border-[var(--tw-border)] px-4 py-4">
        <Textarea
          ref={briefRef}
          value={brief}
          onChange={(event) => setBrief(event.target.value)}
          placeholder="Describe your campaign: audience, niche, platforms, goals…"
          rows={4}
          className="min-h-[96px] resize-y text-sm"
        />
        {brief.trim() ? (
          <Button
            type="button"
            disabled={isPending}
            onClick={runMatch}
            className="h-9 gap-1.5 text-[12.5px] font-bold"
          >
            <SparklesIcon className="size-3.5" />
            {isPending ? "Matching…" : "Match creators"}
          </Button>
        ) : null}
      </div>

      {isPending && matches.length === 0 ? (
        <DiscoveryLoadingState
          message="Ranking creators for your brief…"
          className="py-12"
        />
      ) : matches.length === 0 ? (
        <DiscoveryEmptyState
          title={
            hasRun
              ? "No creators matched this brief"
              : brief.trim()
                ? "Brief ready to match"
                : "Campaign brief not set"
          }
          description={
            hasRun
              ? "The current brief returned no matches. Refine its audience, niche, platform, or goal, then run the match again."
              : brief.trim()
                ? "Run the match to rank creators against the campaign requirements."
                : "Creator matches need a campaign brief. Add the audience, niche, platforms, and goals to begin."
          }
          className="py-12"
        >
          {!brief.trim() ? (
            <Button
              type="button"
              onClick={() => briefRef.current?.focus()}
              className="h-9 gap-1.5 text-[12.5px] font-bold"
            >
              <SparklesIcon className="size-3.5" />
              Add campaign brief
            </Button>
          ) : null}
        </DiscoveryEmptyState>
      ) : (
        <>
          <DiscoveryCreatorExactHeader
            total={matches.length}
            allSelected={indeterminate ? "indeterminate" : allSelected}
            hasCreators={matches.length > 0}
            onToggleSelectAll={toggleSelectAll}
            metaLabel="Match fit"
          />
          <div className="discovery-search-exact-scroll max-h-[min(70vh,960px)]">
            {matches.map((match) => {
              const creator = match.creator;
              const selected = selectedIds.has(creator.unified_id);
              return (
                <DiscoveryCreatorExactRow
                  key={creator.unified_id}
                  creator={creator}
                  selected={selected}
                  onToggleSelect={() => toggleSelect(creator.unified_id)}
                  onOpenCreator={() => {
                    setDetailCreator(creator);
                    setDetailOpen(true);
                  }}
                  showCampaignRelevance
                  meta={
                    <div className="flex flex-col gap-1.5">
                      <RelevanceScore score={match.match_score} />
                      <InterestChips
                        interests={[match.rationale]}
                        maxVisible={1}
                        emptyLabel=""
                        variant="compact"
                      />
                    </div>
                  }
                />
              );
            })}
          </div>
        </>
      )}

      <CreatorDetailSheet
        creator={detailCreator}
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) setDetailCreator(null);
        }}
      />
    </div>
  );
}
