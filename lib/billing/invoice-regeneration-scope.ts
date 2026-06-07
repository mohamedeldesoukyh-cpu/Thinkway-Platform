import type { SupabaseClient } from "@supabase/supabase-js";

import type { InvoiceWorkspace } from "@/features/billing/types";
import { getInvoiceLines } from "@/lib/finance/invoice-line-registry";
import { governanceDb } from "@/lib/supabase/governance-client";

export type InvoiceRegenerationScope = {
  lineIds: string[];
  deliverableIds: string[];
  baselineLines: InvoiceWorkspace["lines"];
};

function mapSnapshotLine(
  row: Record<string, unknown>
): InvoiceWorkspace["lines"][number] {
  return {
    id: String(row.id ?? ""),
    campaign_line_id: (row.campaign_line_id as string | null) ?? null,
    assignment_deliverable_id: (row.assignment_deliverable_id as string | null) ?? null,
    description: String(row.description ?? ""),
    quantity: Number(row.quantity ?? 1),
    unit_price: Number(row.unit_price ?? row.revenue_before_vat ?? 0),
    line_total: Number(row.line_total ?? row.revenue_before_vat ?? 0),
    revenue_before_vat: Number(row.revenue_before_vat ?? row.unit_price ?? 0),
    revenue_vat_percent: Number(row.revenue_vat_percent ?? 0),
    revenue_vat_amount: Number(row.revenue_vat_amount ?? 0),
    revenue_vat_exempt: Boolean(row.revenue_vat_exempt),
    line_document_number: (row.line_document_number as string | null) ?? null,
    deliverable_label: (row.deliverable_label as string | null) ?? null,
  };
}

function scopeFromLines(lines: InvoiceWorkspace["lines"]): Pick<
  InvoiceRegenerationScope,
  "lineIds" | "deliverableIds"
> {
  const lineIds = [
    ...new Set(lines.map((line) => line.campaign_line_id).filter(Boolean) as string[]),
  ];
  const deliverableIds = [
    ...new Set(
      lines.map((line) => line.assignment_deliverable_id).filter(Boolean) as string[]
    ),
  ];
  return { lineIds, deliverableIds };
}

async function resolveDeliverableIdsForLineIds(
  supabase: SupabaseClient,
  lineIds: string[]
): Promise<string[]> {
  if (lineIds.length === 0) return [];

  const { data: deliverables } = await supabase
    .from("assignment_deliverables")
    .select("id, billing_status")
    .in("campaign_line_id", lineIds);

  return (deliverables ?? [])
    .filter((row) => {
      const status = (row as { billing_status: string }).billing_status;
      return status !== "disputed" && status !== "cancelled";
    })
    .map((row) => (row as { id: string }).id);
}

/**
 * Resolves invoice regeneration scope after ungenerate deleted live line items.
 * Falls back to the latest invoice_versions snapshot captured at ungenerate time.
 */
export async function resolveInvoiceRegenerationScope(
  supabase: SupabaseClient,
  input: {
    invoiceId: string;
    campaignHeaderId?: string | null;
  }
): Promise<InvoiceRegenerationScope> {
  const invoiceLinesResult = await getInvoiceLines(supabase, input.invoiceId);
  const liveLines = invoiceLinesResult.lines ?? [];

  if (liveLines.length > 0) {
    const scoped = scopeFromLines(liveLines);
    const { filterIoGatedCampaignLineIds } = await import(
      "@/lib/billing/invoice-regeneration-selection"
    );
    const lineIds = await filterIoGatedCampaignLineIds(supabase, scoped.lineIds);
    const allowedLineIds = new Set(lineIds);
    return {
      lineIds,
      deliverableIds: scoped.deliverableIds.filter((deliverableId) => {
        const lineId = liveLines.find(
          (line) => line.assignment_deliverable_id === deliverableId
        )?.campaign_line_id;
        return lineId ? allowedLineIds.has(lineId) : true;
      }),
      baselineLines: liveLines.filter(
        (line) => !line.campaign_line_id || allowedLineIds.has(line.campaign_line_id)
      ),
    };
  }

  const { data: versionRow } = await governanceDb(supabase)
    .from("invoice_versions")
    .select("line_items_snapshot")
    .eq("invoice_id", input.invoiceId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const snapshot = (versionRow as { line_items_snapshot?: unknown } | null)
    ?.line_items_snapshot;
  const snapshotLines = Array.isArray(snapshot)
    ? snapshot.map((row) => mapSnapshotLine(row as Record<string, unknown>))
    : [];

  if (snapshotLines.length > 0) {
    const scoped = scopeFromLines(snapshotLines);
    const { filterIoGatedCampaignLineIds } = await import(
      "@/lib/billing/invoice-regeneration-selection"
    );
    const lineIds = await filterIoGatedCampaignLineIds(supabase, scoped.lineIds);
    const allowedLineIds = new Set(lineIds);
    return {
      lineIds,
      deliverableIds: scoped.deliverableIds.filter((deliverableId) => {
        const lineId = snapshotLines.find(
          (line) => line.assignment_deliverable_id === deliverableId
        )?.campaign_line_id;
        return lineId ? allowedLineIds.has(lineId) : true;
      }),
      baselineLines: snapshotLines.filter(
        (line) => !line.campaign_line_id || allowedLineIds.has(line.campaign_line_id)
      ),
    };
  }

  if (input.campaignHeaderId) {
    const { data: overrideLines } = await supabase
      .from("campaign_lines")
      .select("id")
      .eq("campaign_header_id", input.campaignHeaderId)
      .not("finance_override_until", "is", null)
      .gt("finance_override_until", new Date().toISOString());

    const lineIds = (overrideLines ?? []).map((row) => (row as { id: string }).id);
    if (lineIds.length > 0) {
      const deliverableIds = await resolveDeliverableIdsForLineIds(supabase, lineIds);
      return {
        lineIds,
        deliverableIds,
        baselineLines: [],
      };
    }
  }

  return { lineIds: [], deliverableIds: [], baselineLines: [] };
}
