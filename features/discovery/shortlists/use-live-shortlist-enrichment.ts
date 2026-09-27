"use client";

import { useEffect, useState } from "react";
import type { ShortlistCreatorItem } from "./types";
import { isEnrichmentInProgress, resolveCreatorEnrichmentStatus } from "../enrichment/status";
import { getShortlistEnrichmentUpdates } from "./enrichment-live-action";
import { watchShortlistEnrichment } from "./enrichment-live-poll";

type Updates = Awaited<ReturnType<typeof getShortlistEnrichmentUpdates>>;

export function useLiveShortlistEnrichment(
  shortlistId: string,
  creators: ShortlistCreatorItem[],
  onUpdated: (updates: Updates) => void,
  paused: boolean,
) {
  const [connectionDelayed, setConnectionDelayed] = useState(false);
  const pendingIds = JSON.stringify(creators
    .filter((item) => isEnrichmentInProgress(resolveCreatorEnrichmentStatus(item.creator?.enrichment_status)))
    .map((item) => item.item_id).sort());

  useEffect(() => {
    const ids = JSON.parse(pendingIds) as string[];
    if (paused || ids.length === 0) return;
    return watchShortlistEnrichment({
      fetch: async () => {
        const updates: Updates = [];
        for (let i = 0; i < ids.length; i += 100) {
          updates.push(...await getShortlistEnrichmentUpdates(shortlistId, ids.slice(i, i + 100)));
        }
        return updates;
      },
      onData: onUpdated,
      onError: setConnectionDelayed,
    });
  }, [shortlistId, pendingIds, paused, onUpdated]);

  return connectionDelayed && pendingIds !== "[]" && !paused;
}
