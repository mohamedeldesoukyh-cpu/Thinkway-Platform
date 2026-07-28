import { createHash } from "node:crypto";

import type { QuotationConvertUnit } from "@/lib/domains/commercial/quotation-convert-selection";
import type { QuotationItemRow } from "@/lib/domains/commercial/quotation-detail-types";

/** Stable commercial fingerprint for convert snapshot integrity checks. */
export function buildQuotationConvertSnapshotHash(input: {
  quotationId: string;
  serialNumber: string | null;
  versionNumber: number;
  currency: string | null;
  totalRevenueEgp: number | null;
  totalCostEgp: number | null;
  units: QuotationConvertUnit[];
}): string {
  const canonical = {
    quotationId: input.quotationId,
    serialNumber: input.serialNumber,
    versionNumber: input.versionNumber,
    currency: input.currency,
    totalRevenueEgp: input.totalRevenueEgp,
    totalCostEgp: input.totalCostEgp,
    units: input.units.map((unit) => ({
      kind: unit.kind,
      primaryItemId: unit.primaryItem.id,
      memberItemIds: unit.memberItems.map((m) => m.id).sort(),
      revenue: unit.primaryItem.revenue,
      cost: unit.primaryItem.cost,
      af_pct: unit.primaryItem.af_pct,
      collapseGroupId: unit.kind === "package" ? unit.collapseGroupId : null,
    })),
  };

  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

export function countDeliverables(items: QuotationItemRow[]): number {
  return items.reduce((sum, item) => sum + (item.deliverables?.length ?? 0), 0);
}

export const CONVERT_COPIED_FIELDS = [
  "Selected creators / packages → Assignments",
  "Deliverable scope (platform, type, quantity)",
  "Operational PO amounts (revenue, cost, AF%)",
  "Tentative schedule hints (if present)",
  "Provenance (source quotation + item ids)",
  "Commercial snapshot (immutable)",
] as const;

export const CONVERT_REMAINS_ON_QUOTATION = [
  "Quotation serial, version history, signatures",
  "Terms & conditions document text",
  "Client portal approval / comments",
  "Alternative (unselected) options",
  "Pricing worksheets / input modes as offer math",
  "Internal revision notes",
] as const;
