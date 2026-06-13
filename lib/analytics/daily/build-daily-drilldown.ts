import { roundMoney } from "@/lib/analytics/aggregations/round";
import { computeMarginPercent } from "@/lib/analytics/metrics/financial";
import { formatDailyMonthTitle } from "@/lib/analytics/daily/daily-report-periods";
import type {
  DailyDrilldownClientRow,
  DailyDrilldownData,
  DailyDrilldownMetric,
  DailyDrilldownQuery,
  DailyDrilldownRowType,
  DailyLineFact,
} from "@/lib/analytics/daily/daily-report-types";

const METRIC_LABELS: Record<DailyDrilldownMetric, string> = {
  revenue: "Revenue",
  gp: "GP",
  gp_percent: "GP %",
};

const ROW_TYPE_LABELS: Record<Exclude<DailyDrilldownRowType, "day">, string> = {
  subtotal: "Sub-Total",
  run_rate: "Run Rate",
  vr: "VR",
  total_after_vr: "Total after VR",
};

function billableRevenue(fact: DailyLineFact): number {
  return roundMoney(fact.revenue + fact.ur_rev + fact.agency_fees);
}

function formatDayLabel(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  return parsed.toLocaleDateString("en-GB", { month: "short", day: "numeric" });
}

function filterFacts(
  facts: DailyLineFact[],
  monthKey: string,
  rowType: DailyDrilldownRowType,
  date?: string
): DailyLineFact[] {
  switch (rowType) {
    case "day":
      return facts.filter((fact) => fact.period_date === date);
    case "subtotal":
    case "run_rate":
    case "vr":
    case "total_after_vr":
      return facts.filter((fact) => fact.period_date.startsWith(monthKey));
    default:
      return [];
  }
}

function resolveGp(fact: DailyLineFact, rowType: DailyDrilldownRowType): number {
  if (rowType === "vr") return fact.vr_refund;
  if (rowType === "total_after_vr") return fact.gp_after_vr;
  return fact.gp;
}

function buildLabel(input: {
  rowType: DailyDrilldownRowType;
  metric: DailyDrilldownMetric;
  monthKey: string;
  date?: string;
}): string {
  const metricLabel = METRIC_LABELS[input.metric];
  if (input.rowType === "day" && input.date) {
    return `${formatDayLabel(input.date)} — ${metricLabel} by client`;
  }
  const monthLabel = formatDailyMonthTitle(input.monthKey);
  const rowLabel = ROW_TYPE_LABELS[input.rowType as Exclude<DailyDrilldownRowType, "day">];
  return `${monthLabel} — ${rowLabel} — ${metricLabel} by client`;
}

export function buildDailyDrilldown(
  facts: DailyLineFact[],
  query: DailyDrilldownQuery
): DailyDrilldownData {
  const filtered = filterFacts(facts, query.monthKey, query.rowType, query.date);

  const byClient = new Map<
    string,
    {
      client_name: string;
      revenue: number;
      gp: number;
      line_count: number;
    }
  >();

  for (const fact of filtered) {
    const bucket =
      byClient.get(fact.client_id) ??
      {
        client_name: fact.client_name,
        revenue: 0,
        gp: 0,
        line_count: 0,
      };
    bucket.revenue = roundMoney(bucket.revenue + billableRevenue(fact));
    bucket.gp = roundMoney(bucket.gp + resolveGp(fact, query.rowType));
    bucket.line_count += 1;
    byClient.set(fact.client_id, bucket);
  }

  const clients: DailyDrilldownClientRow[] = [...byClient.entries()].map(
    ([client_id, row]) => ({
      client_id,
      client_name: row.client_name,
      revenue: row.revenue,
      gp: row.gp,
      margin_percent: computeMarginPercent(row.revenue, row.gp),
      line_count: row.line_count,
    })
  );

  const sortKey = query.metric === "gp" ? "gp" : "revenue";
  clients.sort((left, right) => right[sortKey] - left[sortKey]);

  return {
    date: query.rowType === "day" ? (query.date ?? null) : null,
    label: buildLabel(query),
    metric: query.metric,
    clients,
  };
}

export function parseDailyDrilldownRowType(
  value: string | undefined
): DailyDrilldownRowType | null {
  if (
    value === "day" ||
    value === "subtotal" ||
    value === "run_rate" ||
    value === "vr" ||
    value === "total_after_vr"
  ) {
    return value;
  }
  return null;
}

export function parseDailyDrilldownMetric(
  value: string | undefined
): DailyDrilldownMetric | null {
  if (value === "revenue" || value === "gp" || value === "gp_percent") {
    return value;
  }
  return null;
}
