import type { CampaignWorkspaceTabId } from "@/features/campaigns/constants/campaign-workspace-tab-order";

/**
 * Bare /campaigns/[id] (no ?tab=) deep-links into the recommended business stage.
 * Any explicit ?tab= (overview, lines, client-io, …) must stay — never bounce away.
 */
export function resolveBareCampaignEntryRedirect(
  tabParam: string | undefined,
  entryStageId: CampaignWorkspaceTabId
): CampaignWorkspaceTabId | null {
  if (tabParam?.trim()) return null;
  if (entryStageId === "overview") return null;
  return entryStageId;
}

/**
 * Build a shareable workspace URL for a tab. Used with history.replaceState so tab
 * changes do not trigger a Next.js RSC refetch / loading remount (which raced the
 * entry-stage redirect and bounced users back to Needs Attention / Client IO).
 */
export function buildCampaignWorkspaceTabUrl(
  pathname: string,
  currentSearch: string,
  tab: CampaignWorkspaceTabId
): string {
  const raw = currentSearch.startsWith("?") ? currentSearch.slice(1) : currentSearch;
  const params = new URLSearchParams(raw);
  params.set("tab", tab);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
