"use client";

import { useState } from "react";

import {
  countryFlag,
  countryFlagImageFallbackUrls,
  normalizeCountryCode,
} from "@/lib/creators/creator-display-utils";
import { cn } from "@/lib/utils";

const BADGE_SIZE_CLASS = {
  xs: "size-4",
  sm: "size-5",
  md: "size-5",
  lg: "size-6",
  inline: "size-3.5",
} as const;

const BADGE_DISPLAY_PX = {
  xs: 16,
  sm: 20,
  md: 20,
  lg: 24,
  inline: 14,
} as const;

export type CountryFlagBadgeSize = keyof typeof BADGE_SIZE_CLASS;

/** Avatar overlay and profile-link badge sizes — excludes compact inline-only size. */
export type CountryFlagBadgeOverlaySize = Exclude<CountryFlagBadgeSize, "inline">;

type CountryFlagBadgeProps = {
  countryCode: string | null | undefined;
  size?: CountryFlagBadgeSize;
  className?: string;
  /** Avatar overlay styling — white/card ring and subtle depth. */
  overlay?: boolean;
};

/** Renders a circular country flag image; returns null when code is missing or invalid. */
export function CountryFlagBadge({
  countryCode,
  size = "md",
  className,
  overlay = false,
}: CountryFlagBadgeProps) {
  const normalized = normalizeCountryCode(countryCode);
  const displayPx = BADGE_DISPLAY_PX[size];
  const fallbackUrls = countryFlagImageFallbackUrls(countryCode, displayPx);
  const [urlIndex, setUrlIndex] = useState(0);
  const emojiFallback = countryFlag(countryCode);
  const useEmojiFallback = urlIndex >= fallbackUrls.length;
  const src = fallbackUrls[urlIndex] ?? null;

  if (!normalized || fallbackUrls.length === 0) return null;

  const handleImageError = () => {
    setUrlIndex((current) => current + 1);
  };

  return (
    <span
      className={cn(
        "inline-flex shrink-0 overflow-hidden rounded-full",
        overlay
          ? "bg-card shadow-[0_1px_3px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.4)] ring-2 ring-card"
          : "border border-border/60 shadow-sm",
        BADGE_SIZE_CLASS[size],
        className
      )}
      aria-label={normalized}
    >
      {useEmojiFallback && emojiFallback ? (
        <span
          aria-hidden
          className="flex size-full items-center justify-center bg-muted text-[9px] leading-none"
        >
          {emojiFallback}
        </span>
      ) : src ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          key={src}
          src={src}
          alt=""
          aria-hidden
          loading="lazy"
          decoding="async"
          onError={handleImageError}
          className="size-full object-cover object-center"
        />
      ) : null}
    </span>
  );
}
