"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import {
  DISCOVERY_FILTER_BAR_CLASS,
  DISCOVERY_FILTER_BAR_STANDALONE_CLASS,
} from "./discovery-design-tokens";

type DiscoveryFilterBarProps = {
  children: ReactNode;
  /** Result count label shown at the end (e.g. "12 of 48 shortlists"). */
  countLabel?: string;
  /** Inside a DiscoveryListCard — uses bordered bottom strip. */
  embedded?: boolean;
  className?: string;
};

/** Shared filter/search bar chrome for Discovery list pages. */
export function DiscoveryFilterBar({
  children,
  countLabel,
  embedded = true,
  className,
}: DiscoveryFilterBarProps) {
  return (
    <div
      className={cn(
        embedded ? DISCOVERY_FILTER_BAR_CLASS : DISCOVERY_FILTER_BAR_STANDALONE_CLASS,
        className
      )}
    >
      {children}
      {countLabel ? (
        <span className="ml-auto shrink-0 text-[11px] font-medium text-[var(--text-3)]">
          {countLabel}
        </span>
      ) : null}
    </div>
  );
}
