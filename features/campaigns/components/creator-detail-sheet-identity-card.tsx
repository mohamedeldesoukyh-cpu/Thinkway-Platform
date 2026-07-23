"use client";

import { DiscoveryCreatorProfileSummary } from "@/features/discovery/components/discovery-creator-profile-summary";
import type { UnifiedCreatorResult } from "@/lib/creators/types";

type Props = {
  creator: UnifiedCreatorResult;
  profileUrl: string | null;
};

export function CreatorDetailSheetIdentityCard({ creator, profileUrl }: Props) {
  return (
    <DiscoveryCreatorProfileSummary
      creator={creator}
      profileUrl={profileUrl}
      size="sheet"
      className="creator-detail-sheet-identity-card"
    />
  );
}
