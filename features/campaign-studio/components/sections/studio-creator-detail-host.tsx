"use client";

import { useEffect, useState } from "react";

import { CreatorDetailSheet } from "@/features/campaigns/components/creator-detail-sheet-lazy";
import { getUnifiedCreatorsBatchAction } from "@/features/campaigns/creator-discovery-actions";
import type { CreatorDrawerSelection } from "@/features/campaign-decision-workspace/components/creator-drawer";
import type { StudioEciPlanningSignal } from "@/features/campaign-studio/services/eci/project-studio-eci-signal";
import type { UnifiedCreatorResult } from "@/lib/creators/types";

import { StudioExecutiveRecommendationBlock } from "./shared/studio-executive-recommendation-block";

type Props = {
  selection: CreatorDrawerSelection | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Planning signal already hydrated on the card, when the section has one. */
  signal?: StudioEciPlanningSignal | null;
};

/**
 * Studio's creator detail — Discovery's detail sheet, not a copy of it.
 *
 * The creator is resolved with `getUnifiedCreatorsBatchAction`, the same action
 * the Studio creator hydration already calls, and handed to Discovery's
 * `CreatorDetailSheet`. That component loads its own detail, enrichment status,
 * platform accounts and tabs, so the Studio operator sees exactly what
 * Discovery shows, from the same data, with one implementation to maintain.
 *
 * The campaign's executive recommendation rides in the sheet's `contextSlot`
 * so planning context is not lost to the parity change.
 *
 * Until that record resolves — and for a creator that has none, such as one
 * just added by URL before enrichment returns — the SAME pack renders with the
 * identity from the clicked card and its own loading state. It is never
 * replaced by a different drawer: showing the planning sheet for those seconds
 * and swapping it out was the transition the operator saw.
 */
export function StudioCreatorDetailHost({ selection, open, onOpenChange, signal }: Props) {
  const [creator, setCreator] = useState<UnifiedCreatorResult | null>(null);
  const creatorId = selection?.id?.trim() || null;

  useEffect(() => {
    if (!open || !creatorId) {
      setCreator(null);
      return;
    }

    let cancelled = false;
    setCreator(null);
    void getUnifiedCreatorsBatchAction([creatorId])
      .then((rows) => {
        if (cancelled) return;
        setCreator(rows[0] ?? null);
      })
      .catch(() => {
        if (!cancelled) setCreator(null);
      });

    return () => {
      cancelled = true;
    };
  }, [open, creatorId]);

  // One component, always. The canonical pack opens on click and shows its own
  // loading state; it is never replaced by a different drawer. The planning
  // recommendation lives in the pack's Campaign tab.
  return (
    <CreatorDetailSheet
      key={creator?.unified_id ?? creatorId ?? "pending"}
      creator={creator}
      open={open}
      onOpenChange={onOpenChange}
      presentation="discoveryPack"
      pendingIdentity={
        selection
          ? {
              displayName: selection.displayName,
              handle: selection.handle ?? null,
              avatarUrl: selection.avatarUrl ?? null,
              profileUrl: selection.profileUrl ?? null,
              platform: selection.platform ?? null,
              countryLabel: selection.country ?? null,
            }
          : null
      }
      contextSlot={
        <StudioExecutiveRecommendationBlock
          creatorId={creatorId}
          signal={signal}
          active={open}
        />
      }
    />
  );
}
