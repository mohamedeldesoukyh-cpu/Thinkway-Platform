"use client";

import { useCallback, useMemo, useState } from "react";
import { GlobeIcon } from "lucide-react";

import { CreatorAvatarImage } from "@/components/creator/creator-avatar-image";
import { CreatorTierBadge } from "@/components/creator/creator-tier-badge";
import { Button } from "@/components/ui/button";
import {
  CreatorDrawer,
  type CreatorDrawerSelection,
} from "@/features/campaign-decision-workspace/components/creator-drawer";
import { STUDIO_VENDOR_INITIAL_VISIBLE } from "@/features/campaign-studio/constants/hydration-limits";
import { useCreatorHydration } from "@/features/campaign-studio/hooks/use-creator-hydration";
import type { HydrationMapperOptions } from "@/features/campaign-studio/services/creator-hydration-mapper";
import {
  formatEngagement,
  formatFollowers,
} from "@/features/campaign-studio/components/sections/shared/format-utils";
import { dedupeByCreatorId } from "@/lib/creators/dedupe-creators";
import type { CreatorTierLabel } from "@/lib/creators/creator-tier";

import { AI_TERMINOLOGY } from "../constants/ai-copy";

export type ActionCardCreatorItem = {
  id?: string;
  handle: string;
  displayName?: string;
  platform?: string;
  followers?: number;
  engagementRate?: number;
  avatarUrl?: string;
  profileUrl?: string;
};

type ActionCardCreatorPreviewProps = {
  creators: ActionCardCreatorItem[];
  creatorIds?: string[];
  hydrationOptions?: HydrationMapperOptions;
};

function PlatformBadge({ platform }: { platform: string }) {
  const normalized = platform.toLowerCase();
  const label = normalized.includes("instagram")
    ? "IG"
    : normalized.includes("youtube")
      ? "YT"
      : normalized.includes("tiktok")
        ? "TT"
        : platform.slice(0, 2).toUpperCase();

  return (
    <span className="flex size-5 items-center justify-center rounded-md bg-muted/60 text-[9px] font-bold">
      {label}
    </span>
  );
}

function CreatorAvatarLink({
  creator,
  onOpenDetails,
}: {
  creator: ActionCardCreatorItem & { displayName: string; platform: string };
  onOpenDetails: () => void;
}) {
  const avatar = (
    <CreatorAvatarImage
      avatarUrl={creator.avatarUrl}
      profileUrl={creator.profileUrl}
      size="sm"
      alt={creator.displayName}
    />
  );

  if (creator.profileUrl) {
    return (
      <a
        href={creator.profileUrl}
        target="_blank"
        rel="noopener noreferrer"
        title="Open social profile"
        className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D9E75]"
        onClick={(e) => e.stopPropagation()}
      >
        {avatar}
      </a>
    );
  }

  return (
    <button
      type="button"
      className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D9E75]"
      onClick={onOpenDetails}
      aria-label={`View ${creator.displayName}`}
    >
      {avatar}
    </button>
  );
}

function creatorsNeedHydration(
  creators: ActionCardCreatorItem[],
  ids: string[]
): boolean {
  if (ids.length === 0) return false;
  if (creators.length === 0) return true;

  return creators.some(
    (creator) =>
      !creator.displayName?.trim() ||
      creator.followers == null ||
      (!creator.avatarUrl?.trim() && !creator.profileUrl?.trim())
  );
}

