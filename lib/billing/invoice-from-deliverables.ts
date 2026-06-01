import type { SupabaseClient } from "@supabase/supabase-js";

import { assignmentStatusFromBilling } from "@/features/campaigns/line-assignment";
import {
  deliverableDisplayLabel,
  deriveLineBillingStatusFromDeliverables,
  type DeliverableBillingRow,
  shouldLockLineFully,
} from "@/lib/billing/deliverable-billing";
import { syncLineBillingFromDeliverables } from "@/lib/billing/sync-deliverable-billing";

function lineBillingPatch(billingStatus: string) {
  const assignmentStatus = assignmentStatusFromBilling(billingStatus);
  return assignmentStatus
    ? { billing_status: billingStatus, assignment_status: assignmentStatus }
    : { billing_status: billingStatus };
}

type DeliverableRecord = {
  id: string;
  campaign_line_id: string;
  sort_order: number;
  platform: string;
  deliverable_type: string;
  quantity: number;
  live_date: string | null;
  billable_amount: number;
  invoiced_amount: number;
  collected_amount: number;
  disputed_amount: number;
  remaining_amount: number;
  billing_status: string;
  invoice_line_item_id: string | null;
  locked_at: string | null;
  revenue_before_vat: number;
  revenue_vat_percent: number;
  revenue_vat_exempt: boolean;
  campaign_line: {
    id: string;
    document_number: string;
    name: string;
    billing_status: string;
    invoice_id: string | null;
  } | null;
};

export function mapDeliverableRecord(row: DeliverableRecord): DeliverableBillingRow {
  return {
    id: row.id,
    campaign_line_id: row.campaign_line_id,
    sort_order: row.sort_order,
    platform: row.platform,
    deliverable_type: row.deliverable_type,
    quantity: row.quantity,
    live_date: row.live_date,
    billable_amount: Number(row.billable_amount),
    invoiced_amount: Number(row.invoiced_amount),
    collected_amount: Number(row.collected_amount),
    disputed_amount: Number(row.disputed_amount),
    remaining_amount: Number(row.remaining_amount),
    billing_status: row.billing_status as DeliverableBillingRow["billing_status"],
    invoice_line_item_id: row.invoice_line_item_id,
    locked_at: row.locked_at,
    revenue_before_vat: Number(row.revenue_before_vat),
    revenue_vat_percent: Number(row.revenue_vat_percent ?? 0),
    revenue_vat_exempt: row.revenue_vat_exempt ?? false,
    label: deliverableDisplayLabel(row),
  };
}

function deliverableInvoiceLinePayload(
  invoiceId: string,
  headerId: string,
  line: { id: string; document_number: string; name: string },
  deliverable: DeliverableBillingRow,
  sortOrder: number
) {
  const beforeVat = deliverable.revenue_before_vat;
  const vatExempt = deliverable.revenue_vat_exempt;
  const vatPercent = vatExempt ? 0 : deliverable.revenue_vat_percent;

  return {
    invoice_id: invoiceId,
    campaign_line_id: line.id,
    campaign_header_id: headerId,
    campaign_id: headerId,
    assignment_deliverable_id: deliverable.id,
    sort_order: sortOrder,
    description: `${line.document_number} — ${line.name} · ${deliverable.label}`,
    quantity: 1,
    unit_price: beforeVat,
    revenue_before_vat: beforeVat,
    revenue_vat_percent: vatPercent,
    revenue_vat_exempt: vatExempt,
  };
}

export async function resolveInvoiceDeliverableIds(
  supabase: SupabaseClient,
  campaignId: string,
  deliverableIds: string[],
  lineIds: string[]
): Promise<{ deliverableIds: string[]; error?: string }> {
  const resolved = new Set<string>(deliverableIds);

  if (lineIds.length > 0) {
    const { data: lineDeliverables, error } = await supabase
      .from("assignment_deliverables")
      .select("id, locked_at, remaining_amount, billing_status, campaign_line_id")
      .eq("campaign_header_id", campaignId)
      .in("campaign_line_id", lineIds);

    if (error) {
      return { deliverableIds: [], error: error.message };
    }

    for (const row of lineDeliverables ?? []) {
      if (row.locked_at || Number(row.remaining_amount) <= 0) continue;
      if (row.billing_status === "disputed" || row.billing_status === "cancelled") {
        continue;
      }
      resolved.add(row.id);
    }
  }

  return { deliverableIds: [...resolved] };
}

export async function fetchDeliverablesForInvoicing(
  supabase: SupabaseClient,
  campaignId: string,
  deliverableIds: string[]
): Promise<{ deliverables: DeliverableRecord[]; error?: string }> {
  const { data, error } = await supabase
    .from("assignment_deliverables")
    .select(
      `
      id, campaign_line_id, sort_order, platform, deliverable_type, quantity, live_date,
      billable_amount, invoiced_amount, collected_amount, disputed_amount, remaining_amount,
      billing_status, invoice_line_item_id, locked_at,
      revenue_before_vat, revenue_vat_percent, revenue_vat_exempt,
      campaign_line:campaign_lines!inner(
        id, document_number, name, billing_status, invoice_id, campaign_header_id
      )
    `
    )
    .eq("campaign_header_id", campaignId)
    .in("id", deliverableIds)
    .order("sort_order");

  if (error) {
    return { deliverables: [], error: error.message };
  }

  return { deliverables: (data ?? []) as unknown as DeliverableRecord[] };
}

