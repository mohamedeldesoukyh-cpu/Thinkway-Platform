import type { DecisionFocusQuery } from "@/features/campaigns/lifecycle/campaign-decision-center";
import { applyDecisionFocusToSearch } from "@/features/campaigns/lifecycle/campaign-decision-center";
import type { CampaignWorkspaceTabId } from "@/features/campaigns/constants/campaign-workspace-tab-order";

/**
 * Build a shareable workspace URL for a tab. Used with history.replaceState so tab
 * changes do not trigger a Next.js RSC refetch / loading remount (which raced the
 * entry-stage redirect and bounced users back to Needs Attention / Client IO).
 *
 * Optional focus query opens the exact business object (?io=, ?invoice=, …).
 */
export function buildCampaignWorkspaceTabUrl(
  pathname: string,
  currentSearch: string,
  tab: CampaignWorkspaceTabId,
  focus?: DecisionFocusQuery | null
): string {
  const focusedSearch = applyDecisionFocusToSearch(currentSearch, focus ?? null);
  const raw = focusedSearch.startsWith("?")
    ? focusedSearch.slice(1)
    : focusedSearch;
  const params = new URLSearchParams(raw);
  params.set("tab", tab);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
