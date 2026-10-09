"use client";

import { UserIcon } from "lucide-react";
import { useEffect, useRef, useState, type ComponentProps } from "react";

import { useMediaProxyImageRecovery } from "@/hooks/use-media-proxy-image-recovery";
import { creatorAvatarBrowserDisplayUrl } from "@/lib/performance/creator-avatar";
import { cn } from "@/lib/utils";

const AVATAR_SIZE_CLASS = {
  xs: "size-6",
  sm: "size-10",
  md: "size-12",
  lg: "size-14",
} as const;

const AVATAR_CONTAINER_CLASS =
  "relative shrink-0 overflow-hidden rounded-full border border-border";

export type CreatorAvatarImageSize = keyof typeof AVATAR_SIZE_CLASS;

function isRawHttpAvatarUrl(url: string | null | undefined): url is string {
  const trimmed = url?.trim();
  if (!trimmed) return false;
  return /^https?:\/\//i.test(trimmed);
}

function CreatorAvatarImageInstance({
  avatarUrl,
  profileUrl,
  size = "md",
  sizeClassName,
  className,
  alt = "",
  onFailed,
}: {
  avatarUrl: string | null | undefined;
  /** External social profile URL — enables server OpenGraph fallback when CDN src fails. */
  profileUrl?: string | null;
  size?: CreatorAvatarImageSize;
  sizeClassName?: string;
  className?: string;
  alt?: string;
  onFailed?: () => void;
}) {
  const dim = sizeClassName ?? AVATAR_SIZE_CLASS[size];
  const primarySrc = creatorAvatarBrowserDisplayUrl(avatarUrl, profileUrl);
  const profileOnlySrc = profileUrl
    ? creatorAvatarBrowserDisplayUrl(null, profileUrl)
    : null;
  const rawCdnSrc = isRawHttpAvatarUrl(avatarUrl) ? avatarUrl.trim() : null;
  const [useProfileFallback, setUseProfileFallback] = useState(false);
  const [useRawCdnFallback, setUseRawCdnFallback] = useState(false);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const failedImages = useRef(new WeakSet<HTMLImageElement>());
  const imageRef = useRef<HTMLImageElement>(null);

  const activeBase =
    useProfileFallback && profileOnlySrc && profileOnlySrc !== primarySrc
      ? profileOnlySrc
      : primarySrc;

  const recovery = useMediaProxyImageRecovery(activeBase);
  const notifiedFail = useRef(false);

  useEffect(() => {
    if (!recovery.exhausted) return;
    if (rawCdnSrc && !useRawCdnFallback) return;
    if (notifiedFail.current) return;
    notifiedFail.current = true;
    onFailed?.();
  }, [recovery.exhausted, rawCdnSrc, useRawCdnFallback, onFailed]);

  const rawFallback = recovery.exhausted && rawCdnSrc && !useRawCdnFallback;
  const src = rawFallback ? rawCdnSrc : activeBase && !recovery.exhausted
    ? recovery.displaySrc ?? activeBase : null;
  const loaded = Boolean(src && loadedSrc === src);
  const handleImageFailure = (image: HTMLImageElement) => {
    // Hydration and the native error event can both observe the same failure.
    if (failedImages.current.has(image)) return;
    failedImages.current.add(image);
    setLoadedSrc(null);
    if (rawFallback) {
      setUseRawCdnFallback(true);
      return;
    }
    if (!useProfileFallback && profileOnlySrc && profileOnlySrc !== primarySrc) {
      setUseProfileFallback(true);
      return;
    }
    recovery.onError();
  };
  useEffect(() => {
    // A cached response can finish before hydration attaches native handlers.
    // Run after the recovery hook initializes, and only reconcile unsettled state.
    const image = imageRef.current;
    if (!src || !image?.complete) return;
    if (image.naturalWidth > 0) {
      if (loadedSrc !== src) setLoadedSrc(src);
    } else {
      handleImageFailure(image);
    }
  });
  return (
    <div className={cn(AVATAR_CONTAINER_CLASS, "flex items-center justify-center bg-muted text-muted-foreground", dim, className)}
      role="img" aria-label={alt || "Creator photo"}>
      {!loaded && <UserIcon aria-hidden className={size === "xs" ? "size-3" : "size-5"} />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src && <img
        key={src}
        ref={imageRef}
        src={src}
        alt=""
        aria-hidden
        referrerPolicy="no-referrer"
        className="absolute inset-0 size-full object-cover object-center"
        style={{ opacity: loaded ? 1 : 0 }}
        onLoad={() => setLoadedSrc(src)}
        onError={(event) => handleImageFailure(event.currentTarget)}
      />}
    </div>
  );
}

export function CreatorAvatarImage(props: ComponentProps<typeof CreatorAvatarImageInstance>) {
  // A changed photo starts a fresh recovery cycle; ordinary row renders do not.
  return <CreatorAvatarImageInstance key={JSON.stringify([props.avatarUrl ?? null, props.profileUrl ?? null])} {...props} />;
}
