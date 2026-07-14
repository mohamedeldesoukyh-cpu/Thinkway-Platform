export type QuotationCommercialSummarySortField =
  | "influencer"
  | "revenue"
  | "cost"
  | "gp"
  | "gpPct";

export type QuotationCommercialSummarySortDirection = "asc" | "desc";

export type QuotationCommercialSummarySortState = {
  field: QuotationCommercialSummarySortField;
  direction: QuotationCommercialSummarySortDirection;
};

export type QuotationCommercialSummarySortRow = {
  itemId: string;
  influencerName: string;
  optionLabel: string | null;
  revenueEgp: number;
  costEgp: number;
  gpValueEgp: number;
  gpPct: number;
};

const DEFAULT_DIRECTION: Record<
  QuotationCommercialSummarySortField,
  QuotationCommercialSummarySortDirection
> = {
  influencer: "asc",
  revenue: "desc",
  cost: "desc",
  gp: "desc",
  gpPct: "desc",
};

function compareNumbers(
  left: number,
  right: number,
  direction: QuotationCommercialSummarySortDirection
): number {
  const delta = left - right;
  return direction === "asc" ? delta : -delta;
}

function compareStrings(
  left: string,
  right: string,
  direction: QuotationCommercialSummarySortDirection
): number {
  const cmp = left.localeCompare(right, undefined, { sensitivity: "base", numeric: true });
  return direction === "asc" ? cmp : -cmp;
}

function effectiveGpPct(row: QuotationCommercialSummarySortRow): number {
  if (!Number.isFinite(row.revenueEgp) || row.revenueEgp <= 0) return 0;
  return (row.gpValueEgp / row.revenueEgp) * 100;
}

function compareRows(
  a: QuotationCommercialSummarySortRow,
  b: QuotationCommercialSummarySortRow,
  sort: QuotationCommercialSummarySortState
): number {
  const { field, direction } = sort;
  let cmp = 0;

  switch (field) {
    case "influencer": {
      cmp = compareStrings(a.influencerName, b.influencerName, direction);
      if (cmp === 0) {
        cmp = compareStrings(a.optionLabel ?? "", b.optionLabel ?? "", direction);
      }
      break;
    }
    case "revenue":
      cmp = compareNumbers(a.revenueEgp, b.revenueEgp, direction);
      break;
    case "cost":
      cmp = compareNumbers(a.costEgp, b.costEgp, direction);
      break;
    case "gp":
      cmp = compareNumbers(a.gpValueEgp, b.gpValueEgp, direction);
      break;
    case "gpPct":
      cmp = compareNumbers(effectiveGpPct(a), effectiveGpPct(b), direction);
      break;
    default:
      cmp = 0;
  }

  if (cmp !== 0) return cmp;
  return compareStrings(a.itemId, b.itemId, "asc");
}

export function applyQuotationCommercialSummaryHeaderSort(
  current: QuotationCommercialSummarySortState | null,
  field: QuotationCommercialSummarySortField
): QuotationCommercialSummarySortState {
  if (current?.field === field) {
    return {
      field,
      direction: current.direction === "asc" ? "desc" : "asc",
    };
  }
  return { field, direction: DEFAULT_DIRECTION[field] };
}

/** Sort commercial summary rows; stable tie-break on itemId. */
export function sortQuotationCommercialSummaryRows<
  T extends QuotationCommercialSummarySortRow,
>(rows: T[], sort: QuotationCommercialSummarySortState | null): T[] {
  if (!sort) return [...rows];
  return [...rows].sort((a, b) => compareRows(a, b, sort));
}
