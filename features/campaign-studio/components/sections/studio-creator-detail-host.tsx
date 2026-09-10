"use client";

import { useEffect, useState } from "react";

import { CreatorDetailSheet } from "@/features/campaigns/components/creator-detail-sheet-lazy";
import { getUnifiedCreatorsBatchAction } from "@/features/campaigns/creator-discovery-actions";
import type { CreatorDrawerSelection } from "@/features/campaign-decision-workspace/components/creator-drawer";
import type { StudioEciPlanningSignal } from "@/features/campaign-studio/services/eci/project-studio-eci-signal";
import {
  discoveryDetailStateForSource,
  resolveStudioCreatorDetailSource,
} from "@/features/campaign-studio/services/studio-creator-detail-source";
import type { UnifiedCreatorResult } from "@/lib/creators/types";

import { StudioExecutiveRecommendationBlock } from "./shared/studio-executive-recommendation-block";
import { StudioPlanningCreatorDetail } from "./studio-planning-creator-detail";

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
 * When a creator has no unified record yet — one just added by URL, before
 * enrichment returns — there is no Discovery detail to show, so the planning
 * sheet renders with an explicit loading or unavailable line instead of a
 * half-populated profile.
 */
export function StudioCreatorDetailHost({ selection, open, onOpenChange, signal }: Props) {
  const [creator, setCreator] = useState<UnifiedCreatorResult | null>(null);
  const [resolving, setResolving] = useState(false);
  const creatorId = selection?.id?.trim() || null;

  useEffect(() => {
    if (!open || !creatorId) {
      setCreator(null);
      setResolving(false);
      return;
    }

    let cancelled = false;
    setCreator(null);
    setResolving(true);
    void getUnifiedCreatorsBatchAction([creatorId])
      .then((rows) => {
        if (cancelled) return;
        setCreator(rows[0] ?? null);
      })
      .catch(() => {
        if (!cancelled) setCreator(null);
      })
      .finally(() => {
        if (!cancelled) setResolving(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, creatorId]);

  const source = resolveStudioCreatorDetailSource({
    open,
    creatorId,
    unifiedCreatorResolved: Boolean(creator),
    resolving,
  });

  if (source === "discovery_detail" && creator) {
    return (
      <CreatorDetailSheet
        key={creator.unified_id}
        creator={creator}
        open={open}
        onOpenChange={onOpenChange}
        presentation="sheet"
        contextSlot={
          <StudioExecutiveRecommendationBlock
            creatorId={creatorId}
            displayName={selection?.displayName}
            signal={signal}
            active={open}
          />
        }
      />
    );
  }

  return (
    <StudioPlanningCreatorDetail
      selection={selection}
      open={open}
      onOpenChange={onOpenChange}
      signal={signal}
      discoveryDetailState={discoveryDetailStateForSource(source)}
    />
  );
}