export function validateDeliverablesForInvoice(
  deliverables: DeliverableRecord[]
): string | null {
  if (deliverables.length === 0) {
    return "No billable deliverables selected.";
  }

  for (const row of deliverables) {
    const line = row.campaign_line;
    if (!line) return "Deliverable assignment not found.";

    if (row.locked_at || Number(row.remaining_amount) <= 0) {
      return "Selected deliverables include already invoiced items.";
    }
    if (row.billing_status === "disputed" || row.billing_status === "cancelled") {
      return "Disputed or cancelled deliverables cannot be invoiced.";
    }
    if (
      !["moved_to_billing", "approved", "partially_invoiced"].includes(
        line.billing_status
      )
    ) {
      return "All assignments must be in billing queue before invoicing deliverables.";
    }
  }

  return null;
}

export async function lockDeliverablesOnInvoice(
  supabase: SupabaseClient,
  invoiceId: string,
  headerId: string,
  deliverables: DeliverableRecord[]
): Promise<{ error?: string }> {
  const now = new Date().toISOString();
  let sortOrder = 0;
  const lineIds = new Set<string>();

  for (const row of deliverables) {
    const line = row.campaign_line!;
    lineIds.add(line.id);
    sortOrder += 1;

    const mapped = mapDeliverableRecord(row);
    const { data: item, error: itemError } = await supabase
      .from("invoice_line_items")
      .insert(deliverableInvoiceLinePayload(invoiceId, headerId, line, mapped, sortOrder))
      .select("id")
      .single();

    if (itemError || !item) {
      await supabase.from("invoices").delete().eq("id", invoiceId);
      return { error: itemError?.message ?? "Invoice line item creation failed." };
    }

    const billable = Number(row.billable_amount);
    const { error: lockError } = await supabase
      .from("assignment_deliverables")
      .update({
        invoiced_amount: billable,
        remaining_amount: 0,
        billing_status: "invoiced",
        invoice_line_item_id: item.id,
        invoiced_at: now,
        locked_at: now,
      })
      .eq("id", row.id);

    if (lockError) {
      await supabase.from("invoices").delete().eq("id", invoiceId);
      return { error: lockError.message };
    }
  }

  for (const lineId of lineIds) {
    const sample = deliverables.find((d) => d.campaign_line_id === lineId);
    const currentStatus = sample?.campaign_line?.billing_status ?? "moved_to_billing";

    const { data: allRows } = await supabase
      .from("assignment_deliverables")
      .select(
        "id, campaign_line_id, sort_order, platform, deliverable_type, quantity, live_date, billable_amount, invoiced_amount, collected_amount, disputed_amount, remaining_amount, billing_status, invoice_line_item_id, locked_at, revenue_before_vat, revenue_vat_percent, revenue_vat_exempt"
      )
      .eq("campaign_line_id", lineId)
      .order("sort_order");

    const mappedAll = ((allRows ?? []) as unknown as DeliverableBillingRow[]).map(
      (r) => ({
        ...r,
        label: deliverableDisplayLabel(r),
      })
    );

    const nextStatus = deriveLineBillingStatusFromDeliverables(
      mappedAll,
      currentStatus
    );
    const fullLock = shouldLockLineFully(mappedAll);
    const partialLock = mappedAll.some((d) => d.locked_at);

    await supabase
      .from("campaign_lines")
      .update({
        ...lineBillingPatch(nextStatus),
        invoice_id: fullLock ? invoiceId : null,
        revenue_locked: fullLock,
        cost_locked: fullLock,
        vendor_assignment_locked: fullLock,
        vat_locked: partialLock,
        billing_invoiced_at: fullLock ? now : null,
      })
      .eq("id", lineId);

    await syncLineBillingFromDeliverables(supabase, lineId, nextStatus);
  }

  return {};
}

export async function regenerateInvoiceFromDeliverables(
  supabase: SupabaseClient,
  invoiceId: string,
  headerId: string
): Promise<{ error?: string; usedDeliverables: boolean }> {
  const { data: existingItems, error: itemsError } = await supabase
    .from("invoice_line_items")
    .select("assignment_deliverable_id, campaign_line_id, sort_order")
    .eq("invoice_id", invoiceId)
    .order("sort_order");

  if (itemsError) {
    return { error: itemsError.message, usedDeliverables: false };
  }

  const deliverableIds = (existingItems ?? [])
    .map((i) => i.assignment_deliverable_id)
    .filter(Boolean) as string[];

  await supabase.from("invoice_line_items").delete().eq("invoice_id", invoiceId);

  if (deliverableIds.length === 0) {
    return { usedDeliverables: false };
  }

  const { deliverables, error } = await fetchDeliverablesForInvoicing(
    supabase,
    headerId,
    deliverableIds
  );

  if (error) {
    return { error, usedDeliverables: true };
  }

  const orderMap = new Map(
    deliverableIds.map((id, index) => [id, index + 1])
  );
  const sorted = [...deliverables].sort(
    (a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0)
  );

  for (const row of sorted) {
    const line = row.campaign_line;
    if (!line) continue;
    const mapped = mapDeliverableRecord(row);
    const sortOrder = orderMap.get(row.id) ?? 1;
    await supabase
      .from("invoice_line_items")
      .insert(
        deliverableInvoiceLinePayload(invoiceId, headerId, line, mapped, sortOrder)
      );
  }

  return { usedDeliverables: true };
}
