"use client";

import Link from "next/link";

import { CreatorThumbAvatar } from "@/components/creator/creator-thumb-cell";
import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import { cn } from "@/lib/utils";

const INSTAGRAM_ICON_PATH =
  "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z";

const TIKTOK_ICON_PATH =
  "M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V9.02a8.19 8.19 0 004.78 1.52V7.1a4.85 4.85 0 01-1.01-.41z";

function platformBadgeKey(platform: string): "instagram" | "tiktok" | null {
  const key = canonicalPlatformKey(platform);
  if (key === "instagram") return "instagram";
  if (key === "tiktok") return "tiktok";
  return null;
}

function PlatformThumbBadge({ platform }: { platform: "instagram" | "tiktok" }) {
  const isInstagram = platform === "instagram";

  return (
    <div
      className={cn(
        "thinkway-campaign-cr-plat-badge thinkway-campaign-cr-plat-badge--perf",
        isInstagram ? "thinkway-campaign-cr-plat-badge-ig" : "thinkway-campaign-cr-plat-badge-tt"
      )}
      aria-hidden
    >
      <svg fill="#fff" viewBox="0 0 24 24" width="8" height="8">
        <path d={isInstagram ? INSTAGRAM_ICON_PATH : TIKTOK_ICON_PATH} />
      </svg>
    </div>
  );
}

type PerformanceExplorerCreatorCellProps = {
  name: string | null | undefined;
  platform: string;
  avatarUrl?: string | null;
  influencerId?: string | null;
  onOpenPublication?: () => void;
  className?: string;
};

function CreatorVendorAvatarLink({
  influencerId,
  name,
  avatarUrl,
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
  platform,
  avatarUrl,
  influencerId,
  onOpenPublication,
  className,
}: PerformanceExplorerCreatorCellProps) {
  if (!name?.trim()) {
    return <span className="thinkway-campaign-c-gray">—</span>;
  }

  const badgePlatform = platformBadgeKey(platform);
  const displayName = name.trim();

  return (
    <div className={cn("thinkway-campaign-cr-cell", className)}>
      {influencerId ? (
        <CreatorVendorAvatarLink
          influencerId={influencerId}
          name={displayName}
          avatarUrl={avatarUrl}
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
            platform={platform}
            size={38}
            shape="rounded"
          />
          {badgePlatform ? <PlatformThumbBadge platform={badgePlatform} /> : null}
        </div>
      )}
      <div className="flex min-w-0 items-center gap-[5px]">
        {influencerId ? (
          <CreatorVendorAvatarLink
            influencerId={influencerId}
            name={displayName}
            avatarUrl={avatarUrl}
            platform={platform}
            size={20}
            className="thinkway-campaign-cr-av-circle border-0"
          />
        ) : (
          <CreatorThumbAvatar
            name={displayName}
            avatarUrl={avatarUrl}
            platform={platform}
            size={20}
            className="thinkway-campaign-cr-av-circle border-0"
          />
        )}
        {onOpenPublication ? (
          <button
            type="button"
            onClick={onOpenPublication}
            className="min-w-0 truncate text-left transition-colors hover:text-primary focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
            title={`View ${displayName} publication details`}
          >
            <span className="thinkway-campaign-cr-name">{displayName}</span>
          </button>
        ) : (
          <span className="thinkway-campaign-cr-name">{displayName}</span>
        )}
      </div>
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
