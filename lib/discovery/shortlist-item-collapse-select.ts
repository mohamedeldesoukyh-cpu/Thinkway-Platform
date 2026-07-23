/** Shortlist item selects — collapse columns require migration 20260719120000. */

export const SHORTLIST_ITEM_DETAIL_SELECT_BASE =
  "id, profile_id, influencer_id, unified_id, notes, match_score, sort_order, item_status, platform_account_ids";

export const SHORTLIST_ITEM_DETAIL_SELECT_WITH_COLLAPSE = `${SHORTLIST_ITEM_DETAIL_SELECT_BASE}, collapse_group_id, collapse_label`;

export const SHORTLIST_ITEM_SEED_SELECT_BASE =
  "id, influencer_id, profile_id, unified_id, commercial_input_mode, cost, cost_currency, gp_pct, revenue, gp_value, deliverables, sort_order";

export const SHORTLIST_ITEM_SEED_SELECT_WITH_COLLAPSE = `${SHORTLIST_ITEM_SEED_SELECT_BASE}, collapse_group_id, collapse_label`;

export function isMissingCollapseColumnsError(message: string): boolean {
  return /collapse_group_id|collapse_label/.test(message);
}

export const COLLAPSE_MIGRATION_HINT =
  "Apply supabase/migrations/20260719120000_shortlist_collapse_content.sql in the Supabase SQL editor (or run: npx supabase db push --include-all).";

type SelectResult<T> = { data: T | null; error: { message: string } | null };

/** Prefer collapse columns; fall back when migration is not applied yet. */
export async function queryShortlistItemsWithCollapseFallback<T>(
  run: (select: string) => PromiseLike<SelectResult<T>>
): Promise<SelectResult<T> & { collapseColumnsAvailable: boolean }> {
  const withCollapse = await run(SHORTLIST_ITEM_DETAIL_SELECT_WITH_COLLAPSE);
  if (!withCollapse.error) {
    return { ...withCollapse, collapseColumnsAvailable: true };
  }
  if (!isMissingCollapseColumnsError(withCollapse.error.message)) {
    return { ...withCollapse, collapseColumnsAvailable: false };
  }

  const base = await run(SHORTLIST_ITEM_DETAIL_SELECT_BASE);
  return { ...base, collapseColumnsAvailable: false };
}

export async function queryShortlistSeedItemsWithCollapseFallback<T>(
  run: (select: string) => PromiseLike<SelectResult<T>>
): Promise<SelectResult<T> & { collapseColumnsAvailable: boolean }> {
  const withCollapse = await run(SHORTLIST_ITEM_SEED_SELECT_WITH_COLLAPSE);
  if (!withCollapse.error) {
    return { ...withCollapse, collapseColumnsAvailable: true };
  }
  if (!isMissingCollapseColumnsError(withCollapse.error.message)) {
    return { ...withCollapse, collapseColumnsAvailable: false };
  }

  const base = await run(SHORTLIST_ITEM_SEED_SELECT_BASE);
  return { ...base, collapseColumnsAvailable: false };
}

export function collapseFieldsFromRow(row: Record<string, unknown>): {
  collapse_group_id: string | null;
  collapse_label: string | null;
} {
  return {
    collapse_group_id: (row.collapse_group_id as string | null) ?? null,
    collapse_label: (row.collapse_label as string | null) ?? null,
  };
}
