import type { PostgrestError } from "@supabase/supabase-js";

/** Detect PostgREST / Postgres errors when campaign_lines.sort_order is missing. */
export function isCampaignLineSortOrderMissing(error: PostgrestError | null): boolean {
  if (!error?.message) return false;
  return /sort_order|column.*does not exist/i.test(error.message);
}

export type CampaignLineOrderColumn = "sort_order" | "created_at" | "document_number";

/**
 * Runs a campaign_lines query with sort_order, falling back to created_at when the
 * column is unavailable (older databases / stale PostgREST schema cache).
 */
export async function queryCampaignLinesWithDisplayOrder<T>(
  run: (orderColumn: CampaignLineOrderColumn, includeSortOrderColumn: boolean) => Promise<{
    data: T[] | null;
    error: PostgrestError | null;
  }>
): Promise<{ data: T[]; orderColumn: CampaignLineOrderColumn; error?: string }> {
  const primary = await run("sort_order", true);
  if (!primary.error) {
    return {
      data: primary.data ?? [],
      orderColumn: "sort_order",
    };
  }

  if (isCampaignLineSortOrderMissing(primary.error)) {
    const fallback = await run("created_at", false);
    if (fallback.error) {
      return { data: [], orderColumn: "created_at", error: fallback.error.message };
    }
    return {
      data: fallback.data ?? [],
      orderColumn: "created_at",
    };
  }

  return {
    data: [],
    orderColumn: "sort_order",
    error: primary.error.message,
  };
}
