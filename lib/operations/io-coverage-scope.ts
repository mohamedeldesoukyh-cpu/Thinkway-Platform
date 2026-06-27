import type { AssignmentHierarchyGroup } from "@/lib/domains/campaign/assignment-hierarchy-types";
import type { InvoiceWorkspace } from "@/lib/domains/billing/types";
import type {
  IoCoverageSelectionScope,
  IoDeliverableSnapshot,
  IoLineSnapshot,
} from "@/lib/operations/io-coverage";

function finiteNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export type IoCoverageSelectionMode = "generate" | "regenerate";

export function deliverableInSelectionScope(
  deliverable: AssignmentHierarchyGroup["deliverables"][number],
  input: {
    mode: IoCoverageSelectionMode;
    explicitDeliverableIds?: Set<string>;
  }
): boolean {
  if (input.explicitDeliverableIds?.size) {
    return input.explicitDeliverableIds.has(deliverable.id);
  }

  if (input.mode === "regenerate") {
    return (
      finiteNumber(deliverable.invoiced_amount) > 0 ||
      deliverable.is_locked ||
      deliverable.billing_status === "invoiced" ||
      deliverable.billing_status === "partially_invoiced"
    );
  }

  return finiteNumber(deliverable.remaining_amount) > 0 && !deliverable.is_locked;
}

export function filterHierarchyDeliverablesForScope(
  group: AssignmentHierarchyGroup,
  input: {
    mode: IoCoverageSelectionMode;
    explicitDeliverableIds?: Set<string>;
  }
): AssignmentHierarchyGroup["deliverables"] {
  return (group.deliverables ?? []).filter((d) =>
    deliverableInSelectionScope(d, input)
  );
}

export function buildScopedLineSnapshotFromHierarchy(
  group: AssignmentHierarchyGroup,
  input: {
    mode: IoCoverageSelectionMode;
    explicitDeliverableIds?: Set<string>;
  }
): IoLineSnapshot {
  const line = group.line;
  const scopedDeliverables = filterHierarchyDeliverablesForScope(group, input);

  const deliverables: IoDeliverableSnapshot[] = scopedDeliverables.map((d) => ({
    id: d.id,
    platform: d.platform,
    deliverable_type: d.deliverable_type,
    quantity: finiteNumber(d.quantity, 1),
    revenue_before_vat: finiteNumber(d.revenue_before_vat),
    cost_before_vat: finiteNumber(d.cost_before_vat),
  }));

  const revenueFromDeliverables = deliverables.reduce(
    (sum, d) => sum + d.revenue_before_vat,
    0
  );

  return {
    line_id: line.id,
    line_name: line.document_number ?? line.name,
    vendor_io_id: line.vendor_io_id,
    active_vendor_io_id: line.active_vendor_io_id,
    vendor_io_document_number: line.vendor_io_document_number,
    influencer_id: line.influencer_id,
    revenue_before_vat:
      deliverables.length > 0
        ? revenueFromDeliverables
        : finiteNumber(line.revenue_before_vat ?? line.revenue),
    cost_before_vat: finiteNumber(line.cost_before_vat ?? line.cost),
    deliverables,
  };
}

export function buildScopedBaselineFromInvoiceLines(
  invoiceLines: InvoiceWorkspace["lines"],
  scope: IoCoverageSelectionScope
): Map<string, IoLineSnapshot> {
  const lineFilter = new Set(scope.lineIds);
  const deliverableFilter = scope.deliverableIds?.length
    ? new Set(scope.deliverableIds)
    : null;

  const byLine = new Map<string, IoLineSnapshot>();

  for (const item of invoiceLines) {
    const lineId = item.campaign_line_id;
    if (!lineId || !lineFilter.has(lineId)) continue;
    if (
      deliverableFilter &&
      item.assignment_deliverable_id &&
      !deliverableFilter.has(item.assignment_deliverable_id)
    ) {
      continue;
    }

    const existing = byLine.get(lineId) ?? {
      line_id: lineId,
      line_name: item.line_document_number ?? item.description,
      vendor_io_id: null,
      active_vendor_io_id: null,
      vendor_io_document_number: null,
      influencer_id: null,
      revenue_before_vat: 0,
      cost_before_vat: 0,
      deliverables: [],
    };

    if (item.assignment_deliverable_id) {
      existing.deliverables.push({
        id: item.assignment_deliverable_id,
        platform: item.deliverable_label?.split(" ")[0] ?? "unknown",
        deliverable_type: item.description,
        quantity: finiteNumber(item.quantity, 1),
        revenue_before_vat: finiteNumber(item.revenue_before_vat ?? item.line_total),
        cost_before_vat: 0,
      });
    }

    existing.revenue_before_vat += finiteNumber(item.revenue_before_vat ?? item.line_total);
    byLine.set(lineId, existing);
  }

  return byLine;
}

export function toCoverageScope(input: {
  lineIds: string[];
  deliverableIds?: string[];
}): IoCoverageSelectionScope {
  return {
    lineIds: [...new Set(input.lineIds)],
    deliverableIds: input.deliverableIds?.length
      ? [...new Set(input.deliverableIds)]
      : undefined,
  };
}
