"use client";

import { useEffect } from "react";

import { loadCampaignListNavIdsAction } from "@/features/campaigns/actions/campaign-list-nav-ids";
import {
  buildListNavFilterKey,
  writeListNavContext,
} from "@/lib/navigation/list-nav-context";

type CampaignsListNavSyncProps = {
  search: string;
};

/** Writes full filtered campaign id set into sessionStorage for Previous/Next. */
export function CampaignsListNavSync({ search }: CampaignsListNavSyncProps) {
  useEffect(() => {
    let cancelled = false;
    const filterKey = buildListNavFilterKey({ q: search.trim() });
    void loadCampaignListNavIdsAction({ search }).then((result) => {
      if (cancelled || !result.ok) return;
      writeListNavContext("campaigns", { ids: result.ids, filterKey });
    });
    return () => {
      cancelled = true;
    };
  }, [search]);

  return null;
}
