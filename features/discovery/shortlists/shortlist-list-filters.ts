import type { ShortlistStatus, ShortlistVisibilityV2 } from "@/types/database";

import type { ShortlistListRow } from "./types";

export type ShortlistListFilterState = {
  search: string;
  status: ShortlistStatus | "all";
  visibility: ShortlistVisibilityV2 | "all";
  brandId: string | "all";
};

export const DEFAULT_SHORTLIST_LIST_FILTERS: ShortlistListFilterState = {
  search: "",
  status: "all",
  visibility: "all",
  brandId: "all",
};

export function hasActiveShortlistListFilters(
  filters: ShortlistListFilterState
): boolean {
  return (
    filters.search.trim().length > 0 ||
    filters.status !== "all" ||
    filters.visibility !== "all" ||
    filters.brandId !== "all"
  );
}

export function filterShortlistRows(
  rows: ShortlistListRow[],
  filters: ShortlistListFilterState
): ShortlistListRow[] {
  const query = filters.search.trim().toLowerCase();

  return rows.filter((row) => {
    if (filters.status !== "all" && row.status !== filters.status) return false;
    if (filters.visibility !== "all" && row.visibility !== filters.visibility) {
      return false;
    }
    if (filters.brandId !== "all" && row.brand_id !== filters.brandId) return false;

    if (!query) return true;

    const haystack = [
      row.name,
      row.serial_number ?? "",
      row.brand_name ?? "",
      row.client_name ?? "",
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });
}
