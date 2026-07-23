"use client";

import { useEffect, useMemo, useState } from "react";

import { getCreatorHoverDetailsAction } from "@/features/campaigns/creator-discovery-actions";
import { resolveDiscoveryCreatorHandleLabel } from "@/features/discovery/view-models/discovery-creator-view-model";
import {
  formatCollaborationsLine,
  formatCreatorRecencyLabel,
  type CreatorHoverDetails,
} from "@/lib/creators/creator-hover-details";
import type { UnifiedCreatorResult } from "@/lib/creators/types";

export function useDiscoveryCreatorHoverDetails(creator: UnifiedCreatorResult) {
  const [details, setDetails] = useState<CreatorHoverDetails | null>(null);
  const [loading, setLoading] = useState(true);

  const handleLabel = resolveDiscoveryCreatorHandleLabel(creator.platforms[0] ?? null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    void getCreatorHoverDetailsAction(creator.unified_id)
      .then((result) => {
        if (!cancelled) setDetails(result);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [creator.unified_id]);

  const secondaryLine = useMemo(() => {
    const collabLine = details
      ? formatCollaborationsLine(
          details.totalCollaborations,
          details.collaborationsWithYou
        )
      : loading
        ? "Loading collaborations…"
        : formatCollaborationsLine(0, 0);

    if (handleLabel) {
      return `${handleLabel} · ${collabLine}`;
    }
    return collabLine;
  }, [details, handleLabel, loading]);

  const statusLabel =
    details?.statusLabel ??
    formatCreatorRecencyLabel(creator.last_enriched_at, creator.updated_at);

  return { details, loading, secondaryLine, statusLabel, handleLabel };
}
