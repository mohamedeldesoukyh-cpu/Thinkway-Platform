"use client";

import dynamic from "next/dynamic";

/**
 * Heavy Discovery workspace panels — loaded only when the parent mounts them
 * (typically when a sheet/dialog opens or AI mode activates).
 */

export const CampaignBriefSidebar = dynamic(
  () =>
    import("@/features/campaign-intelligence-profile/components/campaign-brief-sidebar").then(
      (m) => m.CampaignBriefSidebar
    ),
  { ssr: false }
);

export const AiSearchStrategySheet = dynamic(
  () =>
    import("@/features/campaign-intelligence-profile/components/ai-search-strategy-sheet").then(
      (m) => m.AiSearchStrategySheet
    ),
  { ssr: false }
);

export const CreatorSearchCampaignRequirementsPanel = dynamic(
  () =>
    import("./creator-search-campaign-requirements-panel").then(
      (m) => m.CreatorSearchCampaignRequirementsPanel
    ),
  { ssr: false }
);

export const CreateListDialog = dynamic(
  () => import("./create-list-dialog").then((m) => m.CreateListDialog),
  { ssr: false }
);

export const AddToShortlistDialog = dynamic(
  () =>
    import("@/features/discovery/shortlists/components/add-to-shortlist-dialog").then(
      (m) => m.AddToShortlistDialog
    ),
  { ssr: false }
);

export const SelectPlatformAccountsDialog = dynamic(
  () =>
    import("@/features/discovery/shortlists/components/select-platform-accounts-dialog").then(
      (m) => m.SelectPlatformAccountsDialog
    ),
  { ssr: false }
);

export const ManualRefreshConfirmDialog = dynamic(
  () =>
    import("@/features/discovery/enrichment/components/manual-refresh-confirm-dialog").then(
      (m) => m.ManualRefreshConfirmDialog
    ),
  { ssr: false }
);

export const DeleteDiscoveryCreatorDialog = dynamic(
  () =>
    import("@/features/discovery/delete-creator/delete-discovery-creator-dialog").then(
      (m) => m.DeleteDiscoveryCreatorDialog
    ),
  { ssr: false }
);
