"use client";

import { useEffect, useState } from "react";

import { CreatorDetailSheet } from "@/features/campaigns/components/creator-detail-sheet-lazy";
import { getUnifiedCreatorsBatchAction } from "@/features/campaigns/creator-discovery-actions";
import {
  CreatorDrawer,
  type CreatorDrawerSelection,
} from "@/features/campaign-decision-workspace/components/creator-drawer";
import type { UnifiedCreatorResult } from "@/lib/creators/types";

function resolveUnifiedId(selection: CreatorDrawerSelection | null): string | null {
  const id = selection?.id?.trim();
  if (!id) return null;
  if (id.startsWith("inf:") || id.startsWith("dis:")) return id;
  return id;
}

type Props = {
  selection: CreatorDrawerSelection | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreatorUpdated?: (creator: UnifiedCreatorResult) => void;
};

/** Opens full Discovery detail sheet when unified data exists; slim drawer as fallback. */
export function DiscoveryCreatorDetailHost({
  selection,
  open,
  onOpenChange,
  onCreatorUpdated,
}: Props) {
  const [creator, setCreator] = useState<UnifiedCreatorResult | null>(null);
  const unifiedId = resolveUnifiedId(selection);

  useEffect(() => {
    if (!open || !unifiedId) {
      setCreator(null);
      return;
    }

    let cancelled = false;
    void getUnifiedCreatorsBatchAction([unifiedId]).then((rows) => {
      if (!cancelled) setCreator(rows[0] ?? null);
    });

    return () => {
      cancelled = true;
    };
  }, [open, unifiedId]);

  if (creator) {
    return (
      <CreatorDetailSheet
        creator={creator}
        open={open}
        onOpenChange={onOpenChange}
        onCreatorUpdated={onCreatorUpdated}
        presentation="discoveryPack"
      />
    );
  }

  return <CreatorDrawer creator={selection} open={open} onOpenChange={onOpenChange} />;
}
