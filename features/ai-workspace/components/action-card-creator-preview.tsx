"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { getUnifiedCreatorsBatchAction } from "@/features/campaigns/creator-discovery-actions";
import type { CreatorDrawerSelection } from "@/features/campaign-decision-workspace/components/creator-drawer";
import { STUDIO_VENDOR_INITIAL_VISIBLE } from "@/features/campaign-studio/constants/hydration-limits";
import { useCreatorHydration } from "@/features/campaign-studio/hooks/use-creator-hydration";
import type { HydrationMapperOptions } from "@/features/campaign-studio/services/creator-hydration-mapper";
import { DiscoveryCreatorDetailHost } from "@/features/discovery/components/discovery-creator-detail-host";
import { DiscoveryCreatorExactRow } from "@/features/discovery/components/discovery-creator-exact-row";
import { DiscoveryLoadingState } from "@/features/discovery/components/design-system";
import { dedupeByCreatorId } from "@/lib/creators/dedupe-creators";
import type { UnifiedCreatorResult } from "@/lib/creators/types";

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
  const [drawerSelection, setDrawerSelection] = useState<CreatorDrawerSelection | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [unifiedCreators, setUnifiedCreators] = useState<UnifiedCreatorResult[]>([]);
  const [, startTransition] = useTransition();

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

  const displayIds = useMemo(() => {
    if (hydrated.length > 0) {
      return dedupeByCreatorId(
        hydrated.map((v) => ({ id: v.id })),
        (c) => c.id
      ).items.map((c) => c.id);
    }
    return ids;
  }, [hydrated, ids]);

  useEffect(() => {
    if (displayIds.length === 0) {
      setUnifiedCreators([]);
      return;
    }

    startTransition(async () => {
      try {
        const rows = await getUnifiedCreatorsBatchAction(displayIds);
        setUnifiedCreators(rows.filter(Boolean));
      } catch {
        setUnifiedCreators([]);
      }
    });
  }, [displayIds]);

  const visibleCreators = showAll
    ? unifiedCreators
    : unifiedCreators.slice(0, STUDIO_VENDOR_INITIAL_VISIBLE);
  const hiddenCount = Math.max(0, unifiedCreators.length - STUDIO_VENDOR_INITIAL_VISIBLE);

  const openDetails = useCallback((creator: UnifiedCreatorResult) => {
    setDrawerSelection({
      id: creator.unified_id,
      displayName: creator.display_name,
      handle: creator.platforms[0]?.handle,
      platform: creator.platforms[0]?.platform,
      avatarUrl: creator.primaryAvatarUrl ?? creator.profile_image_url ?? undefined,
      profileUrl: creator.platforms[0]?.profile_url ?? undefined,
    });
    setDrawerOpen(true);
  }, []);

  if (unifiedCreators.length === 0 && !loading && displayIds.length === 0) return null;

  return (
    <div>
      <p className="mb-2 text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
        Matched {AI_TERMINOLOGY.vendorPlural.toLowerCase()}
        {unifiedCreators.length > 0 ? ` (${unifiedCreators.length})` : ""}
      </p>
      {loading && unifiedCreators.length === 0 ? (
        <DiscoveryLoadingState message="Loading creator profiles…" className="py-4" />
      ) : (
        <div className="discovery-search-exact-root rounded-lg border border-border">
          <div className="discovery-search-exact-scroll max-h-[480px]">
            {visibleCreators.map((creator) => (
              <DiscoveryCreatorExactRow
                key={creator.unified_id}
                creator={creator}
                selected={false}
                selectable={false}
                showFeed={false}
                rowBehavior="open-detail"
                onToggleSelect={() => undefined}
                onOpenCreator={() => openDetails(creator)}
                actions={
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-[38px] shrink-0 px-2 text-muted-foreground"
                    onClick={(event) => {
                      event.stopPropagation();
                      openDetails(creator);
                    }}
                  >
                    Details
                  </Button>
                }
              />
            ))}
          </div>
          {hiddenCount > 0 && !showAll ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="m-2 w-[calc(100%-1rem)]"
              onClick={() => setShowAll(true)}
            >
              Show all {unifiedCreators.length} creators ({hiddenCount} more)
            </Button>
          ) : null}
        </div>
      )}
      <DiscoveryCreatorDetailHost
        selection={drawerSelection}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  );
}
