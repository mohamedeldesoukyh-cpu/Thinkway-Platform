"use client";

import { useEffect, useState } from "react";
import { EntityPrevNext } from "@/components/navigation/entity-prev-next";
import { loadCampaignJumpOptionsAction } from "@/features/campaigns/actions/load-campaign-jump-options";
import { campaignDetailPath } from "@/lib/routing/entity-paths";

export function CampaignSerialNavigation({ currentId, activeTab }: { currentId: string; activeTab: string }) {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    void loadCampaignJumpOptionsAction({ limit: 5000 }).then((result) => {
      if (!cancelled && result.ok) setIds(result.options.map((row) => row.id));
    });
    return () => { cancelled = true; };
  }, []);
  return <EntityPrevNext entity="campaigns" currentId={currentId} orderedIds={ids}
    hrefForId={(id) => `${campaignDetailPath(id)}?tab=${encodeURIComponent(activeTab)}`}
    className="shrink-0" />;
}
