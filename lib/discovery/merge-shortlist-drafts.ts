/** Only empty draft shortlist memberships may be consolidated automatically. */
export function isEmptyMergeDraft(row: Record<string, unknown>): boolean {
  return row.item_status === "draft" && row.profile_id == null &&
    ["cost","revenue","gp_pct","gp_value","cost_egp","revenue_egp","gp_value_egp","cost_currency","revenue_currency","fx_rate_to_egp","commercial_updated_at","notes","service_description","match_score"].every(key => row[key] == null) &&
    Array.isArray(row.deliverables) && row.deliverables.length === 0;
}
