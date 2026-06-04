import type { AssignmentHierarchy } from "@/features/campaigns/types/assignment-hierarchy";

export type PlainAssignmentLine = {
  line_id: string;
  document_number: string | null;
  name: string;
  influencer: string | null;
  operational_status: string | null;
  billing_status: string | null;
  vendor_io_id: string | null;
  invoice_id: string | null;
  revenue: number;
  deliverables: number;
};

function finiteNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function safeString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

/** Extract render-safe plain rows — never throws; logs and skips bad groups. */
export function plainLinesFromHierarchy(
  hierarchy: AssignmentHierarchy,
  context: { campaignId?: string } = {}
): PlainAssignmentLine[] {
  const rows: PlainAssignmentLine[] = [];
  const groups = Array.isArray(hierarchy.groups) ? hierarchy.groups : [];

  for (const group of groups) {
    const lineId = group?.line?.id;
    try {
      const line = group?.line;
      if (!line?.id) continue;

      const deliverables = Array.isArray(group.deliverables) ? group.deliverables : [];

      rows.push({
        line_id: String(line.id),
        document_number: safeString(line.document_number),
        name: safeString(line.name) ?? "Assignment",
        influencer: safeString(line.influencer_name),
        operational_status: safeString(line.operational_status),
        billing_status: safeString(line.billing_status),
        vendor_io_id: safeString(line.vendor_io_id),
        invoice_id: safeString(line.invoice_id),
        revenue: finiteNumber(line.revenue),
        deliverables: deliverables.length || finiteNumber(line.deliverable_count, 1),
      });
    } catch (error) {
      console.error("[Assignments] plain line extract failed", {
        campaignId: context.campaignId,
        lineId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return rows;
}
