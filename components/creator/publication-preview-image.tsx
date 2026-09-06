"use client";

import { useEffect, useState } from "react";
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

function PreviewPlaceholder({
  emptyGlyph,
  className,
  placeholderClassName,
}: {
  emptyGlyph?: string;
  className?: string;
  placeholderClassName?: string;
}) {
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

/**
 * Publication thumbnail that survives Phase 2 media-proxy fail-fast 404s by
 * retrying after background `after()` warm (same path as feed thumbs / avatars).
 * Placeholder stays visible until a frame actually loads — no native broken-image glyph.
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
  const displaySrc = (recovery.displaySrc ?? resolved)?.trim() || null;
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
  }, [displaySrc]);

  if (!displaySrc || recovery.exhausted) {
    return (
      <PreviewPlaceholder
        emptyGlyph={emptyGlyph}
        className={className}
        placeholderClassName={placeholderClassName}
      />
    );
  }

  return (
    <span className={cn("relative block size-full overflow-hidden", className)}>
      {!loaded ? (
        <PreviewPlaceholder
          emptyGlyph={emptyGlyph}
          className="absolute inset-0"
          placeholderClassName={placeholderClassName}
        />
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element -- remote social CDN thumbs via proxy */}
      <img
        key={displaySrc}
        src={displaySrc}
        alt=""
        referrerPolicy="no-referrer"
        loading="lazy"
        className={cn(
          "size-full object-cover transition-opacity",
          loaded ? "opacity-100" : "opacity-0",
          imgClassName
        )}
        onLoad={() => setLoaded(true)}
        onError={() => {
          setLoaded(false);
          recovery.onError();
        }}
      />
    </span>
  );
}
