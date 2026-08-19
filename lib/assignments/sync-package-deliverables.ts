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

export type PackageDeliverableShare = {
  id: string;
  quantity: number;
  unitRevenue: number;
  unitCost: number;
  revenueBeforeVat: number;
  costBeforeVat: number;
};

/** Split a package line's revenue/cost across deliverables, weighted by quantity. */
export function splitPackageTotalsAcrossDeliverables(
  deliverables: { id: string; quantity: number }[],
  totals: { revenueBeforeVat: number; costBeforeVat: number }
): PackageDeliverableShare[] {
  if (deliverables.length === 0) return [];
  const weights = deliverables.map((row) => Math.max(1, Math.floor(row.quantity) || 1));
  const revenueShares = distributeAmountByWeights(totals.revenueBeforeVat, weights);
  const costShares = distributeAmountByWeights(totals.costBeforeVat, weights);

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
    };
  });
}

/**
 * Build assignment_deliverables rows for package pricing from platform selections.
 * Distributes line revenue/cost evenly across deliverable units.
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

  const perUnitRevenue = roundMoney(input.totalRevenueBeforeVat / totalUnits);
  const perUnitCost = roundMoney(input.totalCostBeforeVat / totalUnits);

  const rows: CommercialDeliverableRow[] = [];

  for (const platform of platforms) {
    const typeCounts = new Map<string, number>();
    for (const deliverableType of platform.deliverables) {
      typeCounts.set(deliverableType, (typeCounts.get(deliverableType) ?? 0) + 1);
    }

    for (const [deliverableType, quantity] of typeCounts) {
      rows.push({
        id: newRowId(),
        platform: platform.platform,
        deliverable_type: deliverableType,
        quantity,
        unit_cost: perUnitCost,
        revenue_before_vat: perUnitRevenue,
        live_date: input.dueDate,
        notes: null,
        schedule_mode: "single",
        post_schedules: [],
      });
    }
  }

  return rows;
}
