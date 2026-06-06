import type { SupabaseClient } from "@supabase/supabase-js";

import type { InvoiceWorkspace } from "@/features/billing/types";
import type { AssignmentHierarchyGroup } from "@/features/campaigns/types/assignment-hierarchy";
import {
  analyzeIoCoverage,
  type IoCoverageAnalysis,
  type IoCoverageSelectionScope,
  type IoDeliverableSnapshot,
  type IoLineSnapshot,
} from "@/lib/operations/io-coverage";
import {
  buildScopedBaselineFromInvoiceLines,
  buildScopedLineSnapshotFromHierarchy,
  filterHierarchyDeliverablesForScope,
  toCoverageScope,
  type IoCoverageSelectionMode,
} from "@/lib/operations/io-coverage-scope";

function finiteNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function filterDbDeliverablesForMode(
  deliverables: IoDeliverableSnapshot[],
  rawRows: Array<{
    id: string;
    invoiced_amount: number | null;
    remaining_amount: number | null;
    billing_status: string;
    locked_at: string | null;
  }>,
  mode: IoCoverageSelectionMode,
  explicitDeliverableIds?: Set<string>
): IoDeliverableSnapshot[] {
  const rawById = new Map(rawRows.map((r) => [r.id, r]));

  return deliverables.filter((d) => {
    if (explicitDeliverableIds?.size) {
      return explicitDeliverableIds.has(d.id);
    }
    const raw = rawById.get(d.id);
    if (!raw) return false;
    if (mode === "regenerate") {
      return (
        finiteNumber(raw.invoiced_amount) > 0 ||
        Boolean(raw.locked_at) ||
        raw.billing_status === "invoiced" ||
        raw.billing_status === "partially_invoiced"
      );
    }
    return finiteNumber(raw.remaining_amount) > 0 && !raw.locked_at;
  });
}

export async function buildIoLineSnapshotsFromDb(
  supabase: SupabaseClient,
  input: {
    lineIds: string[];
    deliverableIds?: string[];
    mode?: IoCoverageSelectionMode;
  }
): Promise<IoLineSnapshot[]> {
  const lineIds = [...new Set(input.lineIds)];
  if (lineIds.length === 0) return [];

  const mode = input.mode ?? "generate";
  const explicitDeliverableIds = input.deliverableIds?.length
    ? new Set(input.deliverableIds)
    : undefined;

  const { data: lines, error } = await supabase
    .from("campaign_lines")
    .select(
      "id, document_number, name, influencer_id, revenue_before_vat, revenue, cost_before_vat, cost, vendor_io_id"
    )
    .in("id", lineIds);

  if (error || !lines?.length) return [];

  const { data: rawDeliverables } = await supabase
    .from("assignment_deliverables")
    .select(
      "id, campaign_line_id, platform, deliverable_type, quantity, revenue_before_vat, cost_before_vat, invoiced_amount, remaining_amount, billing_status, locked_at"
    )
    .in("campaign_line_id", lineIds)
    .order("sort_order");

  const deliverablesByLine = new Map<string, IoDeliverableSnapshot[]>();
  const rawByLine = new Map<string, Array<{
    id: string;
    invoiced_amount: number | null;
    remaining_amount: number | null;
    billing_status: string;
    locked_at: string | null;
  }>>();

  for (const row of rawDeliverables ?? []) {
    const r = row as {
      id: string;
      campaign_line_id: string;
      platform: string;
      deliverable_type: string;
      quantity: number;
      revenue_before_vat: number;
      cost_before_vat: number;
      invoiced_amount: number | null;
      remaining_amount: number | null;
      billing_status: string;
      locked_at: string | null;
    };

    if (explicitDeliverableIds && !explicitDeliverableIds.has(r.id)) continue;

    const rawList = rawByLine.get(r.campaign_line_id) ?? [];
    rawList.push({
      id: r.id,
      invoiced_amount: r.invoiced_amount,
      remaining_amount: r.remaining_amount,
      billing_status: r.billing_status,
      locked_at: r.locked_at,
    });
    rawByLine.set(r.campaign_line_id, rawList);

    const list = deliverablesByLine.get(r.campaign_line_id) ?? [];
    list.push({
      id: r.id,
      platform: r.platform,
      deliverable_type: r.deliverable_type,
      quantity: finiteNumber(r.quantity, 1),
      revenue_before_vat: finiteNumber(r.revenue_before_vat),
      cost_before_vat: finiteNumber(r.cost_before_vat),
    });
    deliverablesByLine.set(r.campaign_line_id, list);
  }

  const vendorIoIds = [
    ...new Set(
      (lines as Array<{ vendor_io_id: string | null }>)
        .map((l) => l.vendor_io_id)
        .filter(Boolean) as string[]
    ),
  ];

  const vendorDocById = new Map<string, string>();
  if (vendorIoIds.length > 0) {
    const { data: vendorIos } = await supabase
      .from("vendor_ios")
      .select("id, document_number")
      .in("id", vendorIoIds);
    for (const vio of vendorIos ?? []) {
      const row = vio as { id: string; document_number: string };
      vendorDocById.set(row.id, row.document_number);
    }
  }

  return (lines as Array<Record<string, unknown>>).map((line) => {
    const lineId = String(line.id);
    const vendorIoId = (line.vendor_io_id as string | null) ?? null;
    const allDeliverables = deliverablesByLine.get(lineId) ?? [];
    const scopedDeliverables = filterDbDeliverablesForMode(
      allDeliverables,
      rawByLine.get(lineId) ?? [],
      mode,
      explicitDeliverableIds
    );
    const revenue = scopedDeliverables.reduce((s, d) => s + d.revenue_before_vat, 0);

    return {
      line_id: lineId,
      line_name: String(line.document_number ?? line.name ?? lineId),
      vendor_io_id: vendorIoId,
      active_vendor_io_id: vendorIoId,
      vendor_io_document_number: vendorIoId ? vendorDocById.get(vendorIoId) ?? null : null,
      influencer_id: (line.influencer_id as string | null) ?? null,
      revenue_before_vat:
        scopedDeliverables.length > 0
          ? revenue
          : finiteNumber(line.revenue_before_vat ?? line.revenue),
      cost_before_vat: finiteNumber(line.cost_before_vat ?? line.cost),
      deliverables: scopedDeliverables,
    };
  });
}

