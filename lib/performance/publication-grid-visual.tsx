"use client";

import { useState, type SyntheticEvent } from "react";

import type { CampaignPublicationRow } from "@/lib/domains/campaign/types";
import { resolvePublicationContentPreviewUrl } from "@/lib/performance/publication-preview";
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

/** PREVIEW — post screenshot/thumbnail only (never creator avatars or platform icons). */
export function PublicationContentPreviewThumb({
  row,
  className,
}: {
  row: Pick<CampaignPublicationRow, "screenshot_url" | "thumbnail_url">;
  className?: string;
}) {
  const previewUrl = resolvePublicationContentPreviewUrl(row);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  if (!previewUrl || failedUrl === previewUrl) {
    return <span className="text-[10px] text-[#C4CAD4]">—</span>;
  }

  const handleError = (event: SyntheticEvent<HTMLImageElement>) => {
    event.currentTarget.onerror = null;
    setFailedUrl(previewUrl);
  };

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={previewUrl}
      src={previewUrl}
      alt=""
      className={className ?? "size-9 rounded border border-border object-cover"}
      onError={handleError}
    />
  );
}
