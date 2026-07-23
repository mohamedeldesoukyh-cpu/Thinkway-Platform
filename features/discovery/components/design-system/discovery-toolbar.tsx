"use client";

import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/** Bold icon sizing for Discovery header/toolbar controls (Search golden reference). */
export const DISCOVERY_TOOLBAR_ICON_PROPS = {
  className: "size-4 shrink-0",
  strokeWidth: 2.5,
} as const;

export function discoveryToolbarBtnClass(active?: boolean) {
  return cn(
    "discovery-search-toolbar-btn relative shrink-0 border-0 bg-transparent shadow-none rounded-none hover:bg-transparent",
    active && "discovery-search-toolbar-btn--active"
  );
}

export function DiscoveryToolbarActiveBadge() {
  return <span className="discovery-search-toolbar-badge" aria-hidden />;
}

type DiscoveryToolbarIconProps = {
  icon: LucideIcon;
  className?: string;
};

export function DiscoveryToolbarIcon({ icon: Icon, className }: DiscoveryToolbarIconProps) {
  return (
    <Icon
      {...DISCOVERY_TOOLBAR_ICON_PROPS}
      className={cn(DISCOVERY_TOOLBAR_ICON_PROPS.className, className)}
    />
  );
}
