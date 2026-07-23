"use client";

import {
  buildDiscoveryCreatorViewModel,
  type DiscoveryCreatorViewModelOptions,
} from "@/features/discovery/view-models/discovery-creator-view-model";
import { useDiscoveryCreatorHoverDetails } from "@/features/discovery/hooks/use-discovery-creator-hover-details";
import type { UnifiedCreatorResult } from "@/lib/creators/types";

import { CreatorDetailsSummaryCard } from "./creator-details-summary-card";

type Props = {
  creator: UnifiedCreatorResult;
  profileUrl?: string | null;
  size?: "compact" | "sheet";
  className?: string;
  onClick?: () => void;
  viewModelOptions?: DiscoveryCreatorViewModelOptions;
};

/** VM-driven profile header — shared by hover card, detail sheet, and drawer chrome. */
export function DiscoveryCreatorProfileSummary({
  creator,
  profileUrl: profileUrlOverride,
  size = "compact",
  className,
  onClick,
  viewModelOptions,
}: Props) {
  const vm = buildDiscoveryCreatorViewModel(creator, viewModelOptions);
  const { secondaryLine, statusLabel } = useDiscoveryCreatorHoverDetails(creator);

  return (
    <CreatorDetailsSummaryCard
      size={size}
      displayName={vm.displayName}
      avatarUrl={vm.avatarUrl}
      profileUrl={profileUrlOverride ?? vm.profileUrl}
      thinkwayStarLabel={vm.thinkwayStarLabel}
      secondaryLine={secondaryLine}
      countryCodes={vm.countryFlagCodes}
      countryLabel={vm.countryLabel !== "—" ? vm.countryLabel : null}
      statusLabel={statusLabel}
      className={className}
      onClick={onClick}
    />
  );
}
