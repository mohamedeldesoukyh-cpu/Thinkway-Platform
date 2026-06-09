"use client";

import {
  CAMPAIGN_WORKSPACE_DEFAULT_TAB_ORDER,
  CAMPAIGN_WORKSPACE_TAB_ORDER_STORAGE_KEY,
  isCampaignWorkspaceTabId,
} from "@/features/campaigns/constants/campaign-workspace-tab-order";
import { useWorkspaceTabOrder } from "@/hooks/use-workspace-tab-order";

export function useCampaignWorkspaceTabOrder() {
  return useWorkspaceTabOrder({
    storageKey: CAMPAIGN_WORKSPACE_TAB_ORDER_STORAGE_KEY,
    defaultOrder: CAMPAIGN_WORKSPACE_DEFAULT_TAB_ORDER,
    isValidId: isCampaignWorkspaceTabId,
  });
}
