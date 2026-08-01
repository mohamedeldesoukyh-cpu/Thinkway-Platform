/** Default campaign workspace tab order — shared for all users until customized. */
import {
  normalizeWorkspaceTabOrder,
  reorderWorkspaceTabs,
} from "@/lib/workspace/workspace-tab-order";

/**
 * R2.3 Aurora default order — operational flow:
 * setup → execution → approvals → finance → history.
 * Workflow retained (no feature loss); Billing labeled Finance in the UI.
 */
export const CAMPAIGN_WORKSPACE_DEFAULT_TAB_ORDER = [
  "overview",
  "lines",
  "client-io",
  "vendor-io",
  "deliverables",
  "publications",
  "workflow",
  "billing",
  "timeline",
] as const;

export type CampaignWorkspaceTabId = (typeof CAMPAIGN_WORKSPACE_DEFAULT_TAB_ORDER)[number];

export const CAMPAIGN_WORKSPACE_TAB_ORDER_STORAGE_KEY =
  "thinkway:campaign-workspace-tab-order:v2";

const ALLOWED_TAB_IDS = new Set<string>(CAMPAIGN_WORKSPACE_DEFAULT_TAB_ORDER);

export function isCampaignWorkspaceTabId(value: string): value is CampaignWorkspaceTabId {
  return ALLOWED_TAB_IDS.has(value);
}

export function resolveCampaignWorkspaceTab(
  tabParam: string | undefined
): CampaignWorkspaceTabId {
  if (tabParam && isCampaignWorkspaceTabId(tabParam)) {
    return tabParam;
  }
  return "overview";
}

/** Merge saved order with default — drops unknown ids and appends any new tabs. */
export function normalizeCampaignWorkspaceTabOrder(saved: unknown): CampaignWorkspaceTabId[] {
  return normalizeWorkspaceTabOrder(
    saved,
    CAMPAIGN_WORKSPACE_DEFAULT_TAB_ORDER,
    isCampaignWorkspaceTabId
  );
}

export function reorderCampaignWorkspaceTabs(
  order: readonly CampaignWorkspaceTabId[],
  fromIndex: number,
  toIndex: number
): CampaignWorkspaceTabId[] {
  return reorderWorkspaceTabs(order, fromIndex, toIndex);
}
