import type { CampaignDeferredBundle } from "@/features/campaigns/actions/load-campaign-tab-data";
import type { CampaignWorkspaceTabId } from "@/features/campaigns/constants/campaign-workspace-tab-order";

/**
 * Bundles that block the whole tab with a skeleton until loaded.
 *
 * Timeline must stay empty: Enterprise Timeline renders from SSR
 * `workspace.activity` (audit_logs). Finance audit is a separate deferred
 * panel and must never gate Media Plan / enterprise timeline visibility.
 */
export const TAB_BLOCKING_BUNDLES: Record<
  CampaignWorkspaceTabId,
  CampaignDeferredBundle[]
> = {
  overview: [],
  "client-io": [],
  lines: [],
  "vendor-io": [],
  deliverables: ["publications"],
  publications: ["publications"],
  workflow: [],
  billing: ["billing"],
  timeline: [],
};

/**
 * Bundles whose hard errors replace the whole tab.
 * Timeline stays empty so a finance-audit failure cannot hide Enterprise Timeline.
 */
export const TAB_ERROR_BUNDLES: Record<
  CampaignWorkspaceTabId,
  CampaignDeferredBundle[]
> = {
  overview: ["formOptions"],
  "client-io": [],
  lines: ["formOptions", "assignmentsBilling"],
  "vendor-io": [],
  deliverables: ["publications"],
  publications: ["publications"],
  workflow: [],
  billing: ["billing"],
  timeline: [],
};
