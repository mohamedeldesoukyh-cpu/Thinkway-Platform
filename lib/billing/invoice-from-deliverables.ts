import type { SupabaseClient } from "@supabase/supabase-js";

import { assignmentStatusFromBilling } from "@/features/campaigns/line-assignment";
import {
  assignmentDeliverableBillingSelect,
  queryAssignmentDeliverables,
  resolveDeliverableVatExempt,
} from "@/lib/billing/assignment-deliverable-queries";
import {
  deliverableDisplayLabel,
  deriveLineBillingStatusFromDeliverables,
  type DeliverableBillingRow,
  shouldLockLineFully,
} from "@/lib/billing/deliverable-billing";
import { syncLineBillingFromDeliverables } from "@/lib/billing/sync-deliverable-billing";
import { syncLineOperationalStatus } from "@/lib/billing/sync-line-operational-status";
import { resolveActiveVendorIoId } from "@/lib/io/vendor-io-active-link";
import { syncPostScheduleOnDeliverableInvoiceLock } from "@/lib/billing/sync-post-invoice-lock";
import {
  invoicedRowAllowed,
  invoicedRowBlockMessage,
  isInvoicedOperationalRow,
  resolveLinkedInvoiceIds,
  type InvoiceValidationContext,
} from "@/lib/billing/invoice-validation-context";
import type { InvoiceLineItemOpSummary } from "@/lib/billing/invoice-lifecycle-debug";
import { devLog } from "@/lib/dev-log";

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
  linked_invoice_id?: string | null;
  revenue_before_vat: number;
  revenue_vat_percent: number;
  revenue_vat_exempt?: boolean | null;
  campaign_line: {
    id: string;
    document_number: string;
    name: string;
    billing_status: string;
    invoice_id: string | null;
    revenue_vat_percent?: number | null;
    revenue_vat_exempt?: boolean | null;
  } | null;
};

export function mapDeliverableRecord(
  row: DeliverableRecord,
  includesVatExempt = true
): DeliverableBillingRow {
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
    revenue_vat_exempt:
      resolveDeliverableVatExempt(row, includesVatExempt) ||
      (row.campaign_line?.revenue_vat_exempt ?? false),
    label: deliverableDisplayLabel(row),
  };
}

export function resolveInvoiceLineBeforeVat(
  deliverable: DeliverableBillingRow,
  options?: { updatingExisting?: boolean }
): number {
  const revenueBeforeVat = Number(deliverable.revenue_before_vat ?? 0);
  const remaining = Number(deliverable.remaining_amount ?? 0);
  const billable = Number(deliverable.billable_amount ?? 0);
  const invoiced = Number(deliverable.invoiced_amount ?? 0);

  if (remaining > 0) return remaining;

  if (
    options?.updatingExisting ||
    Boolean(deliverable.locked_at || deliverable.invoice_line_item_id)
  ) {
    return Math.max(revenueBeforeVat, billable, invoiced);
  }

  if (revenueBeforeVat > 0) return revenueBeforeVat;
  return billable;
}

export function resolveInvoiceLineVatPercent(
  deliverable: DeliverableBillingRow,
  line: { revenue_vat_percent?: number | null; revenue_vat_exempt?: boolean | null },
  defaultVatRate: number
): number {
  const exempt =
    deliverable.revenue_vat_exempt || Boolean(line.revenue_vat_exempt);
  if (exempt) return 0;
  if (deliverable.revenue_vat_percent > 0) return deliverable.revenue_vat_percent;
  if (Number(line.revenue_vat_percent ?? 0) > 0) {
    return Number(line.revenue_vat_percent);
  }
  return defaultVatRate;
}

function deliverableInvoiceLinePayload(
  invoiceId: string,
  headerId: string,
  line: { id: string; document_number: string; name: string; revenue_vat_percent?: number | null; revenue_vat_exempt?: boolean | null },
  deliverable: DeliverableBillingRow,
  sortOrder: number,
  defaultVatRate: number
) {
  const beforeVat = resolveInvoiceLineBeforeVat(deliverable, {
    updatingExisting: Boolean(deliverable.invoice_line_item_id),
  });
  const vatExempt =
    deliverable.revenue_vat_exempt || Boolean(line.revenue_vat_exempt);
  const vatPercent = resolveInvoiceLineVatPercent(deliverable, line, defaultVatRate);

  return {
    invoice_id: invoiceId,
    campaign_line_id: line.id,
    campaign_header_id: headerId,
    assignment_deliverable_id: deliverable.id,
    sort_order: sortOrder,
    description: `${line.document_number} — ${line.name} · ${deliverable.label}`,
    quantity: 1,
    unit_price: beforeVat,
    revenue_before_vat: beforeVat,
    revenue_vat_percent: vatExempt ? 0 : vatPercent,
    revenue_vat_exempt: vatExempt,
  };
}

