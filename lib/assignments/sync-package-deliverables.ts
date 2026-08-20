import type { CommercialDeliverableRow } from "@/lib/assignments/commercial-calculations";
import { distributeAmountByWeights } from "@/lib/assignments/commercial-calculations";
import {
  countLineDeliverables,
  type LinePlatformSelection,
} from "@/lib/campaigns/line-assignment";

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function newRowId(): string {
  return globalThis.crypto.randomUUID();
}

export type PackageLineCommercialTotals = {
  revenueBeforeVat: number;
  costBeforeVat: number;
  usageRightsAmount?: number;
  usageRightsCost?: number;
  agencyFeePercent?: number;
};

export type PackageDeliverableShare = {
  id: string;
  quantity: number;
  unitRevenue: number;
  unitCost: number;
  revenueBeforeVat: number;
  costBeforeVat: number;
  usageRightsAmount: number;
  usageRightsCost: number;
  agencyFeePercent: number;
};

/** Split a package line's commercial totals across deliverables, weighted by quantity. */
export function splitPackageTotalsAcrossDeliverables(
  deliverables: { id: string; quantity: number }[],
  totals: PackageLineCommercialTotals
): PackageDeliverableShare[] {
  if (deliverables.length === 0) return [];
  const weights = deliverables.map((row) => Math.max(1, Math.floor(row.quantity) || 1));
  const revenueShares = distributeAmountByWeights(totals.revenueBeforeVat, weights);
  const costShares = distributeAmountByWeights(totals.costBeforeVat, weights);
  const usageRightsShares = distributeAmountByWeights(
    totals.usageRightsAmount ?? 0,
    weights
  );
  const usageRightsCostShares = distributeAmountByWeights(
    totals.usageRightsCost ?? 0,
    weights
  );
  const agencyFeePercent = Math.max(0, totals.agencyFeePercent ?? 0);

  return deliverables.map((row, index) => {
    const quantity = weights[index]!;
    const revenueBeforeVat = revenueShares[index] ?? 0;
    const costBeforeVat = costShares[index] ?? 0;
    return {
      id: row.id,
      quantity,
      revenueBeforeVat,
      costBeforeVat,
      unitRevenue: roundMoney(revenueBeforeVat / quantity),
      unitCost: roundMoney(costBeforeVat / quantity),
      usageRightsAmount: usageRightsShares[index] ?? 0,
      usageRightsCost: usageRightsCostShares[index] ?? 0,
      agencyFeePercent,
    };
  });
}

export type PackageAllocatedDeliverableRow<T extends { id: string; quantity: number }> = T & {
  quantity: number;
  unit_revenue: number;
  unit_cost: number;
  revenue_before_vat: number;
  cost_before_vat: number;
  usage_rights_amount: number;
  usage_rights_cost: number;
  agency_fee_percent: number;
};

/** Apply qty-weighted package totals onto child rows. Parent totals stay the SSOT. */
export function applyPackageTotalsToDeliverableRows<T extends { id: string; quantity: number }>(
  rows: T[],
  totals: PackageLineCommercialTotals
): PackageAllocatedDeliverableRow<T>[] {
  const shares = splitPackageTotalsAcrossDeliverables(
    rows.map((row) => ({ id: row.id, quantity: row.quantity })),
    totals
  );
  const byId = new Map(shares.map((share) => [share.id, share]));
  return rows.map((row) => {
    const share = byId.get(row.id);
    if (!share) {
      return {
        ...row,
        quantity: Math.max(1, Math.floor(row.quantity) || 1),
        unit_revenue: 0,
        unit_cost: 0,
        revenue_before_vat: 0,
        cost_before_vat: 0,
        usage_rights_amount: 0,
        usage_rights_cost: 0,
        agency_fee_percent: Math.max(0, totals.agencyFeePercent ?? 0),
      };
    }
    return {
      ...row,
      quantity: share.quantity,
      unit_revenue: share.unitRevenue,
      unit_cost: share.unitCost,
      revenue_before_vat: share.revenueBeforeVat,
      cost_before_vat: share.costBeforeVat,
      usage_rights_amount: share.usageRightsAmount,
      usage_rights_cost: share.usageRightsCost,
      agency_fee_percent: share.agencyFeePercent,
    };
  });
}

/** Simulate package child roster changes without touching line totals. */
export function redistributePackageChildren(
  children: { id: string; quantity: number }[],
  totals: PackageLineCommercialTotals
): PackageDeliverableShare[] {
  return splitPackageTotalsAcrossDeliverables(children, totals);
}

export function packageChildRevenueSum(shares: PackageDeliverableShare[]): number {
  return roundMoney(shares.reduce((sum, row) => sum + row.revenueBeforeVat, 0));
}

export function packageChildCostSum(shares: PackageDeliverableShare[]): number {
  return roundMoney(shares.reduce((sum, row) => sum + row.costBeforeVat, 0));
}

export function packageChildQuantitySum(shares: PackageDeliverableShare[]): number {
  return shares.reduce((sum, row) => sum + row.quantity, 0);
}

/**
 * Build assignment_deliverables rows for package pricing from platform selections.
 * Stores unit revenue/cost; persist multiplies by quantity. Totals come from qty-weighted split.
 */
export function packagePlatformsToCommercialRows(
  platforms: LinePlatformSelection[],
  input: {
    totalRevenueBeforeVat: number;
    totalCostBeforeVat: number;
    dueDate: string | null;
  }
): CommercialDeliverableRow[] {
  const totalUnits = countLineDeliverables(platforms);
  if (totalUnits === 0) return [];

  const draft: CommercialDeliverableRow[] = [];

  for (const platform of platforms) {
    const typeCounts = new Map<string, number>();
    for (const deliverableType of platform.deliverables) {
      typeCounts.set(deliverableType, (typeCounts.get(deliverableType) ?? 0) + 1);
    }

    for (const [deliverableType, quantity] of typeCounts) {
      draft.push({
        id: newRowId(),
        platform: platform.platform,
        deliverable_type: deliverableType,
        quantity,
        unit_cost: 0,
        revenue_before_vat: 0,
        live_date: input.dueDate,
        notes: null,
        schedule_mode: quantity > 1 ? "expanded" : "single",
        post_schedules: [],
      });
    }
  }

  const shares = splitPackageTotalsAcrossDeliverables(
    draft.map((row) => ({ id: row.id, quantity: row.quantity })),
    {
      revenueBeforeVat: input.totalRevenueBeforeVat,
      costBeforeVat: input.totalCostBeforeVat,
    }
  );
  const byId = new Map(shares.map((share) => [share.id, share]));

  return draft.map((row) => {
    const share = byId.get(row.id);
    const quantity = Math.max(1, row.quantity);
    return {
      ...row,
      quantity,
      unit_cost: share ? share.costBeforeVat / quantity : 0,
      revenue_before_vat: share ? share.revenueBeforeVat / quantity : 0,
      usage_rights_amount: share?.usageRightsAmount,
      usage_rights_cost: share?.usageRightsCost,
      agency_fee_percent: share?.agencyFeePercent,
      schedule_mode: quantity > 1 ? "expanded" : "single",
    };
  });
}
