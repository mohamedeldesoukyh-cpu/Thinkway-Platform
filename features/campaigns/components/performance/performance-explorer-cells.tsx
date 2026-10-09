import { PlatformIcon } from "@/lib/performance/platform-icon";

import Link from "next/link";

import { CreatorNameStack } from "@/components/creator/creator-name-stack";
import { CreatorThumbAvatar } from "@/components/creator/creator-thumb-cell";
import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import { resolveCreatorIdentity } from "@/lib/text/decode-html-entities";
import { cn } from "@/lib/utils";


function platformBadgeKey(platform: string): "instagram" | "tiktok" | null {
  const key = canonicalPlatformKey(platform);
  if (key === "instagram") return "instagram";
  if (key === "tiktok") return "tiktok";
  return null;
}

function PlatformThumbBadge({ platform }: { platform: string }) {
 return <span className="thinkway-campaign-cr-plat-badge" style={{background:"transparent",border:0,boxShadow:"none",borderRadius:0,width:16,height:16}}><PlatformIcon platform={platform} size="xs" className="size-4" /></span>;
}

type PerformanceExplorerCreatorCellProps = {
  name: string | null | undefined;
  handle?: string | null;
  platform: string;
  avatarUrl?: string | null;
  profileUrl?: string | null;
  influencerId?: string | null;
  onOpenPublication?: () => void;
  className?: string;
};

function CreatorVendorAvatarLink({
  influencerId,
  name,
  avatarUrl,
  profileUrl,
  platform,
  size,
  shape,
  className,
  wrapClassName,
  badgePlatform,
}: {
  influencerId: string;
  name: string;
  avatarUrl?: string | null;
  profileUrl?: string | null;
  platform: string;
  size: 20 | 38;
  shape?: "circle" | "rounded";
  className?: string;
  wrapClassName?: string;
  badgePlatform?: "instagram" | "tiktok" | null;
}) {
  const avatar = (
    <CreatorThumbAvatar
      name={name}
      avatarUrl={avatarUrl}
      profileUrl={profileUrl}
      platform={platform}
      size={size}
      shape={shape}
      className={className}
    />
  );

  return (
    <Link
      href={`/vendors/${influencerId}`}
      className={cn(
        wrapClassName,
        "shrink-0 rounded-md focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
      )}
      title={`View ${name} profile`}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {badgePlatform != null ? (
        <>
          {avatar}
          <PlatformThumbBadge platform={badgePlatform} />
        </>
      ) : (
        avatar
      )}
    </Link>
  );
}

/** Creator column — 38px thumb + platform overlay + circle avatar + name (panel-performance). */
export function PerformanceExplorerCreatorCell({
  name,
  handle,
  platform,
  avatarUrl,
  profileUrl,
  influencerId,
  onOpenPublication,
  className,
}: PerformanceExplorerCreatorCellProps) {
  const identity = resolveCreatorIdentity(name, handle);
  const displayName = identity.name?.trim();
  if (!displayName) {
    return <span className="thinkway-campaign-c-gray">—</span>;
  }

  const badgePlatform = platformBadgeKey(platform);

  return (
    <div className={cn("thinkway-campaign-cr-cell", className)}>
      {influencerId ? (
        <CreatorVendorAvatarLink
          influencerId={influencerId}
          name={displayName}
          avatarUrl={avatarUrl}
          profileUrl={profileUrl}
          platform={platform}
          size={38}
          shape="rounded"
          wrapClassName="thinkway-campaign-cr-thumb-wrap thinkway-campaign-cr-thumb-wrap--perf"
          badgePlatform={badgePlatform}
        />
      ) : (
        <div className="thinkway-campaign-cr-thumb-wrap thinkway-campaign-cr-thumb-wrap--perf">
          <CreatorThumbAvatar
            name={displayName}
            avatarUrl={avatarUrl}
            profileUrl={profileUrl}
            platform={platform}
            size={38}
            shape="rounded"
          />
          {badgePlatform ? <PlatformThumbBadge platform={badgePlatform} /> : null}
        </div>
      )}
      {onOpenPublication ? (
        <button
          type="button"
          onClick={onOpenPublication}
          className="min-w-0 truncate text-left transition-colors hover:text-primary focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
          title={`View ${displayName} publication details`}
        >
          <CreatorNameStack
            name={identity.name}
            handle={identity.handle}
            nameClassName="thinkway-campaign-cr-name text-[11px]"
            handleClassName="text-[10px] text-[var(--camp-text-3)]"
          />
        </button>
      ) : (
        <CreatorNameStack
          name={identity.name}
          handle={identity.handle}
          nameClassName="thinkway-campaign-cr-name text-[11px]"
          handleClassName="text-[10px] text-[var(--camp-text-3)]"
        />
      )}
    </div>
  );
}

const METRICS_STATUS_LABELS: Record<string, string> = {
  completed: "Completed",
  manual_required: "Manual req.",
  partial: "Partial",
  failed: "Failed",
  queued: "Queued",
  collecting: "Collecting",
  pending: "Pending",
};

function metricsStatusBadgeClass(status: string | null | undefined): string {
  switch (status) {
    case "completed":
      return "thinkway-campaign-badge-green";
    case "manual_required":
      return "thinkway-campaign-badge-purple";
    case "partial":
      return "thinkway-campaign-badge-amber";
    case "failed":
      return "thinkway-campaign-badge-red";
    case "collecting":
    case "queued":
      return "thinkway-campaign-badge-blue";
    default:
      return "thinkway-campaign-badge-gray";
  }
}

type PerformanceMetricsStatusBadgeProps = {
  status: string | null | undefined;
  className?: string;
};

export function PerformanceMetricsStatusBadge({
  status,
  className,
}: PerformanceMetricsStatusBadgeProps) {
  const key = String(status ?? "pending").replace(/-/g, "_");
  const label = METRICS_STATUS_LABELS[key] ?? key.replace(/_/g, " ");

  return (
    <span className={cn("thinkway-campaign-badge", metricsStatusBadgeClass(key), className)}>
      {label}
    </span>
  );
}

export function PublicationDuplicateBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "thinkway-campaign-badge thinkway-campaign-badge-amber",
        className
      )}
      title="This content URL appears more than once on the campaign"
    >
      Duplicate
    </span>
  );
}
