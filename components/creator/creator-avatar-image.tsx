"use client";

import { UserIcon } from "lucide-react";
import { useEffect, useState } from "react";

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
  const [useProfileFallback, setUseProfileFallback] = useState(false);
  const [failed, setFailed] = useState(false);

  const src =
    useProfileFallback && profileOnlySrc && profileOnlySrc !== primarySrc
      ? profileOnlySrc
      : primarySrc;

  useEffect(() => {
    setUseProfileFallback(false);
    setFailed(false);
  }, [primarySrc, profileOnlySrc]);

  if (!src || failed) {
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
        key={src}
        src={src}
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
          setFailed(true);
          onFailed?.();
        }}
      />
    </div>
  );
}