export function packageAssignmentLineItemPayload(
  invoiceId: string,
  headerId: string,
  line: {
    id: string;
    document_number: string;
    name: string;
    revenue?: number | null;
    revenue_before_vat?: number | null;
    revenue_vat_percent?: number | null;
    revenue_vat_exempt?: boolean | null;
    remaining_amount?: number | null;
  },
  sortOrder: number,
  defaultVatRate: number
) {
  const beforeVat = Number(
    line.remaining_amount ?? line.revenue_before_vat ?? line.revenue ?? 0
  );
  const vatExempt = Boolean(line.revenue_vat_exempt);
  const vatPercent = vatExempt
    ? 0
    : Number(line.revenue_vat_percent ?? 0) > 0
      ? Number(line.revenue_vat_percent)
      : defaultVatRate;

  return {
    invoice_id: invoiceId,
    campaign_line_id: line.id,
    campaign_header_id: headerId,
    sort_order: sortOrder,
    description: `${line.document_number} — ${line.name}`,
    quantity: 1,
    unit_price: beforeVat,
    revenue_before_vat: beforeVat,
    revenue_vat_percent: vatPercent,
    revenue_vat_exempt: vatExempt,
  };
}

export async function insertPackageAssignmentLineItems(
  supabase: SupabaseClient,
  invoiceId: string,
  headerId: string,
  lineIds: string[],
  options?: { defaultVatRate?: number }
): Promise<{ error?: string; inserted: number }> {
  if (lineIds.length === 0) return { inserted: 0 };

  const { data: lines, error } = await supabase
    .from("campaign_lines")
    .select(
      "id, document_number, name, revenue, revenue_before_vat, revenue_vat_percent, revenue_vat_exempt, billing_status, vendor_io_id"
    )
    .in("id", lineIds);

  if (error) {
    return { error: error.message, inserted: 0 };
  }

  const defaultVatRate = options?.defaultVatRate ?? 0;
  let sortOrder = 0;
  let inserted = 0;

  for (const row of lines ?? []) {
    const line = row as {
      id: string;
      document_number: string;
      name: string;
      revenue?: number | null;
      revenue_before_vat?: number | null;
      revenue_vat_percent?: number | null;
      revenue_vat_exempt?: boolean | null;
      billing_status: string;
      vendor_io_id: string | null;
    };
    if (!line.vendor_io_id) continue;
    if (["invoiced", "paid", "closed"].includes(line.billing_status)) continue;

    sortOrder += 1;
    const { error: insertError } = await supabase.from("invoice_line_items").insert(
      packageAssignmentLineItemPayload(invoiceId, headerId, line, sortOrder, defaultVatRate)
    );
    if (insertError) {
      return { error: insertError.message, inserted };
    }
    inserted += 1;
  }

  if (inserted > 0) {
    const totalsError = await recalculateInvoiceTotals(supabase, invoiceId);
    if (totalsError.error) {
      return { error: totalsError.error, inserted };
    }
  }

  return { inserted };
}

