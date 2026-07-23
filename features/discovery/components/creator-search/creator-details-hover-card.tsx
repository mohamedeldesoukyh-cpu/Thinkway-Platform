"use client";

import type { UnifiedCreatorResult } from "@/lib/creators/types";

import { DiscoveryCreatorProfileSummary } from "../discovery-creator-profile-summary";

type CreatorDetailsHoverCardProps = {
  creator: UnifiedCreatorResult;
  displayName: string;
  avatarUrl: string | null;
  profileUrl: string | null;
  thinkwayStarLabel: string;
  fallbackStatusLabel: string | null;
  className?: string;
  onClick?: () => void;
};

/** Hover preview card — uses shared VM + hover details hook. */
export function CreatorDetailsHoverCard({
  creator,
  className,
  onClick,
}: CreatorDetailsHoverCardProps) {
  return (
    <DiscoveryCreatorProfileSummary
      creator={creator}
      size="compact"
      className={className}
      onClick={onClick}
    />
  );
}
