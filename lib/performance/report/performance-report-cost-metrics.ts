/** Whether a cost efficiency metric (CPM, CPV, CPE) should appear in report output. */
export function isDisplayableCostMetric(value: number | null | undefined): boolean {
  return value != null && value !== 0;
}

export type CostMetricColumnKey = "cpm" | "cpv" | "cpe";

const COST_METRIC_COLUMN_KEYS: CostMetricColumnKey[] = ["cpv", "cpe", "cpm"];

export function publicationHasDisplayableCostMetric(
  publication: Record<CostMetricColumnKey, number | null | undefined>,
  key: CostMetricColumnKey
): boolean {
  return isDisplayableCostMetric(publication[key]);
}

/** Publication table columns to include — only cost metrics with at least one non-empty value. */
export function resolveDisplayableCostMetricColumns<
  T extends Record<CostMetricColumnKey, number | null | undefined>,
>(publications: T[]): CostMetricColumnKey[] {
  return COST_METRIC_COLUMN_KEYS.filter((key) =>
    publications.some((pub) => publicationHasDisplayableCostMetric(pub, key))
  );
}

export function buildOptionalCostMetricKpiRows(
  metrics: Array<{ label: string; value: number | null | undefined; formatted: string }>
): Array<[string, string]> {
  return metrics
    .filter((m) => isDisplayableCostMetric(m.value))
    .map((m) => [m.label, m.formatted] as [string, string]);
}
