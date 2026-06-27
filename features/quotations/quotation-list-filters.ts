import type { QuotationStatus } from "@/types/database";

import type { QuotationListRow } from "./types";

export type QuotationListFilterState = {
  search: string;
  status: QuotationStatus | "all";
  brandId: string | "all";
};

export const DEFAULT_QUOTATION_LIST_FILTERS: QuotationListFilterState = {
  search: "",
  status: "all",
  brandId: "all",
};

export function hasActiveQuotationListFilters(
  filters: QuotationListFilterState
): boolean {
  return (
    filters.search.trim().length > 0 ||
    filters.status !== "all" ||
    filters.brandId !== "all"
  );
}

export function filterQuotationRows(
  rows: QuotationListRow[],
  filters: QuotationListFilterState
): QuotationListRow[] {
  const query = filters.search.trim().toLowerCase();

  return rows.filter((row) => {
    if (filters.status !== "all" && row.status !== filters.status) return false;
    if (filters.brandId !== "all" && row.brand_id !== filters.brandId) return false;

    if (!query) return true;

    const haystack = [
      row.name,
      row.serial_number ?? "",
      row.brand_name ?? "",
      row.client_name ?? "",
      row.campaign_name ?? "",
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });
}
