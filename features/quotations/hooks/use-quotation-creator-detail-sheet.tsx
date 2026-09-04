"use client";

import { useCallback, useRef } from "react";
import { toast } from "sonner";

import { CreatorDetailSheet } from "@/features/campaigns/components/creator-detail-sheet-lazy";
import { useCreatorDetailSheetState } from "@/features/discovery/hooks/use-creator-detail-sheet-state";
import {
  fetchQuotationItemCreatorDetail,
  quotationItemCreatorRefId,
} from "@/features/quotations/lib/quotation-item-creator-detail";
import type { QuotationItemRow } from "@/features/quotations/types";
import { sortPlatformsStable } from "@/lib/creators/creator-centric";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { invalidateCreatorPlatformOptionsCache } from "@/lib/quotations/quotation-creator-platform-options";

function creatorPlatformSignature(creator: UnifiedCreatorResult): string {
  return sortPlatformsStable(creator.platforms)
    .map((platform) => `${platform.platform}:${platform.id}`)
    .join("|");
}

function invalidateCreatorPlatformCaches(creator: UnifiedCreatorResult): void {
  invalidateCreatorPlatformOptionsCache(creator.unified_id ?? null);
  invalidateCreatorPlatformOptionsCache(creator.influencer_id ?? null);
  invalidateCreatorPlatformOptionsCache(creator.discovered_profile_id ?? null);
  for (const platform of creator.platforms) {
    invalidateCreatorPlatformOptionsCache(platform.id);
  }
}

/**
 * Quotation detail creator open — reuses pack `cr()` (`openCreatorByHandle`) across
 * a growing dual-pool cache (fetched creators + any shortlist/search pools passed in).
 */
export function useQuotationCreatorDetailSheet(options?: {
  onCreatorPlatformsChanged?: () => void;
  /** Extra pools (e.g. linked shortlist creators) searched before network fetch. */
  extraPools?: Array<Iterable<UnifiedCreatorResult> | null | undefined>;
}) {
  const onCreatorPlatformsChanged = options?.onCreatorPlatformsChanged;
  const extraPools = options?.extraPools ?? [];
  const {
    open: detailOpen,
    creator: detailCreator,
    openCreator,
    openCreatorByHandle,
    onOpenChange: onDetailOpenChange,
  } = useCreatorDetailSheetState();
  const platformSignatureRef = useRef("");
  const fetchedPoolRef = useRef<UnifiedCreatorResult[]>([]);

  const remember = useCallback((creator: UnifiedCreatorResult) => {
    const id = creator.unified_id;
    fetchedPoolRef.current = [
      creator,
      ...fetchedPoolRef.current.filter((c) => c.unified_id !== id),
    ];
  }, []);

  const openCreatorFromItem = useCallback(
    async (item: QuotationItemRow) => {
      const handleOrId =
        item.handle?.trim() ||
        item.unified_id?.trim() ||
        item.influencer_id?.trim() ||
        "";

      if (
        handleOrId &&
        openCreatorByHandle(handleOrId, fetchedPoolRef.current, ...extraPools)
      ) {
        return;
      }

      if (!quotationItemCreatorRefId(item)) {
        toast.error("Creator details are unavailable for this line.");
        return;
      }

      const creator = await fetchQuotationItemCreatorDetail(item);
      if (!creator) {
        toast.error("Could not load creator details.");
        return;
      }

      remember(creator);
      platformSignatureRef.current = creatorPlatformSignature(creator);
      openCreator(creator);
    },
    [extraPools, openCreator, openCreatorByHandle, remember]
  );

  const handleCreatorUpdated = useCallback(
    (next: UnifiedCreatorResult) => {
      remember(next);
      const nextSignature = creatorPlatformSignature(next);
      if (nextSignature !== platformSignatureRef.current) {
        platformSignatureRef.current = nextSignature;
        invalidateCreatorPlatformCaches(next);
        onCreatorPlatformsChanged?.();
      }
    },
    [onCreatorPlatformsChanged, remember]
  );

  const handleOpenChange = useCallback(
    (open: boolean) => {
      onDetailOpenChange(open);
      if (!open) platformSignatureRef.current = "";
    },
    [onDetailOpenChange]
  );

  const detailSheet = (
    <CreatorDetailSheet
      creator={detailCreator}
      open={detailOpen}
      onOpenChange={handleOpenChange}
      onCreatorUpdated={handleCreatorUpdated}
      preserveOpenOnCreatorRows={false}
    />
  );

  return { openCreatorFromItem, openCreatorByHandle, detailSheet, detailCreator };
}
