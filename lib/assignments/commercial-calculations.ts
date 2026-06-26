import { computeAgencyFeeAmount } from "@/lib/assignments/client-billing-commercial";
import {
  getDeliverableTypeCodesForPlatform,
} from "@/lib/campaigns/deliverable-taxonomy";
import type {
  AssignmentPricingMode,
  CommercialDeliverableRow,
  CommercialSummary,
  PostScheduleEntry,
} from "@/lib/domains/commercial/types";

export type {
  AssignmentPricingMode,
  CommercialDeliverableRow,
  CommercialSummary,
  PostScheduleEntry,
} from "@/lib/domains/commercial/types";

export function rowTotalCost(row: Pick<CommercialDeliverableRow, "quantity" | "unit_cost">): number {
  return Math.round(row.quantity * row.unit_cost * 100) / 100;
}

export function rowTotalRevenue(
  row: Pick<CommercialDeliverableRow, "quantity" | "revenue_before_vat">
): number {
  return Math.round(row.quantity * row.revenue_before_vat * 100) / 100;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Splits a total across weights; remainder goes to the last bucket. */
export function distributeAmountByWeights(total: number, weights: number[]): number[] {
  if (weights.length === 0) return [];
  const weightSum = weights.reduce((sum, weight) => sum + Math.max(0, weight), 0);
  if (weightSum <= 0) {
    const even = roundMoney(total / weights.length);
    const amounts = weights.map(() => even);
    const allocated = roundMoney(amounts.reduce((sum, value) => sum + value, 0));
    const remainder = roundMoney(total - allocated);
    if (remainder !== 0) {
      amounts[amounts.length - 1] = roundMoney(amounts[amounts.length - 1] + remainder);
    }
    return amounts;
  }

  const amounts = weights.map((weight) =>
    roundMoney((total * Math.max(0, weight)) / weightSum)
  );
  const allocated = roundMoney(amounts.reduce((sum, value) => sum + value, 0));
  const remainder = roundMoney(total - allocated);
  if (remainder !== 0) {
    amounts[amounts.length - 1] = roundMoney(amounts[amounts.length - 1] + remainder);
  }
  return amounts;
}

function rowTotalUsageRights(
  row: Pick<CommercialDeliverableRow, "usage_rights_amount">
): number {
  return Math.max(0, row.usage_rights_amount ?? 0);
}

function rowTotalUsageRightsCost(
  row: Pick<CommercialDeliverableRow, "usage_rights_cost">
): number {
  return Math.max(0, row.usage_rights_cost ?? 0);
}

function totalUsageRightsFromRows(rows: CommercialDeliverableRow[]): number {
  return rows.reduce((sum, row) => sum + rowTotalUsageRights(row), 0);
}

function totalUsageRightsCostFromRows(rows: CommercialDeliverableRow[]): number {
  return rows.reduce((sum, row) => sum + rowTotalUsageRightsCost(row), 0);
}

function rowsMatchAgencyFeePercent(rows: CommercialDeliverableRow[], target: number): boolean {
  return rows.every(
    (row) => Math.abs((row.agency_fee_percent ?? 0) - target) < 0.01
  );
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
  const costShares =
    summary.total_cost_before_vat > 0
      ? rows.map((row) => rowTotalCost(row) * (targetCost / summary.total_cost_before_vat))
      : targetCost > 0.01
        ? distributeAmountByWeights(
            targetCost,
            rows.map((row) =>
              summary.total_revenue_before_vat > 0
                ? rowTotalRevenue(row)
                : Math.max(1, row.quantity)
            )
          )
        : rows.map(() => 0);

  return rows.map((row, index) => {
    const quantity = Math.max(1, row.quantity);
    const scaledRevenue = rowTotalRevenue(row) * revenueScale;
    const scaledCost = costShares[index] ?? 0;
    return {
      ...row,
      revenue_before_vat: Math.round((scaledRevenue / quantity) * 100) / 100,
      unit_cost: Math.round((scaledCost / quantity) * 100) / 100,
    };
  });
}

/** Distributes assignment-level UR and AF% to per-deliverable commercial rows. */
export function applyAssignmentUrAfToCommercialRows(
  rows: CommercialDeliverableRow[],
  targetUr: number,
  targetAfPercent: number
): CommercialDeliverableRow[] {
  if (rows.length === 0) return rows;

  const currentUr = totalUsageRightsFromRows(rows);
  if (
    Math.abs(targetUr - currentUr) < 0.01 &&
    rowsMatchAgencyFeePercent(rows, targetAfPercent)
  ) {
    return rows;
  }

  if (rows.length === 1) {
    return [
      {
        ...rows[0]!,
        usage_rights_amount: Math.round(Math.max(0, targetUr) * 100) / 100,
        agency_fee_percent: Math.max(0, targetAfPercent),
      },
    ];
  }

  const summary = summarizeCommercialRows(rows);
  const totalRevenue = summary.total_revenue_before_vat;

  return rows.map((row) => {
    const rowRevenue = rowTotalRevenue(row);
    const urShare =
      totalRevenue > 0
        ? (rowRevenue / totalRevenue) * targetUr
        : targetUr / rows.length;
    return {
      ...row,
      usage_rights_amount: Math.round(Math.max(0, urShare) * 100) / 100,
      agency_fee_percent: Math.max(0, targetAfPercent),
    };
  });
}

/** Distributes assignment-level UR Cost to per-deliverable commercial rows. */
export function applyAssignmentUrCostToCommercialRows(
  rows: CommercialDeliverableRow[],
  targetUrCost: number
): CommercialDeliverableRow[] {
  if (rows.length === 0) return rows;

  const currentUrCost = totalUsageRightsCostFromRows(rows);
  if (Math.abs(targetUrCost - currentUrCost) < 0.01) {
    return rows;
  }

  if (rows.length === 1) {
    return [
      {
        ...rows[0]!,
        usage_rights_cost: Math.round(Math.max(0, targetUrCost) * 100) / 100,
      },
    ];
  }

  const summary = summarizeCommercialRows(rows);
  const totalRevenue = summary.total_revenue_before_vat;

  return rows.map((row) => {
    const rowRevenue = rowTotalRevenue(row);
    const urCostShare =
      totalRevenue > 0
        ? (rowRevenue / totalRevenue) * targetUrCost
        : targetUrCost / rows.length;
    return {
      ...row,
      usage_rights_cost: Math.round(Math.max(0, urCostShare) * 100) / 100,
    };
  });
}

/** Applies assignment revenue, cost, UR, and AF% to child commercial rows. */
export function applyAssignmentCommercialToCommercialRows(
  rows: CommercialDeliverableRow[],
  targetRevenue: number,
  targetCost: number,
  targetUr: number,
  targetAfPercent: number,
  targetUrCost = 0
): CommercialDeliverableRow[] {
  const withTotals = applyAssignmentTotalsToCommercialRows(rows, targetRevenue, targetCost);
  const withUrAf = applyAssignmentUrAfToCommercialRows(withTotals, targetUr, targetAfPercent);
  return applyAssignmentUrCostToCommercialRows(withUrAf, targetUrCost);
}

export function summarizeCommercialRows(rows: CommercialDeliverableRow[]): CommercialSummary {
  const total_cost_before_vat = rows.reduce((s, r) => s + rowTotalCost(r), 0);
  const total_revenue_before_vat = rows.reduce((s, r) => s + rowTotalRevenue(r), 0);
  const total_usage_rights_cost = rows.reduce(
    (s, r) => s + rowTotalUsageRightsCost(r),
    0
  );
  const billing_base = rows.reduce((sum, row) => {
    const revenue = rowTotalRevenue(row);
    const ur = row.usage_rights_amount ?? 0;
    const af = computeAgencyFeeAmount(revenue, ur, row.agency_fee_percent ?? 0);
    return sum + revenue + ur + af;
  }, 0);
  const gp =
    Math.round((billing_base - total_cost_before_vat - total_usage_rights_cost) * 100) / 100;
  const margin_percent =
    billing_base > 0 ? Math.round((gp / billing_base) * 10000) / 100 : 0;
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
    usage_rights_amount: 0,
    usage_rights_cost: 0,
    agency_fee_percent: 0,
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
