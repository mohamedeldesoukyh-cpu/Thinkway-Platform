"use client";

import { UserIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

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

export function CreatorAvatarImage({
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

  const activeBase =
    useProfileFallback && profileOnlySrc && profileOnlySrc !== primarySrc
      ? profileOnlySrc
      : primarySrc;

  const recovery = useMediaProxyImageRecovery(activeBase);
  const notifiedFail = useRef(false);

  useEffect(() => {
    setUseProfileFallback(false);
    setUseRawCdnFallback(false);
    notifiedFail.current = false;
  }, [primarySrc, profileOnlySrc, rawCdnSrc]);

  useEffect(() => {
    if (!recovery.exhausted) return;
    if (rawCdnSrc && !useRawCdnFallback) return;
    if (notifiedFail.current) return;
    notifiedFail.current = true;
    onFailed?.();
  }, [recovery.exhausted, rawCdnSrc, useRawCdnFallback, onFailed]);

  if (recovery.exhausted && rawCdnSrc && !useRawCdnFallback) {
    return (
      <div className={cn(AVATAR_CONTAINER_CLASS, dim, className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={rawCdnSrc}
          alt={alt}
          referrerPolicy="no-referrer"
          className="size-full object-cover object-center"
          onError={() => setUseRawCdnFallback(true)}
        />
      </div>
    );
  }

  if (!activeBase || recovery.exhausted) {
    return (
      <div
        className={cn(
          AVATAR_CONTAINER_CLASS,
          "flex items-center justify-center bg-muted",
          dim,
          className
        )}
      >
        <UserIcon
          className={cn(size === "xs" ? "size-3" : "size-5", "text-muted-foreground")}
        />
      </div>
    );
  }

  return (
    <div className={cn(AVATAR_CONTAINER_CLASS, dim, className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={recovery.displaySrc ?? activeBase}
        src={recovery.displaySrc ?? activeBase}
        alt={alt}
        referrerPolicy="no-referrer"
        className="size-full object-cover object-center"
        onError={() => {
          if (
            !useProfileFallback &&
            profileOnlySrc &&
            profileOnlySrc !== primarySrc
          ) {
            setUseProfileFallback(true);
            return;
          }
          recovery.onError();
        }}
      />
    </div>
  );
}
