"use client";

import { useEffect, useState } from "react";
import { Loader2Icon, TrendingUpIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { CreatorUnifiedCard } from "@/features/campaigns/components/creator-unified-card";
import {
  addCreatorToCampaignShortlistAction,
  getCreatorHistoricalMetricsAction,
  getSimilarCreatorsAction,
} from "@/features/campaigns/creator-discovery-actions";
import { isAssignableCreator } from "@/lib/creators/adapters";
import type { CreatorHistoricalMetrics, UnifiedCreatorResult } from "@/lib/creators/types";

type Props = {
  creator: UnifiedCreatorResult | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssign?: (creator: UnifiedCreatorResult) => void;
  campaignHeaderId?: string;
};

export function CreatorDetailSheet({
  creator,
  open,
  onOpenChange,
  onAssign,
  campaignHeaderId,
}: Props) {
  const [similar, setSimilar] = useState<Array<UnifiedCreatorResult & { similarity_score: number }>>(
    []
  );
  const [history, setHistory] = useState<CreatorHistoricalMetrics | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !creator) return;
    setLoading(true);
    Promise.all([
      getSimilarCreatorsAction(creator.unified_id),
      getCreatorHistoricalMetricsAction(creator.unified_id),
    ])
      .then(([sim, hist]) => {
        setSimilar(sim);
        setHistory(hist);
      })
      .finally(() => setLoading(false));
  }, [open, creator]);

  if (!creator) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{creator.display_name}</SheetTitle>
          <SheetDescription>Creator profile, metrics confidence, and similar creators.</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4 px-1">
          <CreatorUnifiedCard creator={creator} />

          <div className="flex flex-wrap gap-2">
            {isAssignableCreator(creator) && onAssign ? (
              <Button size="sm" onClick={() => onAssign(creator)}>
                Assign to line
              </Button>
            ) : null}
            {campaignHeaderId ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  void addCreatorToCampaignShortlistAction(campaignHeaderId, creator)
                }
              >
                Save to shortlist
              </Button>
            ) : null}
          </div>

          <section className="space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <TrendingUpIcon className="size-4" />
              Historical metrics
            </h3>
            {loading ? (
              <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
            ) : history && history.followers.length > 0 ? (
              <div className="rounded-xl border border-border/50 p-3 text-[11px] text-muted-foreground">
                <p>{history.followers.length} follower snapshots recorded</p>
                <p>
                  Latest: {history.followers[history.followers.length - 1]?.value.toLocaleString()}
                </p>
                <p className="mt-2 italic">Chart visualization — Phase 2 placeholder</p>
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                No historical snapshots yet. Enrichment worker will populate trends.
              </p>
            )}
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Similar creators</h3>
            {similar.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">No similar creators found.</p>
            ) : (
              <div className="space-y-2">
                {similar.map((item) => (
                  <div key={item.unified_id} className="rounded-xl border border-border/40 p-2">
                    <p className="text-sm font-medium">{item.display_name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      Similarity {item.similarity_score} · Thinkway {Math.round(item.thinkway_score)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
