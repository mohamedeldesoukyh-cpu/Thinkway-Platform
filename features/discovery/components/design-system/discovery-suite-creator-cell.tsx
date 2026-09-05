"use client";

import type { ReactNode } from "react";

import { CreatorAvatarImage } from "@/components/creator/creator-avatar-image";
import { CountryFlagsStack } from "@/components/creator/country-flags-stack";
import { ini } from "@/lib/discovery/suite/helpers";
import { cn } from "@/lib/utils";

/** Design pack `avx`: tone cycle `(i % 3) + 1` → default / k2 / k3. */
export function discoverySuiteAvTone(index: number): "k2" | "k3" | undefined {
  const n = (Math.max(0, index) % 3) + 1;
  if (n === 2) return "k2";
  if (n === 3) return "k3";
  return undefined;
}

/** Normalize raw handle to `@handle` label; empty → null. */
export function discoverySuiteHandleLabel(
  handle: string | null | undefined
): string | null {
  const h = String(handle ?? "")
    .replace(/^@+/u, "")
    .trim();
  return h ? `@${h}` : null;
}

export type DiscoverySuiteCreatorCellProps = {
  name: string;
  /** Prefixed handle e.g. `@foo`. Omit to hide `.hd`. */
  handleLabel?: string | null;
  /** Row index for avatar tone cycle. */
  index?: number;
  avatarUrl?: string | null;
  profileUrl?: string | null;
  countryCodes?: string[] | null;
  /**
   * Location line (`.lo`). Quotation pack omits this; shortlist/search show it.
   * Pass null/"—" to hide.
   */
  locationLabel?: string | null;
  onOpen?: () => void;
  /** Extra content under name/handle/location. */
  children?: ReactNode;
  className?: string;
  /** When parent row handles click, stop name-button bubbling. */
  stopPropagation?: boolean;
};

/**
 * Shared Discovery suite creator identity cell — `.tw-cw2` + `.tw-avx` + name/handle.
 * Used by quotation lines, shortlist detail, and creator search so surfaces stay aligned.
 */
export function DiscoverySuiteCreatorCell({
  name,
  handleLabel,
  index = 0,
  avatarUrl,
  profileUrl,
  countryCodes,
  locationLabel,
  onOpen,
  children,
  className,
  stopPropagation = false,
}: DiscoverySuiteCreatorCellProps) {
  const flags = (countryCodes ?? []).map((c) => c.trim()).filter(Boolean);
  const showLocation =
    Boolean(locationLabel?.trim()) && locationLabel?.trim() !== "—";
  const tone = discoverySuiteAvTone(index);

  const open = (event?: { stopPropagation: () => void }) => {
    if (stopPropagation) event?.stopPropagation();
    onOpen?.();
  };

  return (
    <span className={cn("tw-cw2", className)}>
      <span
        className={cn("tw-avx relative", tone)}
        aria-hidden
      >
        {/* Clip photo/initials only — keep `.fl` flag outside overflow so pack overlay shows. */}
        <span className="absolute inset-0 overflow-hidden rounded-full">
          {avatarUrl ? (
            <CreatorAvatarImage
              avatarUrl={avatarUrl}
              profileUrl={profileUrl}
              alt={name}
              sizeClassName="size-full"
              className="border-0"
            />
          ) : (
            <span className="grid size-full place-items-center">
              {ini(name).slice(0, 2)}
            </span>
          )}
        </span>
        {flags.length > 0 ? (
          <span className="fl">
            <CountryFlagsStack
              countryCodes={flags}
              size="xs"
              overlay
              className="size-full"
            />
          </span>
        ) : null}
      </span>
      <span style={{ minWidth: 0 }}>
        {onOpen ? (
          <button
            type="button"
            className="nm max-w-full min-w-0 cursor-pointer truncate border-0 bg-transparent p-0 text-left font-[inherit]"
            title={name}
            onClick={(event) => open(event)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                open(event);
              }
            }}
          >
            {name}
          </button>
        ) : (
          <span className="nm">{name}</span>
        )}
        {handleLabel ? <span className="hd">{handleLabel}</span> : null}
        {showLocation ? <span className="lo">{locationLabel}</span> : null}
        {children}
      </span>
    </span>
  );
}
