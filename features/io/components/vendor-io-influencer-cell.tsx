"use client";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CreatorDetailSheet } from "@/features/campaigns/components/creator-detail-sheet-lazy";
import { getUnifiedCreatorsBatchAction } from "@/features/campaigns/creator-discovery-actions";
import { useCampaignAssignmentHierarchyRefresh, useRefreshCampaignAfterOperationalMutation } from "@/features/campaigns/hooks/campaign-operational-refresh";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { PlatformIcon } from "@/lib/performance/platform-icon";

import { CreatorNameStack } from "@/components/creator/creator-name-stack";
import { CreatorThumbAvatar } from "@/components/creator/creator-thumb-cell";
import { resolveCreatorIdentity } from "@/lib/text/decode-html-entities";
import { cn } from "@/lib/utils";


type PlatformBadge = "instagram" | "tiktok";

type Props = {
  name: string;
  creatorId?: string;
  triggerLabel?: string;
  handle?: string | null;
  avatarUrl?: string | null;
  platform?: PlatformBadge | null;
  className?: string;
};

function PlatformThumbBadge({ platform }: { platform: string }) {
 return <span className="thinkway-campaign-cr-plat-badge" style={{background:"transparent",border:0,boxShadow:"none",borderRadius:0,width:16,height:16}}><PlatformIcon platform={platform} size="xs" className="size-4" /></span>;
}

/** Influencer column — avatar + name over @username. */
export function VendorIoInfluencerCell({
  name,
  creatorId,
  triggerLabel,
  handle,
  avatarUrl,
  platform = null,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [creator, setCreator] = useState<UnifiedCreatorResult | null>(null);
  const request = useRef(0);
  const refresh = useRefreshCampaignAfterOperationalMutation();
  const refreshAssignments = useCampaignAssignmentHierarchyRefresh();
  useEffect(() => () => { request.current++; }, []);
  async function openDetails() {
    if (!creatorId) return;
    const version = ++request.current;
    setCreator(null); setOpen(true);
    try {
      const [record] = await getUnifiedCreatorsBatchAction([creatorId]);
      if (version !== request.current) return;
      if (!record) throw new Error('Creator unavailable');
      setCreator(record);
    } catch {
      if (version !== request.current) return;
      setOpen(false); toast.error('Could not load creator details. Please try again.');
    }
  }
  const identity = resolveCreatorIdentity(name, handle);

  const content = (
    <div className={cn("thinkway-campaign-cr-cell", className)}>
      <div className="thinkway-campaign-cr-thumb-wrap thinkway-campaign-cr-thumb-wrap--vio">
        <CreatorThumbAvatar
          name={identity.name}
          avatarUrl={avatarUrl}
          platform={platform}
          size={28}
          shape="rounded"
        />
        {platform ? <PlatformThumbBadge platform={platform} /> : null}
      </div>
      <CreatorNameStack
        name={identity.name}
        handle={identity.handle}
        nameClassName="thinkway-campaign-cr-name text-[11px] font-medium"
        handleClassName="text-[10px] text-muted-foreground"
      />
    </div>
  );
  return <>
    {creatorId ? <button type="button" className="w-full min-w-0 text-left rounded focus-visible:outline-2 focus-visible:outline-blue-600 hover:text-blue-600" aria-label={`View creator details for ${identity.name}`} onClick={event => { event.stopPropagation(); void openDetails(); }}>{triggerLabel ?? content}</button> : content}
    {open && <CreatorDetailSheet creator={creator} open presentation="discoveryPack" preserveOpenOnCreatorRows={false} pendingIdentity={{displayName:identity.name,handle:identity.handle,avatarUrl}} onOpenChange={value=>{setOpen(value);if(!value)request.current++;}} onCreatorUpdated={next=>{setCreator(next);refresh();void refreshAssignments?.().catch(()=>toast.error('Creator saved. Refresh assignments to see the changes.'));}}/>}
  </>;
}
