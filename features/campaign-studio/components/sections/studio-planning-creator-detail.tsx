"use client";

import { ExternalLinkIcon } from "lucide-react";
import Link from "next/link";

import {
  CreatorDetailsSummaryCard,
  formatThinkwayStarLabel,
} from "@/features/discovery/components/creator-details-summary-card";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { CreatorDrawerSelection } from "@/features/campaign-decision-workspace/components/creator-drawer";
import type { StudioEciPlanningSignal } from "@/features/campaign-studio/services/eci/project-studio-eci-signal";
import {
  formatEngagement,
  formatFollowers,
} from "@/features/campaign-studio/components/sections/shared/format-utils";
import {
  ExecBlock,
  StudioExecutiveRecommendationBlock,
} from "./shared/studio-executive-recommendation-block";

type StudioPlanningCreatorDetailProps = {
  selection: CreatorDrawerSelection | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  signal?: StudioEciPlanningSignal | null;
  /**
   * Why Discovery's full creator detail is not being shown. `resolving` while
   * the lookup is in flight, `unavailable` when this creator has no unified
   * Discovery record yet (a creator just added by URL, for instance).
   */
  discoveryDetailState?: "resolving" | "unavailable";
};

/**
 * Planning fallback for a creator with no Discovery detail to show.
 *
 * The creator detail view IS Discovery's `CreatorDetailSheet` — see
 * `StudioCreatorDetailHost`. This sheet is what the operator gets when that
 * sheet has nothing to render: the campaign's own planning recommendation plus
 * the stated values already on the card, and an explicit line saying the
 * Discovery profile is loading or not available. Nothing here stands in for
 * Discovery data that does not exist.
 */
export function StudioPlanningCreatorDetail({
  selection,
  open,
  onOpenChange,
  signal,
  discoveryDetailState,
}: StudioPlanningCreatorDetailProps) {
  const internalHref =
    selection?.id?.startsWith("inf:") && selection.id.slice(4)
      ? `/vendors/${selection.id.slice(4)}`
      : undefined;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Executive recommendation</SheetTitle>
          <SheetDescription>
            Decision-first planning view for this campaign — not an analytics screen.
          </SheetDescription>
        </SheetHeader>

        {selection ? (
          <div className="mt-6 space-y-3.5">
            {/*
              Discovery's own identity header, not a Studio copy of it. Only
              stated values are passed — an absent follower count or country
              stays absent.
            */}
            <CreatorDetailsSummaryCard
              size="sheet"
              displayName={selection.displayName}
              avatarUrl={selection.avatarUrl ?? null}
              profileUrl={selection.profileUrl ?? null}
              thinkwayStarLabel={formatThinkwayStarLabel(
                selection.matchPercent ?? undefined
              )}
              secondaryLine={[
                selection.handle ? `@${selection.handle.replace(/^@/, "")}` : null,
                selection.platform,
                selection.followers != null
                  ? `${formatFollowers(selection.followers)} followers`
                  : null,
                selection.engagementRate != null
                  ? `${formatEngagement(selection.engagementRate)} ER`
                  : null,
                selection.tier,
              ]
                .filter(Boolean)
                .join(" · ")}
              countryLabel={selection.country ?? null}
            />

            {discoveryDetailState ? (
              <p className="rounded-lg border border-border/60 bg-muted/10 p-3 text-[11px] text-muted-foreground">
                {discoveryDetailState === "resolving"
                  ? "Loading the full creator profile…"
                  : "The full creator profile is not available for this creator yet. Planning context is shown below."}
              </p>
            ) : null}

            <StudioExecutiveRecommendationBlock
              creatorId={selection.id}
              signal={signal}
              active={open}
            />

            {selection.audienceSummary ? (
              <ExecBlock title="Audience snapshot" body={selection.audienceSummary} />
            ) : null}
            {selection.priceEstimate ? (
              <ExecBlock title="Estimated fee" body={selection.priceEstimate} />
            ) : null}

            <div className="flex flex-wrap gap-2">
              {selection.profileUrl ? (
                <Button
                  type="button"
                  variant="default"
                  className="bg-brand-product hover:bg-brand-product/90"
                  asChild
                >
                  <a href={selection.profileUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLinkIcon className="size-4" />
                    View social profile
                  </a>
                </Button>
              ) : null}
              {internalHref ? (
                <Button type="button" variant="outline" asChild>
                  <Link href={internalHref}>Open in Thinkway</Link>
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
