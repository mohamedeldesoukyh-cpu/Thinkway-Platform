"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { DownloadIcon, RadarIcon, SparklesIcon } from "lucide-react";

import {
  CreatorProfileLink,
  creatorProfileSourceFromUnified,
} from "@/components/creator/creator-profile-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { CreatorBrowserDialog } from "@/features/campaigns/components/creator-browser-dialog";
import { CreatorUnifiedCard } from "@/features/campaigns/components/creator-unified-card";
import { CampaignShortlistAssignmentsPanel } from "@/features/discovery/shortlists/components/campaign-shortlist-assignments-panel";
import {
  exportCampaignShortlistCsvAction,
  getCampaignShortlistAction,
  matchCampaignCreatorsAction,
  removeCreatorFromShortlistAction,
} from "@/features/campaigns/creator-discovery-actions";
import type { CampaignCreatorMatch } from "@/lib/creators/types";

type Props = {
  campaignHeaderId: string;
  campaignName: string;
  brandCountry?: string | null;
};

export function CampaignCreatorDiscoveryPanel({
  campaignHeaderId,
  campaignName,
  brandCountry,
}: Props) {
  const [browserOpen, setBrowserOpen] = useState(false);
  const [brief, setBrief] = useState(`${campaignName} influencer campaign`);
  const [matches, setMatches] = useState<CampaignCreatorMatch[]>([]);
  const [shortlist, setShortlist] = useState<
    Awaited<ReturnType<typeof getCampaignShortlistAction>>
  >([]);
  const [isPending, startTransition] = useTransition();

  const refreshShortlist = useCallback(() => {
    startTransition(async () => {
      const rows = await getCampaignShortlistAction(campaignHeaderId);
      setShortlist(rows);
    });
  }, [campaignHeaderId]);

  useEffect(() => {
    refreshShortlist();
  }, [refreshShortlist]);

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-sm">
            <SparklesIcon className="size-4 text-[var(--brand-product)]" />
            AI Match Creators
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => setBrowserOpen(true)}>
            <RadarIcon className="size-3.5" data-icon="inline-start" />
            Open browser
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            className="min-h-[90px] text-xs"
            placeholder="Campaign brief for AI matching…"
          />
          <Button
            size="sm"
            disabled={isPending || !brief.trim()}
            onClick={() =>
              startTransition(async () => {
                const rows = await matchCampaignCreatorsAction({
                  campaignHeaderId,
                  brief,
                  country: brandCountry ?? undefined,
                  limit: 8,
                });
                setMatches(rows);
              })
            }
          >
            {isPending ? "Matching…" : "Run AI match"}
          </Button>
          {matches.length > 0 ? (
            <div className="space-y-2">
              {matches.map((match) => (
                <div
                  key={match.unified_id}
                  className="rounded-xl border border-border/50 bg-muted/20 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <CreatorProfileLink
                      source={creatorProfileSourceFromUnified(match.creator)}
                      size="sm"
                      showHandle={false}
                      stopPropagation
                    />
                    <p className="text-sm font-semibold tabular-nums text-[var(--brand-product)]">
                      {match.match_score}
                    </p>
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground">{match.rationale}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    ROI est. {match.estimated_roi} · Niche {match.niche_fit} · Engagement{" "}
                    {match.engagement_quality} · Auth {match.authenticity}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm">Campaign shortlist</CardTitle>
          <Button
            size="sm"
            variant="outline"
            disabled={shortlist.length === 0}
            onClick={() =>
              startTransition(async () => {
                const csv = await exportCampaignShortlistCsvAction(campaignHeaderId);
                const blob = new Blob([csv], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `${campaignName.replace(/\s+/g, "-").toLowerCase()}-shortlist.csv`;
                a.click();
                URL.revokeObjectURL(url);
              })
            }
          >
            <DownloadIcon className="size-3.5" data-icon="inline-start" />
            Export
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {shortlist.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">
              No creators shortlisted yet. Use Creator Browser to add creators.
            </p>
          ) : (
            shortlist.map((row) =>
              row.creator ? (
                <div key={row.item_id} className="space-y-1">
                  <CreatorUnifiedCard creator={row.creator} compact />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-destructive"
                    onClick={() =>
                      startTransition(async () => {
                        await removeCreatorFromShortlistAction(campaignHeaderId, row.item_id);
                        refreshShortlist();
                      })
                    }
                  >
                    Remove
                  </Button>
                </div>
              ) : null
            )
          )}
        </CardContent>
      </Card>

      <div className="xl:col-span-2">
        <CampaignShortlistAssignmentsPanel campaignHeaderId={campaignHeaderId} />
      </div>

      <CreatorBrowserDialog
        open={browserOpen}
        onOpenChange={(v) => {
          setBrowserOpen(v);
          if (!v) refreshShortlist();
        }}
        onSelect={() => {}}
        campaignHeaderId={campaignHeaderId}
      />
    </div>
  );
}
