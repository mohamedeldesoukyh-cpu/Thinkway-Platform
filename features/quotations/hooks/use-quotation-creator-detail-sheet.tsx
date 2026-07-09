"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import { CreatorDetailSheet } from "@/features/campaigns/components/creator-detail-sheet";
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
  const [detailCreator, setDetailCreator] = useState<UnifiedCreatorResult | null>(null);
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
    setDetailCreator(creator);
  }, []);

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

  const detailSheet = (
    <CreatorDetailSheet
      creator={detailCreator}
      open={detailCreator != null}
      onOpenChange={(open) => {
        if (!open) {
          setDetailCreator(null);
          platformSignatureRef.current = "";
        }
      }}
      onCreatorUpdated={handleCreatorUpdated}
    />
  );

  return { openCreatorFromItem, detailSheet, detailCreator };
}