export async function recalculateInvoiceTotals(
  supabase: SupabaseClient,
  invoiceId: string
): Promise<{ error?: string }> {
  const { error } = await supabase.rpc("recalculate_invoice_totals", {
    p_invoice_id: invoiceId,
  });

  if (error) {
    return { error: error.message };
  }

  return {};
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
  const campaignLineEmbed =
    "campaign_line:campaign_lines!inner(id, document_number, name, billing_status, invoice_id, campaign_header_id, revenue_vat_percent, revenue_vat_exempt)";

  const { data, error, includesVatExempt } = await queryAssignmentDeliverables<
    DeliverableRecord
  >(async (select) => {
    const result = await supabase
      .from("assignment_deliverables")
      .select(`${select}, ${campaignLineEmbed}`)
      .eq("campaign_header_id", campaignId)
      .in("id", deliverableIds)
      .order("sort_order");
    return {
      data: (result.data ?? null) as DeliverableRecord[] | null,
      error: result.error,
    };
  });

  if (error) {
    return { deliverables: [], error };
  }

  const mapped = (data ?? []).map((row) => ({
    ...row,
    revenue_vat_exempt:
      resolveDeliverableVatExempt(row, includesVatExempt) ||
      (row.campaign_line?.revenue_vat_exempt ?? false),
  })) as DeliverableRecord[];

  const linkedInvoiceByLineItem = await resolveLinkedInvoiceIds(
    supabase,
    mapped.map((row) => row.invoice_line_item_id).filter(Boolean) as string[]
  );

  return {
    deliverables: mapped.map((row) => ({
      ...row,
      linked_invoice_id: row.invoice_line_item_id
        ? (linkedInvoiceByLineItem.get(row.invoice_line_item_id) ?? null)
        : null,
    })),
  };
}

/** Promote io_generated lines with active Vendor IO into billing queue before invoicing. */
export async function prepareLinesForDeliverableInvoicing(
  supabase: SupabaseClient,
  deliverables: DeliverableRecord[]
): Promise<void> {
  const lineIds = new Set<string>();
  for (const row of deliverables) {
    if (row.campaign_line?.id) lineIds.add(row.campaign_line.id);
  }

  for (const lineId of lineIds) {
    const sample = deliverables.find((d) => d.campaign_line?.id === lineId);
    const line = sample?.campaign_line;
    if (!line) continue;

    if (["moved_to_billing", "partially_invoiced"].includes(line.billing_status)) {
      continue;
    }

    const { data: row } = await supabase
      .from("campaign_lines")
      .select("vendor_io_id, invoice_id, billing_status, operational_status")
      .eq("id", lineId)
      .maybeSingle();

    if (!row?.vendor_io_id || row.invoice_id) continue;
    if (["invoiced", "paid", "closed", "partially_paid"].includes(row.billing_status)) {
      continue;
    }

    const activeVendorIoId = await resolveActiveVendorIoId(supabase, row.vendor_io_id);
    if (!activeVendorIoId) continue;

    await supabase
      .from("campaign_lines")
      .update({
        billing_status: "moved_to_billing",
        operational_status: "io_generated",
      } as never)
      .eq("id", lineId);

    line.billing_status = "moved_to_billing";
  }
}

export function validateDeliverablesForInvoice(
  deliverables: DeliverableRecord[],
  validationCtx: InvoiceValidationContext = { mode: "new" }
): string | null {
  if (deliverables.length === 0) {
    return "No billable deliverables selected.";
  }

  for (const row of deliverables) {
    const line = row.campaign_line;
    if (!line) return "Deliverable assignment not found.";

    if (!invoicedRowAllowed(row, validationCtx)) {
      return invoicedRowBlockMessage("deliverable", validationCtx);
    }

    if (
      validationCtx.mode === "new" &&
      !isInvoicedOperationalRow(row) &&
      Number(row.remaining_amount) <= 0
    ) {
      return "Selected deliverables include already invoiced items.";
    }
    if (row.billing_status === "disputed" || row.billing_status === "cancelled") {
      return "Disputed or cancelled deliverables cannot be invoiced.";
    }
    if (
      validationCtx.mode === "new" &&
      ["invoiced", "paid", "closed"].includes(line.billing_status)
    ) {
      return "Selected assignments are already fully invoiced or closed.";
    }
    if (
      validationCtx.mode === "append" &&
      validationCtx.targetInvoiceId &&
      ["invoiced", "paid", "closed"].includes(line.billing_status) &&
      line.invoice_id &&
      line.invoice_id !== validationCtx.targetInvoiceId
    ) {
      return "Selected assignments are already fully invoiced or closed.";
    }
  }

  return null;
}

