"use client";

import { CreatorNameStack } from "@/components/creator/creator-name-stack";
import { CreatorThumbAvatar } from "@/components/creator/creator-thumb-cell";
import { resolveCreatorIdentity } from "@/lib/text/decode-html-entities";
import { cn } from "@/lib/utils";

const INSTAGRAM_ICON_PATH =
  "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z";

const TIKTOK_ICON_PATH =
  "M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V9.02a8.19 8.19 0 004.78 1.52V7.1a4.85 4.85 0 01-1.01-.41z";

type PlatformBadge = "instagram" | "tiktok";

type Props = {
  name: string;
  handle?: string | null;
  avatarUrl?: string | null;
  platform?: PlatformBadge | null;
  className?: string;
};

function PlatformThumbBadge({ platform }: { platform: PlatformBadge }) {
  const isInstagram = platform === "instagram";

  return (
    <div
      className={cn(
        "thinkway-campaign-cr-plat-badge",
        isInstagram ? "thinkway-campaign-cr-plat-badge-ig" : "thinkway-campaign-cr-plat-badge-tt"
      )}
      aria-hidden
    >
      <svg fill="#fff" viewBox="0 0 24 24" width="7" height="7">
        <path d={isInstagram ? INSTAGRAM_ICON_PATH : TIKTOK_ICON_PATH} />
      </svg>
    </div>
  );
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
