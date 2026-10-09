
import { useCallback, useEffect, useRef, useState } from "react";
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
  quotationId?: string;
  canAdd?: boolean;
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
  const [pendingItem, setPendingItem] = useState<QuotationItemRow | null>(null);
  const [coreDetailLoaded, setCoreDetailLoaded] = useState(false);
  const requestRef = useRef(0);
  useEffect(() => () => { requestRef.current += 1; }, []);
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
      const request = ++requestRef.current;
      setPendingItem(null);
      setCoreDetailLoaded(false);
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

      // Paint the canonical shell before network work, using only row identity.
      onDetailOpenChange(false);
      setPendingItem(item);
      try {
        const creator = await fetchQuotationItemCreatorDetail(item, { coreOnly: true });
        if (request !== requestRef.current) return;
        setPendingItem(null);
        if (!creator) {
          toast.error("Could not load creator details. Please try again.");
          return;
        }
        remember(creator);
        platformSignatureRef.current = creatorPlatformSignature(creator);
        setCoreDetailLoaded(true);
        openCreator(creator);
      } catch {
        if (request !== requestRef.current) return;
        setPendingItem(null);
        toast.error("Could not load creator details. Please try again.");
      }
    },
    [extraPools, openCreator, openCreatorByHandle, onDetailOpenChange, remember]
  );

  const handleCreatorUpdated = useCallback(
    (next: UnifiedCreatorResult) => {
      remember(next);
      // Refresh rows after metric/avatar changes, even with unchanged platform IDs.
      invalidateCreatorPlatformCaches(next);
      onCreatorPlatformsChanged?.();
      platformSignatureRef.current = creatorPlatformSignature(next);
    },
    [onCreatorPlatformsChanged, remember]
  );

  const handleOpenChange = useCallback(
    (open: boolean) => {
      onDetailOpenChange(open);
      if (!open) {
        requestRef.current += 1;
        setPendingItem(null);
        platformSignatureRef.current = "";
      }
    },
    [onDetailOpenChange]
  );

  const detailSheet = (
    <CreatorDetailSheet
      similarTarget={options?.quotationId ? {kind: "quotation", id: options.quotationId, canAdd: options.canAdd} : undefined}
      key={requestRef.current}
      creator={pendingItem ? null : detailCreator}
      coreDetailLoaded={coreDetailLoaded}
      pendingIdentity={pendingItem ? {
        displayName: pendingItem.creator_name ?? pendingItem.handle ?? "Creator",
        handle: pendingItem.handle,
        avatarUrl: pendingItem.profile_image_url,
        profileUrl: pendingItem.profile_url,
        platform: pendingItem.platform,
      } : null}
      open={detailOpen || pendingItem !== null}
      onOpenChange={handleOpenChange}
      onCreatorUpdated={handleCreatorUpdated}
      preserveOpenOnCreatorRows={false}
      presentation="discoveryPack"
    />
  );

  return { openCreatorFromItem, openCreatorByHandle, detailSheet, detailCreator };
}