export async function lockDeliverablesOnInvoice(
  supabase: SupabaseClient,
  invoiceId: string,
  headerId: string,
  deliverables: DeliverableRecord[],
  options?: { defaultVatRate?: number; updateExistingOnTargetInvoice?: boolean }
): Promise<{ error?: string; lineItemOps?: InvoiceLineItemOpSummary }> {
  const defaultVatRate = options?.defaultVatRate ?? 0;
  const updateExisting = options?.updateExistingOnTargetInvoice ?? false;
  const now = new Date().toISOString();
  let sortOrder = 0;
  const lineIds = new Set<string>();
  const lineItemOps: InvoiceLineItemOpSummary = { updated: [], created: [] };

  for (const row of deliverables) {
    const line = row.campaign_line!;
    lineIds.add(line.id);
    sortOrder += 1;

    const mapped = mapDeliverableRecord(row);
    const payload = deliverableInvoiceLinePayload(
      invoiceId,
      headerId,
      line,
      mapped,
      sortOrder,
      defaultVatRate
    );
    const reuseLineItem =
      updateExisting &&
      row.invoice_line_item_id &&
      row.linked_invoice_id === invoiceId;
    const billable = resolveInvoiceLineBeforeVat(mapped, {
      updatingExisting: Boolean(reuseLineItem),
    });

    let lineItemId = row.invoice_line_item_id;

    if (reuseLineItem && lineItemId) {
      const { error: updateError } = await supabase
        .from("invoice_line_items")
        .update(payload)
        .eq("id", lineItemId);

      if (updateError) {
        return { error: updateError.message, lineItemOps };
      }
      lineItemOps.updated.push(lineItemId!);
    } else {
      const { data: item, error: itemError } = await supabase
        .from("invoice_line_items")
        .insert(payload)
        .select("id")
        .single();

      if (itemError || !item) {
        return { error: itemError?.message ?? "Invoice line item creation failed.", lineItemOps };
      }

      lineItemId = item.id;
      lineItemOps.created.push(item.id);
    }

    const { error: lockError } = await supabase
      .from("assignment_deliverables")
      .update({
        invoiced_amount: billable,
        remaining_amount: 0,
        billing_status: "invoiced",
        invoice_line_item_id: lineItemId,
        invoiced_at: now,
        locked_at: now,
      })
      .eq("id", row.id);

    if (lockError) {
      return { error: lockError.message, lineItemOps };
    }

    const postSyncError = await syncPostScheduleOnDeliverableInvoiceLock(supabase, {
      deliverableId: row.id,
      invoiceLineItemId: lineItemId!,
      lockedAt: now,
      deliverableBillable: billable,
    });

    if (postSyncError.error) {
      return { error: postSyncError.error, lineItemOps };
    }

    if (process.env.NODE_ENV === "development") {
      devLog("[billing-sync] deliverable locked on invoice", {
        deliverableId: row.id,
        invoiceId,
        billable,
        lineItemMode: reuseLineItem ? "updated" : "created",
        lineItemId,
      });
    }
  }

  for (const lineId of lineIds) {
    const sample = deliverables.find((d) => d.campaign_line_id === lineId);
    const currentStatus = sample?.campaign_line?.billing_status ?? "moved_to_billing";

    const { data: allRows } = await supabase
      .from("assignment_deliverables")
      .select(assignmentDeliverableBillingSelect(false))
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

    const linePatch: Record<string, unknown> = {
      ...lineBillingPatch(nextStatus),
      invoice_id: fullLock ? invoiceId : null,
      revenue_locked: fullLock,
      cost_locked: fullLock,
      vendor_assignment_locked: fullLock,
      vat_locked: partialLock,
      billing_invoiced_at: fullLock ? now : null,
    };
    if (fullLock) {
      linePatch.operational_status = "locked";
    } else if (partialLock) {
      linePatch.operational_status = "io_generated";
    }

    await supabase
      .from("campaign_lines")
      .update(linePatch as never)
      .eq("id", lineId);

    await syncLineBillingFromDeliverables(supabase, lineId, nextStatus);
    await syncLineOperationalStatus(supabase, lineId);
  }

  const totalsError = await recalculateInvoiceTotals(supabase, invoiceId);
  if (totalsError.error) {
    return { ...totalsError, lineItemOps };
  }

  return { lineItemOps };
}

export async function regenerateInvoiceFromDeliverables(
  supabase: SupabaseClient,
  invoiceId: string,
  headerId: string,
  options?: { defaultVatRate?: number }
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
        deliverableInvoiceLinePayload(
          invoiceId,
          headerId,
          line,
          mapped,
          sortOrder,
          options?.defaultVatRate ?? 0
        )
      );
  }

  await recalculateInvoiceTotals(supabase, invoiceId);

  return { usedDeliverables: true };
}
