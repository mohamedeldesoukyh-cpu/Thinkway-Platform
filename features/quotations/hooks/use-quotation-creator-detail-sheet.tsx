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

export function useQuotationCreatorDetailSheet(options?: {
  onCreatorPlatformsChanged?: () => void;
}) {
  const onCreatorPlatformsChanged = options?.onCreatorPlatformsChanged;
  const {
    open: detailOpen,
    creator: detailCreator,
    openCreator,
    onOpenChange: onDetailOpenChange,
  } = useCreatorDetailSheetState();
  const platformSignatureRef = useRef("");

  const openCreatorFromItem = useCallback(async (item: QuotationItemRow) => {
    if (!quotationItemCreatorRefId(item)) {
      toast.error("Creator details are unavailable for this line.");
      return;
    }

    const creator = await fetchQuotationItemCreatorDetail(item);
    if (!creator) {
      toast.error("Could not load creator details.");
      return;
    }

    platformSignatureRef.current = creatorPlatformSignature(creator);
    openCreator(creator);
  }, [openCreator]);

  const handleCreatorUpdated = useCallback(
    (next: UnifiedCreatorResult) => {
      const nextSignature = creatorPlatformSignature(next);
      if (nextSignature !== platformSignatureRef.current) {
        platformSignatureRef.current = nextSignature;
        invalidateCreatorPlatformCaches(next);
        onCreatorPlatformsChanged?.();
      }
    },
    [onCreatorPlatformsChanged]
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

  return { openCreatorFromItem, detailSheet, detailCreator };
}
