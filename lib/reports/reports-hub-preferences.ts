import {
  isReportHubLinkId,
  type ReportHubLinkId,
} from "@/lib/reports/report-hub-links";
import {
  normalizeWorkspaceTabOrder,
  reorderWorkspaceTabs,
} from "@/lib/workspace/workspace-tab-order";

export const REPORTS_HUB_PREFERENCES_STORAGE_KEY = "thinkway:reports-preferences";

export type ReportsHubViewMode = "all" | "favorites";

export type ReportsHubPreferences = {
  favorites: ReportHubLinkId[];
  order: ReportHubLinkId[];
  viewMode: ReportsHubViewMode;
};

export function normalizeReportsHubViewMode(saved: unknown): ReportsHubViewMode {
  return saved === "favorites" ? "favorites" : "all";
}

export function normalizeReportsHubOrder(
  saved: unknown,
  defaultOrder: readonly ReportHubLinkId[]
): ReportHubLinkId[] {
  return normalizeWorkspaceTabOrder(saved, defaultOrder, isReportHubLinkId);
}

export function normalizeReportsHubFavorites(
  saved: unknown,
  order: readonly ReportHubLinkId[]
): ReportHubLinkId[] {
  const orderSet = new Set(order);
  const parsed = Array.isArray(saved)
    ? saved.filter(
        (id): id is ReportHubLinkId =>
          typeof id === "string" && isReportHubLinkId(id) && orderSet.has(id)
      )
    : [];

  const seen = new Set<ReportHubLinkId>();
  return parsed.filter((id) => {
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export function reorderReportsHubLinks(
  order: readonly ReportHubLinkId[],
  fromIndex: number,
  toIndex: number
): ReportHubLinkId[] {
  return reorderWorkspaceTabs(order, fromIndex, toIndex);
}

/** Favorites first, preserving relative order within each group. */
export function getReportsHubDisplayOrder(
  order: readonly ReportHubLinkId[],
  favorites: ReadonlySet<ReportHubLinkId>
): ReportHubLinkId[] {
  const favoriteIds = order.filter((id) => favorites.has(id));
  const otherIds = order.filter((id) => !favorites.has(id));
  return [...favoriteIds, ...otherIds];
}

export function toggleReportsHubFavorite(
  favorites: readonly ReportHubLinkId[],
  id: ReportHubLinkId
): ReportHubLinkId[] {
  const set = new Set(favorites);
  if (set.has(id)) {
    set.delete(id);
  } else {
    set.add(id);
  }
  return [...set];
}
