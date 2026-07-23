import { isCommercialCurrency, REPORTING_CURRENCY } from "@/lib/commercial/fx-aggregation";

/**
 * Shortlist display currency is stored in `metadata.currency` so the feature
 * works before/without the `discovery_shortlists.currency` column migration.
 * When the column exists, prefer it.
 */
export function readShortlistDisplayCurrency(row: {
  currency?: string | null;
  metadata?: unknown;
}): string {
  const fromColumn = typeof row.currency === "string" ? row.currency.trim().toUpperCase() : "";
  if (fromColumn && isCommercialCurrency(fromColumn)) return fromColumn;

  const metadata =
    row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : null;
  const fromMeta =
    typeof metadata?.currency === "string" ? metadata.currency.trim().toUpperCase() : "";
  if (fromMeta && isCommercialCurrency(fromMeta)) return fromMeta;

  return REPORTING_CURRENCY;
}

export function shortlistMetadataWithCurrency(
  metadata: unknown,
  currency: string
): Record<string, unknown> {
  const base =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? { ...(metadata as Record<string, unknown>) }
      : {};
  const code = currency.trim().toUpperCase();
  base.currency = isCommercialCurrency(code) ? code : REPORTING_CURRENCY;
  return base;
}
