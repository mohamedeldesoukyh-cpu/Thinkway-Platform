"use client";

import { ImageIcon } from "lucide-react";

import { useMediaProxyImageRecovery } from "@/hooks/use-media-proxy-image-recovery";
import { creatorRecentPublicationDisplayUrl } from "@/lib/creators/recent-publication-thumb";
import type { CreatorRecentPublication } from "@/lib/creators/types";
import { cn } from "@/lib/utils";

type PublicationPreviewImageProps = {
  publication?: CreatorRecentPublication | Record<string, unknown> | null;
  /** Pre-resolved display URL (proxy or direct). Prefer `publication` when available. */
  src?: string | null;
  className?: string;
  imgClassName?: string;
  placeholderClassName?: string;
  /** Compact glyph used by Discovery pack cards when no image is available. */
  emptyGlyph?: string;
};

/**
 * Publication thumbnail that survives Phase 2 media-proxy fail-fast 404s by
 * retrying after background `after()` warm (same path as feed thumbs / avatars).
 */
export function PublicationPreviewImage({
  publication,
  src,
  className,
  imgClassName,
  placeholderClassName,
  emptyGlyph,
}: PublicationPreviewImageProps) {
  const resolved =
    src?.trim() ||
    (publication ? creatorRecentPublicationDisplayUrl(publication) : null);
  const recovery = useMediaProxyImageRecovery(resolved);

  if (!resolved || recovery.exhausted) {
    if (emptyGlyph !== undefined) {
      return (
        <div className={cn("flex size-full items-center justify-center", className, placeholderClassName)}>
          {emptyGlyph}
        </div>
      );
    }
    return (
      <div
        className={cn(
          "flex size-full flex-col items-center justify-center gap-1.5 bg-muted/30 text-muted-foreground",
          placeholderClassName,
          className
        )}
      >
        <ImageIcon className="size-5 opacity-60" aria-hidden />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- remote social CDN thumbs via proxy
    <img
      key={recovery.displaySrc ?? resolved}
      src={recovery.displaySrc ?? resolved}
      alt=""
      referrerPolicy="no-referrer"
      loading="lazy"
      className={cn("size-full object-cover", imgClassName, className)}
      onError={recovery.onError}
    />
  );
}
