"use client";

import type { ReactNode } from "react";

import { useMediaProxyImageRecovery } from "@/hooks/use-media-proxy-image-recovery";

import type { CampaignPublicationRow } from "@/lib/domains/campaign/types";
import { resolveCampaignPublicationDisplayPreviewUrl } from "@/lib/performance/publication-preview";
import { PlatformIcon } from "@/lib/performance/platform-icon";
import { resolvePlatformThumbDisplay } from "@/lib/performance/publication-grid-visual-resolvers";

/** THUMB — platform icon only (never creator photos). */
export function PublicationPlatformThumb({
  row,
  className,
}: {
  row: Pick<CampaignPublicationRow, "platform" | "publication_type" | "content_url">;
  className?: string;
}) {
  const { platform } = resolvePlatformThumbDisplay(row);
  return <PlatformIcon platform={platform} size="sm" className={className} />;
}

type PublicationPreviewRow = Pick<
  CampaignPublicationRow,
  "screenshot_url" | "thumbnail_url" | "content_url"
>;

/** Post snapshot with media-proxy retry after the fail-fast 404 + background warm. */
export function PublicationContentPreviewImage({
  row,
  className,
  fallback = null,
}: {
  row: PublicationPreviewRow;
  className?: string;
  fallback?: ReactNode;
}) {
  const previewUrl = resolveCampaignPublicationDisplayPreviewUrl(row);
  const recovery = useMediaProxyImageRecovery(previewUrl);

  if (!previewUrl || recovery.exhausted) return fallback;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={recovery.displaySrc ?? previewUrl}
      src={recovery.displaySrc ?? previewUrl}
      alt=""
      referrerPolicy="no-referrer"
      className={className}
      onError={recovery.onError}
    />
  );
}

/** PREVIEW — post screenshot/thumbnail/live-post proxy (never creator avatars or platform icons). */
export function PublicationContentPreviewThumb({
  row,
  className,
}: {
  row: PublicationPreviewRow;
  className?: string;
}) {
  return (
    <PublicationContentPreviewImage
      row={row}
      className={className ?? "size-9 rounded border border-border object-cover"}
      fallback={<span className="text-[10px] text-[#C4CAD4]">—</span>}
    />
  );
}
