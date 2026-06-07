import {
  getDeliverableTypeCodesForPlatform,
} from "@/lib/campaigns/deliverable-taxonomy";

export type AssignmentPricingMode = "package" | "per_deliverable";

export type PostScheduleEntry = {
  sequence: number;
  live_date: string | null;
  notes?: string | null;
  status?: string;
  platform?: string;
  deliverable_type?: string;
  revenue_per_post?: number;
  cost_per_post?: number;
  revenue_vat_percent?: number;
};

export type CommercialDeliverableRow = {
  /** Client-side stable id for React keys */
  id: string;
  platform: string;
  deliverable_type: string;
  quantity: number;
  unit_cost: number;
  revenue_before_vat: number;
  live_date: string | null;
  notes: string | null;
  schedule_mode: "single" | "expanded";
  post_schedules: PostScheduleEntry[];
};

export type CommercialSummary = {
  total_cost_before_vat: number;
  total_revenue_before_vat: number;
  gp: number;
  margin_percent: number;
  deliverable_units: number;
};

export function rowTotalCost(row: Pick<CommercialDeliverableRow, "quantity" | "unit_cost">): number {
  return Math.round(row.quantity * row.unit_cost * 100) / 100;
}

export function rowTotalRevenue(
  row: Pick<CommercialDeliverableRow, "quantity" | "revenue_before_vat">
): number {
  return Math.round(row.quantity * row.revenue_before_vat * 100) / 100;
}

/** Keeps per-deliverable rows aligned when assignment-level revenue/cost fields change. */
export function applyAssignmentTotalsToCommercialRows(
  rows: CommercialDeliverableRow[],
  targetRevenue: number,
  targetCost: number
): CommercialDeliverableRow[] {
  if (rows.length === 0) return rows;

  const summary = summarizeCommercialRows(rows);
  if (
    Math.abs(targetRevenue - summary.total_revenue_before_vat) < 0.01 &&
    Math.abs(targetCost - summary.total_cost_before_vat) < 0.01
  ) {
    return rows;
  }

  if (rows.length === 1) {
    const row = rows[0]!;
    const quantity = Math.max(1, row.quantity);
    return [
      {
        ...row,
        revenue_before_vat: Math.round((targetRevenue / quantity) * 100) / 100,
        unit_cost: Math.round((targetCost / quantity) * 100) / 100,
      },
    ];
  }

  const revenueScale =
    summary.total_revenue_before_vat > 0
      ? targetRevenue / summary.total_revenue_before_vat
      : 0;
  const costScale =
    summary.total_cost_before_vat > 0 ? targetCost / summary.total_cost_before_vat : 0;

  return rows.map((row) => {
    const quantity = Math.max(1, row.quantity);
    const scaledRevenue = rowTotalRevenue(row) * revenueScale;
    const scaledCost = rowTotalCost(row) * costScale;
    return {
      ...row,
      revenue_before_vat: Math.round((scaledRevenue / quantity) * 100) / 100,
      unit_cost: Math.round((scaledCost / quantity) * 100) / 100,
    };
  });
}

export function summarizeCommercialRows(rows: CommercialDeliverableRow[]): CommercialSummary {
  const total_cost_before_vat = rows.reduce((s, r) => s + rowTotalCost(r), 0);
  const total_revenue_before_vat = rows.reduce((s, r) => s + rowTotalRevenue(r), 0);
  const gp = total_revenue_before_vat - total_cost_before_vat;
  const margin_percent =
    total_revenue_before_vat > 0
      ? Math.round((gp / total_revenue_before_vat) * 10000) / 100
      : 0;
  const deliverable_units = rows.reduce((s, r) => s + r.quantity, 0);

  return {
    total_cost_before_vat,
    total_revenue_before_vat,
    gp,
    margin_percent,
    deliverable_units,
  };
}

export function createEmptyCommercialRow(platform = "instagram"): CommercialDeliverableRow {
  const types = getDeliverableTypeCodesForPlatform(platform);
  return {
    id: crypto.randomUUID(),
    platform,
    deliverable_type: types[0] ?? "other",
    quantity: 1,
    unit_cost: 0,
    revenue_before_vat: 0,
    live_date: null,
    notes: null,
    schedule_mode: "single",
    post_schedules: [],
  };
}

export function duplicateCommercialRow(row: CommercialDeliverableRow): CommercialDeliverableRow {
  return {
    ...row,
    id: crypto.randomUUID(),
    post_schedules: row.post_schedules.map((s) => ({ ...s })),
  };
}

export function expandPostSchedules(row: CommercialDeliverableRow): PostScheduleEntry[] {
  if (row.schedule_mode === "expanded" && row.post_schedules.length > 0) {
    return row.post_schedules;
  }
  return Array.from({ length: row.quantity }, (_, i) => ({
    sequence: i + 1,
    live_date: row.live_date,
    notes: row.notes,
    status: "draft",
  }));
}

export function commercialRowsToPlatformSelections(
  rows: CommercialDeliverableRow[],
  accountLookup: Map<string, { account_id: string; handle: string; profile_url: string | null; follower_count: number | null; engagement_rate: number | null; audience_country: string | null }>
): import("@/features/campaigns/line-assignment").LinePlatformSelection[] {
  const byPlatform = new Map<string, string[]>();

  for (const row of rows) {
    const types = byPlatform.get(row.platform) ?? [];
    for (let i = 0; i < row.quantity; i++) {
      types.push(row.deliverable_type);
    }
    byPlatform.set(row.platform, types);
  }

  return [...byPlatform.entries()].map(([platform, deliverables]) => {
    const account = accountLookup.get(platform);
    return {
      account_id: account?.account_id ?? crypto.randomUUID(),
      platform,
      handle: account?.handle ?? platform,
      profile_url: account?.profile_url ?? null,
      follower_count: account?.follower_count ?? null,
      engagement_rate: account?.engagement_rate ?? null,
      audience_country: account?.audience_country ?? null,
      deliverables,
    };
  });
}