export function ActionCardCreatorPreview({
  creators,
  creatorIds,
  hydrationOptions,
}: ActionCardCreatorPreviewProps) {
  const [showAll, setShowAll] = useState(false);
  const [drawerCreator, setDrawerCreator] = useState<CreatorDrawerSelection | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const ids = useMemo(
    () =>
      creatorIds?.length
        ? creatorIds
        : creators.map((c) => c.id).filter((id): id is string => Boolean(id)),
    [creatorIds, creators]
  );

  const hydrationIds = useMemo(() => {
    if (!creatorsNeedHydration(creators, ids)) return [];
    return ids.slice(0, STUDIO_VENDOR_INITIAL_VISIBLE);
  }, [creators, ids]);

  const { vendors: hydrated, loading } = useCreatorHydration(
    hydrationIds,
    undefined,
    undefined,
    hydrationOptions
  );

  const displayCreators = useMemo(() => {
    if (hydrated.length > 0) {
      return dedupeByCreatorId(
        hydrated.map((v) => ({
          id: v.id,
          handle: v.handle.replace(/^@/, ""),
          displayName: v.displayName,
          platform: v.platform,
          followers: v.followers,
          engagementRate: v.engagementRate,
          avatarUrl: v.avatarUrl,
          profileUrl: v.profileUrl,
          priceEstimate: v.priceEstimate,
          tier: v.tier,
          country: v.country,
          reason: v.reason,
          matchPercent: v.matchPercent,
        })),
        (c) => c.id ?? `${c.handle}:${c.displayName}`
      ).items;
    }

    return creators.map((c) => ({
      ...c,
      displayName: c.displayName ?? c.handle,
      platform: c.platform ?? hydrationOptions?.preferredPlatforms?.[0] ?? "instagram",
    }));
  }, [creators, hydrated, hydrationOptions?.preferredPlatforms]);

  const visibleCreators = showAll
    ? displayCreators
    : displayCreators.slice(0, STUDIO_VENDOR_INITIAL_VISIBLE);
  const hiddenCount = Math.max(0, displayCreators.length - STUDIO_VENDOR_INITIAL_VISIBLE);

  const openDetails = useCallback((creator: (typeof displayCreators)[number]) => {
    setDrawerCreator({
      id: creator.id,
      displayName: creator.displayName ?? creator.handle,
      handle: creator.handle.startsWith("@") ? creator.handle : `@${creator.handle}`,
      platform: creator.platform,
      avatarUrl: creator.avatarUrl,
      profileUrl: creator.profileUrl,
      followers: creator.followers,
      engagementRate: creator.engagementRate,
      priceEstimate:
        "priceEstimate" in creator && typeof creator.priceEstimate === "string"
          ? creator.priceEstimate
          : undefined,
      tier:
        "tier" in creator && typeof creator.tier === "string"
          ? (creator.tier as CreatorTierLabel)
          : undefined,
      country:
        "country" in creator && typeof creator.country === "string"
          ? creator.country
          : undefined,
      reason:
        "reason" in creator && typeof creator.reason === "string"
          ? creator.reason
          : undefined,
      matchPercent:
        "matchPercent" in creator && typeof creator.matchPercent === "number"
          ? creator.matchPercent
          : undefined,
    });
    setDrawerOpen(true);
  }, []);

  if (displayCreators.length === 0 && !loading) return null;

  return (
    <div>
      <p className="mb-2 text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
        Matched {AI_TERMINOLOGY.vendorPlural.toLowerCase()}
        {displayCreators.length > 0 ? ` (${displayCreators.length})` : ""}
      </p>
      {loading && displayCreators.length === 0 ? (
        <p className="text-xs text-muted-foreground">Loading creator profiles…</p>
      ) : (
        <div className="space-y-2">
          {visibleCreators.map((creator, index) => {
            const displayName = creator.displayName ?? creator.handle;
            const platform = creator.platform ?? "instagram";
            const normalized = {
              ...creator,
              displayName,
              platform,
            };

            return (
              <div
                key={creator.id ?? `${creator.handle}-${index}`}
                className="flex min-w-0 items-start gap-3 rounded-lg border border-border bg-background px-2.5 py-2"
              >
                <CreatorAvatarLink creator={normalized} onOpenDetails={() => openDetails(creator)} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="text-left text-sm font-semibold hover:text-[#1D9E75]"
                      onClick={() => openDetails(creator)}
                    >
                      {displayName}
                    </button>
                    <span className="text-xs text-muted-foreground">
                      @{creator.handle.replace(/^@/, "")}
                    </span>
                    <div className="flex items-center gap-1 rounded-md bg-muted/50 px-1.5 py-0.5">
                      <PlatformBadge platform={platform} />
                      <span className="text-[10px] capitalize">{platform}</span>
                    </div>
                    {"tier" in creator && typeof creator.tier === "string" ? (
                      <CreatorTierBadge tier={creator.tier as CreatorTierLabel} />
                    ) : null}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                    {creator.followers != null ? (
                      <span>{formatFollowers(creator.followers)} followers</span>
                    ) : null}
                    {creator.engagementRate != null ? (
                      <span>{formatEngagement(creator.engagementRate)} ER</span>
                    ) : null}
                    {"priceEstimate" in creator && typeof creator.priceEstimate === "string" ? (
                      <span className="font-medium text-[#1D9E75]">{creator.priceEstimate}</span>
                    ) : null}
                    {"country" in creator && typeof creator.country === "string" ? (
                      <span className="flex items-center gap-0.5">
                        <GlobeIcon className="size-3" />
                        {creator.country}
                      </span>
                    ) : null}
                  </div>
                </div>
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  className="h-7 shrink-0 px-2 text-muted-foreground"
                  onClick={() => openDetails(creator)}
                >
                  Details
                </Button>
              </div>
            );
          })}
          {hiddenCount > 0 && !showAll ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setShowAll(true)}
            >
              Show all {displayCreators.length} creators ({hiddenCount} more)
            </Button>
          ) : null}
        </div>
      )}
      <CreatorDrawer creator={drawerCreator} open={drawerOpen} onOpenChange={setDrawerOpen} />
    </div>
  );
}
