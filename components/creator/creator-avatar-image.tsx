"use client";

import { UserIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { creatorAvatarDisplayUrls } from "@/lib/performance/creator-avatar";
import { cn } from "@/lib/utils";

const AVATAR_SIZE_CLASS = {
  xs: "size-6",
  sm: "size-8",
  md: "size-10",
  lg: "size-12",
} as const;

export type CreatorAvatarImageSize = keyof typeof AVATAR_SIZE_CLASS;

export function CreatorAvatarImage({
  avatarUrl,
  platform,
  size = "md",
  sizeClassName,
  className,
  fallbackUrl,
  onFailed,
}: {
  avatarUrl: string | null | undefined;
  platform?: string | null;
  size?: CreatorAvatarImageSize;
  sizeClassName?: string;
  className?: string;
  /** Optional signed/original URL when avatarUrl is already normalized for display. */
  fallbackUrl?: string | null;
  onFailed?: () => void;
}) {
  const dim = sizeClassName ?? AVATAR_SIZE_CLASS[size];
  const sources = useMemo(() => {
    const fromRaw = creatorAvatarDisplayUrls(platform, avatarUrl);
    if (!fromRaw) return null;
    const chain = [fromRaw.primary];
    const secondary = fallbackUrl?.trim() || fromRaw.fallback;
    if (secondary && secondary !== fromRaw.primary) {
      chain.push(secondary);
    }
    return chain;
  }, [avatarUrl, fallbackUrl, platform]);

  const [sourceIndex, setSourceIndex] = useState(0);
  const src = sources?.[sourceIndex];

  if (!src) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-full border border-border bg-muted",
          dim,
          className
        )}
      >
        <UserIcon className={cn(size === "xs" ? "size-3" : "size-5", "text-muted-foreground")} />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      referrerPolicy="no-referrer"
      className={cn("rounded-full border border-border object-cover", dim, className)}
      onError={(event) => {
        event.currentTarget.onerror = null;
        if (sources && sourceIndex + 1 < sources.length) {
          setSourceIndex(sourceIndex + 1);
          return;
        }
        onFailed?.();
      }}
    />
  );
}