export async function analyzeInvoiceRegenerationCoverage(
  supabase: SupabaseClient,
  input: {
    invoiceLines: InvoiceWorkspace["lines"];
    scope: IoCoverageSelectionScope;
    mode?: IoCoverageSelectionMode;
  }
): Promise<IoCoverageAnalysis> {
  const scope = toCoverageScope(input.scope);
  const baselines = buildScopedBaselineFromInvoiceLines(input.invoiceLines, scope);
  const currents = await buildIoLineSnapshotsFromDb(supabase, {
    lineIds: scope.lineIds,
    deliverableIds: scope.deliverableIds,
    mode: input.mode ?? "regenerate",
  });
  return analyzeIoCoverage({ currents, baselines, scope });
}

export function analyzeAssignmentGroupsCoverage(input: {
  groups: AssignmentHierarchyGroup[];
  scope: IoCoverageSelectionScope;
  mode?: IoCoverageSelectionMode;
}): IoCoverageAnalysis {
  const scope = toCoverageScope(input.scope);
  const selectedLines = new Set(scope.lineIds);
  const mode = input.mode ?? "generate";
  const explicitDeliverableIds = scope.deliverableIds?.length
    ? new Set(scope.deliverableIds)
    : undefined;

  const baselines = new Map<string, IoLineSnapshot>();

  for (const group of input.groups) {
    if (!selectedLines.has(group.line.id)) continue;

    const scopedDeliverables = filterHierarchyDeliverablesForScope(group, {
      mode: "regenerate",
      explicitDeliverableIds,
    });

    const invoicedValue = scopedDeliverables.reduce(
      (sum, d) => sum + finiteNumber(d.invoiced_amount || d.revenue_before_vat),
      0
    );

    if (scopedDeliverables.length === 0 && invoicedValue <= 0 && !group.line.invoice_id) {
      continue;
    }

    baselines.set(
      group.line.id,
      buildScopedLineSnapshotFromHierarchy(group, {
        mode: "regenerate",
        explicitDeliverableIds,
      })
    );
  }

  const currents = input.groups
    .filter((g) => selectedLines.has(g.line.id))
    .map((group) =>
      buildScopedLineSnapshotFromHierarchy(group, {
        mode,
        explicitDeliverableIds,
      })
    );

  return analyzeIoCoverage({ currents, baselines, scope });
}

export async function analyzeCreateInvoiceCoverage(
  supabase: SupabaseClient,
  input: {
    campaignId: string;
    lineIds: string[];
    deliverableIds: string[];
    mode?: IoCoverageSelectionMode;
    appendInvoiceLines?: InvoiceWorkspace["lines"];
  }
): Promise<IoCoverageAnalysis> {
  const scope = toCoverageScope({
    lineIds: input.lineIds,
    deliverableIds: input.deliverableIds,
  });

  if (scope.lineIds.length === 0 && !scope.deliverableIds?.length) {
    return {
      case: "safe_regeneration",
      lines: [],
      unchanged_line_ids: [],
      revised_line_ids: [],
      needs_io_line_ids: [],
      warning_message: null,
      block_message: null,
      allows_direct_regeneration: true,
    };
  }

  const lineIdsFromDeliverables = scope.deliverableIds?.length
    ? await resolveLineIdsForDeliverables(supabase, scope.deliverableIds)
    : [];
  const mergedLineIds = [...new Set([...scope.lineIds, ...lineIdsFromDeliverables])];
  const mergedScope = toCoverageScope({
    lineIds: mergedLineIds,
    deliverableIds: scope.deliverableIds,
  });

  const baselines = input.appendInvoiceLines
    ? buildScopedBaselineFromInvoiceLines(input.appendInvoiceLines, mergedScope)
    : new Map<string, IoLineSnapshot>();

  const currents = await buildIoLineSnapshotsFromDb(supabase, {
    lineIds: mergedLineIds,
    deliverableIds: mergedScope.deliverableIds,
    mode: input.mode ?? "generate",
  });

  return analyzeIoCoverage({
    currents,
    baselines,
    scope: mergedScope,
  });
}

async function resolveLineIdsForDeliverables(
  supabase: SupabaseClient,
  deliverableIds: string[]
): Promise<string[]> {
  const { data } = await supabase
    .from("assignment_deliverables")
    .select("campaign_line_id")
    .in("id", deliverableIds);
  return [
    ...new Set(
      (data ?? [])
        .map((r) => (r as { campaign_line_id: string }).campaign_line_id)
        .filter(Boolean)
    ),
  ];
}
