"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { CampaignObject } from "@/features/campaign-intelligence";
import { staleCampaignOutputKinds } from "../output-registry";

function parentOverlaySyncKey(campaignObject: CampaignObject | undefined): string {
  if (!campaignObject) return "";
  const staleKinds = staleCampaignOutputKinds(campaignObject);
  return `${campaignObject.id}:${campaignObject.updatedAt}:${staleKinds.join(",")}`;
}

/**
 * Optimistic local overlay for studio surfaces. Keeps fresher client-side edits
 * until the parent prop catches up — without wiping stale output flags on a
 * matching updatedAt from a partial parent refresh.
 */
export function useCampaignObjectOverlay(campaignObject: CampaignObject | undefined) {
  const [localCampaignObject, setLocalCampaignObject] = useState<CampaignObject | null>(null);
  const campaignObjectRef = useRef(campaignObject);
  campaignObjectRef.current = campaignObject;

  const parentStaleKey = campaignObject
    ? staleCampaignOutputKinds(campaignObject).join(",")
    : "";
  const parentSyncKey = useMemo(
    () => parentOverlaySyncKey(campaignObject),
    [campaignObject?.id, campaignObject?.updatedAt, parentStaleKey]
  );

  useEffect(() => {
    const parent = campaignObjectRef.current;
    if (!parent) {
      setLocalCampaignObject(null);
      return;
    }

    setLocalCampaignObject((prev) => {
      if (!prev || prev.id !== parent.id) return null;

      const parentAt = Date.parse(parent.updatedAt);
      const localAt = Date.parse(prev.updatedAt);
      if (parentAt > localAt) return null;

      const parentStale = staleCampaignOutputKinds(parent).length;
      const localStale = staleCampaignOutputKinds(prev).length;
      if (localStale > parentStale) return prev;

      if (parentAt >= localAt) return null;
      return prev;
    });
  }, [parentSyncKey]);

  const effectiveCampaignObject = localCampaignObject ?? campaignObject;

  return { effectiveCampaignObject, setLocalCampaignObject };
}
