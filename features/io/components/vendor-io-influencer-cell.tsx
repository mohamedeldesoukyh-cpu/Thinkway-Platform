"use client";
import { PlatformIcon } from "@/lib/performance/platform-icon";

import { CreatorNameStack } from "@/components/creator/creator-name-stack";
import { CreatorThumbAvatar } from "@/components/creator/creator-thumb-cell";
import { resolveCreatorIdentity } from "@/lib/text/decode-html-entities";
import { cn } from "@/lib/utils";


type PlatformBadge = "instagram" | "tiktok";

type Props = {
  name: string;
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
  handle,
  avatarUrl,
  platform = "instagram",
  className,
}: Props) {
  const identity = resolveCreatorIdentity(name, handle);

  return (
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
}
