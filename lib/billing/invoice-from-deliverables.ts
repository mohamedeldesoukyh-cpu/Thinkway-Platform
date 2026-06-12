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
import { operationalStatusForDb } from "@/lib/campaigns/operational-status-utils";
import {
  invoicedRowAllowed,
  invoicedRowBlockMessage,
  isInvoicedOperationalRow,
  resolveLinkedInvoiceIds,
  type InvoiceValidationContext,
} from "@/lib/billing/invoice-validation-context";
import type { InvoiceLineItemOpSummary } from "@/lib/billing/invoice-lifecycle-debug";
import { resolveClientTaxableBase } from "@/lib/assignments/client-billing-commercial";
import {
  resolveClientBillableAmount,
  resolveInvoicePreviewBeforeVat,
} from "@/lib/billing/client-billable-amount";
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
  options?: { updatingExisting?: boolean; forRegeneration?: boolean }
): number {
  const revenueBeforeVat = Number(deliverable.revenue_before_vat ?? 0);
  const remaining = Number(deliverable.remaining_amount ?? 0);
  const billable = resolveClientBillableAmount({
    revenue_before_vat: revenueBeforeVat,
    usage_rights_amount: deliverable.usage_rights_amount,
    agency_fee_amount: deliverable.agency_fee_amount,
    agency_fee_percent: deliverable.agency_fee_percent,
    billable_amount: deliverable.billable_amount,
  });
  const invoiced = Number(deliverable.invoiced_amount ?? 0);

  if (options?.forRegeneration) {
    return Math.max(revenueBeforeVat, billable, remaining, invoiced);
  }

  return resolveInvoicePreviewBeforeVat({
    revenue_before_vat: revenueBeforeVat,
    usage_rights_amount: deliverable.usage_rights_amount,
    agency_fee_amount: deliverable.agency_fee_amount,
    agency_fee_percent: deliverable.agency_fee_percent,
    billable_amount: billable,
    invoiced_amount: invoiced,
    remaining_amount: remaining,
    locked_at: deliverable.locked_at,
  });
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
  defaultVatRate: number,
  options?: { forRegeneration?: boolean }
) {
  const beforeVat = resolveInvoiceLineBeforeVat(deliverable, {
    updatingExisting: Boolean(deliverable.invoice_line_item_id),
    forRegeneration: options?.forRegeneration,
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
    usage_rights_amount?: number | null;
    agency_fee_amount?: number | null;
    agency_fee_percent?: number | null;
    revenue_vat_percent?: number | null;
    revenue_vat_exempt?: boolean | null;
    remaining_amount?: number | null;
  },
  sortOrder: number,
  defaultVatRate: number,
  options?: { forRegeneration?: boolean }
) {
  const revenueOnly = Number(line.revenue_before_vat ?? line.revenue ?? 0);
  const taxableBase = resolveClientTaxableBase({
    revenueBeforeVat: revenueOnly,
    usageRightsAmount: Number(line.usage_rights_amount ?? 0),
    agencyFeeAmount:
      line.agency_fee_amount != null ? Number(line.agency_fee_amount) : null,
    agencyFeePercent: Number(line.agency_fee_percent ?? 0),
  });
  const remaining = Number(line.remaining_amount ?? 0);
  const beforeVat = options?.forRegeneration
    ? Math.max(taxableBase, remaining, revenueOnly)
    : remaining > 0
      ? remaining
      : taxableBase;
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

export async function lineHasAssignmentDeliverables(
  supabase: SupabaseClient,
  lineIds: string[]
): Promise<boolean> {
  if (lineIds.length === 0) return false;

  const { count, error } = await supabase
    .from("assignment_deliverables")
    .select("id", { count: "exact", head: true })
    .in("campaign_line_id", lineIds);

  if (error) {
    return false;
  }

  return (count ?? 0) > 0;
}

export function resolveExpectedLineBillable(
  line: { id: string; revenue?: number | null; revenue_before_vat?: number | null },
  deliverables: Array<{
    campaign_line_id: string;
    billable_amount?: number | null;
    revenue_before_vat?: number | null;
  }>
): number {
  const lineDeliverables = deliverables.filter(
    (deliverable) => deliverable.campaign_line_id === line.id
  );
  const fromDeliverables = lineDeliverables.reduce(
    (sum, deliverable) =>
      sum + Number(deliverable.billable_amount ?? deliverable.revenue_before_vat ?? 0),
    0
  );
  if (fromDeliverables > 0.01) {
    return Math.round(fromDeliverables * 100) / 100;
  }
  return Math.round(Number(line.revenue_before_vat ?? line.revenue ?? 0) * 100) / 100;
}

export function sumInvoiceLineRevenueForCampaignLine(
  lineItems: Array<{ campaign_line_id: string | null; revenue_before_vat: number | null }>,
  lineId: string
): number {
  const total = lineItems
    .filter((item) => item.campaign_line_id === lineId)
    .reduce((sum, item) => sum + Number(item.revenue_before_vat ?? 0), 0);
  return Math.round(total * 100) / 100;
}

export async function insertPackageAssignmentLineItems(
  supabase: SupabaseClient,
  invoiceId: string,
  headerId: string,
  lineIds: string[],
  options?: { defaultVatRate?: number; forRegeneration?: boolean }
): Promise<{ error?: string; inserted: number }> {
  if (lineIds.length === 0) return { inserted: 0 };

  const { data: lines, error } = await supabase
    .from("campaign_lines")
    .select(
      "id, document_number, name, revenue, revenue_before_vat, usage_rights_amount, agency_fee_amount, agency_fee_percent, revenue_vat_percent, revenue_vat_exempt, billing_status, vendor_io_id"
    )
    .in("id", lineIds);

  if (error) {
    return { error: error.message, inserted: 0 };
  }

  const { data: existingItems } = await supabase
    .from("invoice_line_items")
    .select("campaign_line_id, revenue_before_vat")
    .eq("invoice_id", invoiceId)
    .in("campaign_line_id", lineIds);

  const defaultVatRate = options?.defaultVatRate ?? 0;
  const forRegeneration = options?.forRegeneration ?? false;
  let sortOrder = (existingItems ?? []).length;
  let inserted = 0;

  for (const row of lines ?? []) {
    const line = row as {
      id: string;
      document_number: string;
      name: string;
      revenue?: number | null;
      revenue_before_vat?: number | null;
      usage_rights_amount?: number | null;
      agency_fee_amount?: number | null;
      agency_fee_percent?: number | null;
      revenue_vat_percent?: number | null;
      revenue_vat_exempt?: boolean | null;
      billing_status: string;
      vendor_io_id: string | null;
    };
    if (!line.vendor_io_id) continue;

    const expectedBillable = resolveClientTaxableBase({
      revenueBeforeVat: Number(line.revenue_before_vat ?? line.revenue ?? 0),
      usageRightsAmount: Number(line.usage_rights_amount ?? 0),
      agencyFeeAmount:
        line.agency_fee_amount != null ? Number(line.agency_fee_amount) : null,
      agencyFeePercent: Number(line.agency_fee_percent ?? 0),
    });
    const invoicedOnTarget = sumInvoiceLineRevenueForCampaignLine(
      (existingItems ?? []) as Array<{
        campaign_line_id: string | null;
        revenue_before_vat: number | null;
      }>,
      line.id
    );

    if (
      !forRegeneration &&
      ["invoiced", "paid", "closed"].includes(line.billing_status) &&
      invoicedOnTarget >= expectedBillable - 0.01
    ) {
      continue;
    }

    if (invoicedOnTarget >= expectedBillable - 0.01 && expectedBillable > 0) {
      continue;
    }

    sortOrder += 1;
    const { error: insertError } = await supabase.from("invoice_line_items").insert(
      packageAssignmentLineItemPayload(invoiceId, headerId, line, sortOrder, defaultVatRate, {
        forRegeneration,
      })
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

export async function sumInvoiceLineItemRevenue(
  supabase: SupabaseClient,
  invoiceId: string
): Promise<{ total: number; count: number; error?: string }> {
  const { data, error, count } = await supabase
    .from("invoice_line_items")
    .select("revenue_before_vat", { count: "exact" })
    .eq("invoice_id", invoiceId);

  if (error) {
    return { total: 0, count: 0, error: error.message };
  }

  const total = (data ?? []).reduce(
    (sum, row) => sum + Number((row as { revenue_before_vat: number | null }).revenue_before_vat ?? 0),
    0
  );

  return { total: Math.round(total * 100) / 100, count: count ?? 0 };
}

export function formatZeroBillableLineItemLabels(
  rows: Array<{
    revenue_before_vat: number | null;
    description?: string | null;
    campaign_line?: { document_number?: string | null } | null;
  }>
): string[] {
  const labels: string[] = [];

  for (const row of rows) {
    if (Number(row.revenue_before_vat ?? 0) > 0.01) continue;

    const documentNumber = row.campaign_line?.document_number?.trim();
    if (documentNumber) {
      labels.push(documentNumber);
      continue;
    }

    const description = row.description?.trim() ?? "";
    const match = description.match(/^([A-Z]{2}-\d{4}-\d+(?:-[A-Z])?)\s/);
    if (match?.[1]) {
      labels.push(match[1]);
    }
  }

  return [...new Set(labels)];
}

export async function assertInvoiceHasBillableLineItems(
  supabase: SupabaseClient,
  invoiceId: string
): Promise<{ error?: string }> {
  const { data, error, count } = await supabase
    .from("invoice_line_items")
    .select(
      "revenue_before_vat, description, campaign_line:campaign_lines(document_number)",
      { count: "exact" }
    )
    .eq("invoice_id", invoiceId);

  if (error) {
    return { error: error.message };
  }
  if (!count || count === 0) {
    return { error: "Invoice has no line items." };
  }

  const rows = (data ?? []) as Array<{
    revenue_before_vat: number | null;
    description?: string | null;
    campaign_line?: { document_number?: string | null } | { document_number?: string | null }[] | null;
  }>;

  const total = rows.reduce(
    (sum, row) => sum + Number(row.revenue_before_vat ?? 0),
    0
  );

  if (Math.round(total * 100) / 100 <= 0.01) {
    const zeroLabels = formatZeroBillableLineItemLabels(
      rows.map((row) => ({
        revenue_before_vat: row.revenue_before_vat,
        description: row.description,
        campaign_line: Array.isArray(row.campaign_line)
          ? row.campaign_line[0] ?? null
          : row.campaign_line ?? null,
      }))
    );
    const assignmentHint =
      zeroLabels.length > 0
        ? ` Assignments with zero amounts: ${zeroLabels.join(", ")}.`
        : "";
    return {
      error: `Invoice line items have zero billable amounts.${assignmentHint} Commercial sync could not resolve billable revenue — check assignment commercial fields.`,
    };
  }
  return {};
}

export async function resolveInvoiceDeliverableIds(
  supabase: SupabaseClient,
  campaignId: string,
  deliverableIds: string[],
  lineIds: string[],
  options?: { forRegeneration?: boolean }
): Promise<{ deliverableIds: string[]; error?: string }> {
  const resolved = new Set<string>(deliverableIds);
  const forRegeneration = options?.forRegeneration ?? false;
  let scopedLineIds = lineIds;

  if (forRegeneration && lineIds.length > 0) {
    const { filterIoGatedCampaignLineIds } = await import(
      "@/lib/billing/invoice-regeneration-selection"
    );
    scopedLineIds = await filterIoGatedCampaignLineIds(supabase, lineIds);
  }

  if (scopedLineIds.length > 0) {
    const { data: lineDeliverables, error } = await supabase
      .from("assignment_deliverables")
      .select("id, locked_at, remaining_amount, billing_status, campaign_line_id")
      .eq("campaign_header_id", campaignId)
      .in("campaign_line_id", scopedLineIds);

    if (error) {
      return { deliverableIds: [], error: error.message };
    }

    for (const row of lineDeliverables ?? []) {
      if (row.billing_status === "disputed" || row.billing_status === "cancelled") {
        continue;
      }
      if (forRegeneration) {
        resolved.add(row.id);
        continue;
      }
      if (row.locked_at || Number(row.remaining_amount) <= 0) continue;
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
  options?: {
    defaultVatRate?: number;
    updateExistingOnTargetInvoice?: boolean;
    forRegeneration?: boolean;
  }
): Promise<{ error?: string; lineItemOps?: InvoiceLineItemOpSummary }> {
  const defaultVatRate = options?.defaultVatRate ?? 0;
  const updateExisting = options?.updateExistingOnTargetInvoice ?? false;
  const forRegeneration = options?.forRegeneration ?? false;
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
      defaultVatRate,
      { forRegeneration }
    );
    let reuseLineItem =
      updateExisting &&
      Boolean(row.invoice_line_item_id) &&
      row.linked_invoice_id === invoiceId;
    const billable = resolveInvoiceLineBeforeVat(mapped, {
      updatingExisting: Boolean(reuseLineItem),
      forRegeneration,
    });

    let lineItemId = row.invoice_line_item_id;

    if (reuseLineItem && lineItemId) {
      const { data: existingItem, error: loadError } = await supabase
        .from("invoice_line_items")
        .select("id, assignment_deliverable_id")
        .eq("id", lineItemId)
        .eq("invoice_id", invoiceId)
        .maybeSingle();

      if (loadError) {
        return { error: loadError.message, lineItemOps };
      }

      const typedItem = existingItem as {
        id: string;
        assignment_deliverable_id: string | null;
      } | null;

      if (!typedItem || typedItem.assignment_deliverable_id !== row.id) {
        reuseLineItem = false;
        lineItemId = null;
      }
    }

    if (reuseLineItem && lineItemId) {
      const { error: updateError } = await supabase
        .from("invoice_line_items")
        .update(payload)
        .eq("id", lineItemId);

      if (updateError) {
        return { error: updateError.message, lineItemOps };
      }
      lineItemOps.updated.push(lineItemId);
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

    const lockLiveAdDate = Boolean(row.live_date?.trim());
    const deliverableLockPatch: Record<string, unknown> = {
      invoiced_amount: billable,
      remaining_amount: 0,
      billing_status: "invoiced",
      invoice_line_item_id: lineItemId,
      invoiced_at: now,
    };
    if (lockLiveAdDate) {
      deliverableLockPatch.locked_at = now;
    }

    const { error: lockError } = await supabase
      .from("assignment_deliverables")
      .update(deliverableLockPatch)
      .eq("id", row.id);

    if (lockError) {
      return { error: lockError.message, lineItemOps };
    }

    const postSyncError = await syncPostScheduleOnDeliverableInvoiceLock(supabase, {
      deliverableId: row.id,
      invoiceLineItemId: lineItemId!,
      lockedAt: now,
      deliverableBillable: billable,
      lockSchedule: lockLiveAdDate,
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
      finance_override_until: fullLock ? null : undefined,
    };
    if (fullLock) {
      linePatch.operational_status = operationalStatusForDb("locked");
    } else if (partialLock) {
      linePatch.operational_status = "io_generated";
    }

    await supabase
      .from("campaign_lines")
      .update(linePatch as never)
      .eq("id", lineId);

    await syncLineBillingFromDeliverables(supabase, lineId, nextStatus, {
      invoiceId: fullLock ? invoiceId : null,
    });
    await syncLineOperationalStatus(supabase, lineId);
  }

  return { lineItemOps };
}

/**
 * PR4: Regenerate updates existing invoice_line_items in place — never delete+reinsert.
 */
export async function regenerateInvoiceLineItems(
  supabase: SupabaseClient,
  invoiceId: string,
  headerId: string,
  options?: {
    defaultVatRate?: number;
    lineIds?: string[];
    deliverableIds?: string[];
    postIds?: string[];
  }
): Promise<{
  error?: string;
  updated: number;
  touchedLineIds: string[];
  lineItemOps?: InvoiceLineItemOpSummary;
}> {
  const defaultVatRate = options?.defaultVatRate ?? 0;
  const { filterIoGatedCampaignLineIds, pruneNonIoInvoiceLineItems } = await import(
    "@/lib/billing/invoice-regeneration-selection"
  );
  const { prepareCampaignCommercialForInvoice } = await import(
    "@/lib/billing/repair-invoice-create-pipeline"
  );

  const scopedLineIds =
    options?.lineIds && options.lineIds.length > 0
      ? await filterIoGatedCampaignLineIds(supabase, options.lineIds)
      : [];
  const scopedDeliverableIds = options?.deliverableIds ?? [];
  const scopedPostIds = options?.postIds ?? [];
  const scopedLineIdSet = new Set(scopedLineIds);
  const scopedDeliverableIdSet = new Set(scopedDeliverableIds);
  const scopedPostIdSet = new Set(scopedPostIds);
  const hasExplicitScope =
    scopedLineIdSet.size > 0 ||
    scopedDeliverableIdSet.size > 0 ||
    scopedPostIdSet.size > 0;

  await prepareCampaignCommercialForInvoice(supabase, headerId, {
    lineIds: scopedLineIds.length > 0 ? scopedLineIds : undefined,
  });

  if (scopedLineIds.length > 0) {
    const { clearStaleInvoiceLinksOutsideScope } = await import(
      "@/lib/billing/invoice-regeneration-selection"
    );
    await clearStaleInvoiceLinksOutsideScope(supabase, invoiceId, scopedLineIds);
  }
  await pruneNonIoInvoiceLineItems(supabase, invoiceId);

  const { data: existingItems, error: itemsError } = await supabase
    .from("invoice_line_items")
    .select(
      "id, assignment_deliverable_id, assignment_post_schedule_id, campaign_line_id, sort_order"
    )
    .eq("invoice_id", invoiceId)
    .order("sort_order");

  if (itemsError) {
    return { error: itemsError.message, updated: 0, touchedLineIds: [] };
  }

  if (!existingItems?.length) {
    if (scopedPostIds.length > 0) {
      const { fetchPostsForInvoicing, lockPostsOnInvoice } = await import(
        "@/lib/billing/invoice-from-posts"
      );
      const { posts, error: postsError } = await fetchPostsForInvoicing(
        supabase,
        headerId,
        scopedPostIds
      );
      if (postsError) {
        return { error: postsError, updated: 0, touchedLineIds: [] };
      }
      if (posts.length === 0) {
        return {
          error:
            "No billable post rows found for regeneration. Refresh the campaign and try again.",
          updated: 0,
          touchedLineIds: [],
        };
      }

      const lockResult = await lockPostsOnInvoice(supabase, invoiceId, headerId, posts, {
        defaultVatRate,
        updateExistingOnTargetInvoice: false,
        forRegeneration: true,
      });
      if (lockResult.error) {
        return { error: lockResult.error, updated: 0, touchedLineIds: [] };
      }

      const touchedLineIds = [...new Set(posts.map((row) => row.campaign_line_id))];
      const created = lockResult.lineItemOps?.created.length ?? 0;
      return {
        updated: created,
        touchedLineIds,
        lineItemOps: lockResult.lineItemOps,
      };
    }

    const { deliverableIds: resolvedDeliverableIds, error: resolveError } =
      await resolveInvoiceDeliverableIds(
        supabase,
        headerId,
        scopedDeliverableIds,
        scopedLineIds,
        { forRegeneration: true }
      );

    if (resolveError) {
      return { error: resolveError, updated: 0, touchedLineIds: [] };
    }

    if (resolvedDeliverableIds.length > 0) {
      const { deliverables, error: fetchError } = await fetchDeliverablesForInvoicing(
        supabase,
        headerId,
        resolvedDeliverableIds
      );
      if (fetchError) {
        return { error: fetchError, updated: 0, touchedLineIds: [] };
      }

      if (deliverables.length === 0) {
        return {
          error:
            "No billable deliverables found for regeneration. Refresh the campaign and try again.",
          updated: 0,
          touchedLineIds: [],
        };
      }

      await prepareLinesForDeliverableInvoicing(supabase, deliverables);

      const lockResult = await lockDeliverablesOnInvoice(
        supabase,
        invoiceId,
        headerId,
        deliverables,
        { defaultVatRate, updateExistingOnTargetInvoice: false, forRegeneration: true }
      );
      if (lockResult.error) {
        return { error: lockResult.error, updated: 0, touchedLineIds: [] };
      }

      const touchedLineIds = [
        ...new Set(deliverables.map((row) => row.campaign_line_id)),
      ];
      const created = lockResult.lineItemOps?.created.length ?? 0;

      return {
        updated: created,
        touchedLineIds,
        lineItemOps: lockResult.lineItemOps,
      };
    }

    if (scopedLineIds.length > 0) {
      const insertResult = await insertPackageAssignmentLineItems(
        supabase,
        invoiceId,
        headerId,
        scopedLineIds,
        { defaultVatRate, forRegeneration: true }
      );
      if (insertResult.error) {
        return { error: insertResult.error, updated: 0, touchedLineIds: [] };
      }
      return {
        updated: insertResult.inserted,
        touchedLineIds: scopedLineIds,
        lineItemOps: {
          updated: [],
          created: [],
        },
      };
    }

    return {
      error:
        "No assignments or deliverables in regeneration scope. Refresh the campaign and try again.",
      updated: 0,
      touchedLineIds: [],
    };
  }

  const postIds = (existingItems ?? [])
    .map((i) => (i as { assignment_post_schedule_id: string | null }).assignment_post_schedule_id)
    .filter(Boolean) as string[];

  const deliverableIds = (existingItems ?? [])
    .filter((i) => {
      const row = i as {
        assignment_deliverable_id: string | null;
        assignment_post_schedule_id: string | null;
        campaign_line_id: string | null;
      };
      if (!row.assignment_deliverable_id || row.assignment_post_schedule_id) {
        return false;
      }
      if (scopedDeliverableIdSet.size > 0) {
        return scopedDeliverableIdSet.has(row.assignment_deliverable_id);
      }
      if (scopedLineIdSet.size > 0 && row.campaign_line_id) {
        return scopedLineIdSet.has(row.campaign_line_id);
      }
      return true;
    })
    .map((i) => (i as { assignment_deliverable_id: string }).assignment_deliverable_id);

  const packageLineIds = (existingItems ?? [])
    .filter((i) => {
      const row = i as {
        assignment_deliverable_id: string | null;
        assignment_post_schedule_id: string | null;
        campaign_line_id: string | null;
      };
      if (!row.campaign_line_id || row.assignment_deliverable_id || row.assignment_post_schedule_id) {
        return false;
      }
      return !hasExplicitScope || scopedLineIdSet.has(row.campaign_line_id);
    })
    .map((i) => (i as { campaign_line_id: string }).campaign_line_id);

  const touchedLineIds = new Set<string>();
  let updated = 0;

  if (postIds.length > 0) {
    const { buildPostInvoiceLinePayload, fetchPostsForInvoicing } = await import(
      "@/lib/billing/invoice-from-posts"
    );
    const { posts, error: postsError } = await fetchPostsForInvoicing(
      supabase,
      headerId,
      postIds
    );
    if (postsError) {
      return { error: postsError, updated, touchedLineIds: [...touchedLineIds] };
    }

    const postById = new Map(posts.map((post) => [post.id, post]));

    for (const item of existingItems ?? []) {
      const row = item as {
        id: string;
        assignment_post_schedule_id: string | null;
        campaign_line_id: string | null;
        sort_order: number;
      };
      if (!row.assignment_post_schedule_id) continue;

      const post = postById.get(row.assignment_post_schedule_id);
      if (!post) continue;

      const payload = buildPostInvoiceLinePayload(
        invoiceId,
        headerId,
        post,
        Number(row.sort_order ?? 1),
        defaultVatRate,
        { forRegeneration: true }
      );

      const { error: updateError } = await supabase
        .from("invoice_line_items")
        .update(payload)
        .eq("id", row.id);

      if (updateError) {
        return { error: updateError.message, updated, touchedLineIds: [...touchedLineIds] };
      }

      updated += 1;
      if (row.campaign_line_id) touchedLineIds.add(row.campaign_line_id);
    }
  }

  if (deliverableIds.length > 0) {
    const { deliverables, error: deliverablesError } = await fetchDeliverablesForInvoicing(
      supabase,
      headerId,
      deliverableIds
    );
    if (deliverablesError) {
      return { error: deliverablesError, updated, touchedLineIds: [...touchedLineIds] };
    }

    const deliverableById = new Map(deliverables.map((row) => [row.id, row]));

    for (const item of existingItems ?? []) {
      const row = item as {
        id: string;
        assignment_deliverable_id: string | null;
        assignment_post_schedule_id: string | null;
        campaign_line_id: string | null;
        sort_order: number;
      };
      if (!row.assignment_deliverable_id || row.assignment_post_schedule_id) continue;

      const deliverable = deliverableById.get(row.assignment_deliverable_id);
      const line = deliverable?.campaign_line;
      if (!deliverable || !line) continue;

      const mapped = mapDeliverableRecord(deliverable);
      const payload = deliverableInvoiceLinePayload(
        invoiceId,
        headerId,
        line,
        mapped,
        Number(row.sort_order ?? 1),
        defaultVatRate,
        { forRegeneration: true }
      );

      const { error: updateError } = await supabase
        .from("invoice_line_items")
        .update(payload)
        .eq("id", row.id);

      if (updateError) {
        return { error: updateError.message, updated, touchedLineIds: [...touchedLineIds] };
      }

      updated += 1;
      touchedLineIds.add(line.id);
    }
  }

  if (packageLineIds.length > 0) {
    const { data: lines, error: linesError } = await supabase
      .from("campaign_lines")
      .select(
        "id, document_number, name, revenue, revenue_before_vat, revenue_vat_percent, revenue_vat_exempt"
      )
      .in("id", packageLineIds);

    if (linesError) {
      return { error: linesError.message, updated, touchedLineIds: [...touchedLineIds] };
    }

    const lineById = new Map((lines ?? []).map((line) => [(line as { id: string }).id, line]));

    for (const item of existingItems ?? []) {
      const row = item as {
        id: string;
        campaign_line_id: string | null;
        assignment_deliverable_id: string | null;
        assignment_post_schedule_id: string | null;
        sort_order: number;
      };
      if (
        !row.campaign_line_id ||
        row.assignment_deliverable_id ||
        row.assignment_post_schedule_id
      ) {
        continue;
      }

      const line = lineById.get(row.campaign_line_id);
      if (!line) continue;

      const payload = packageAssignmentLineItemPayload(
        invoiceId,
        headerId,
        line as {
          id: string;
          document_number: string;
          name: string;
          revenue?: number | null;
          revenue_before_vat?: number | null;
          revenue_vat_percent?: number | null;
          revenue_vat_exempt?: boolean | null;
        },
        Number(row.sort_order ?? 1),
        defaultVatRate,
        { forRegeneration: true }
      );

      const { error: updateError } = await supabase
        .from("invoice_line_items")
        .update(payload)
        .eq("id", row.id);

      if (updateError) {
        return { error: updateError.message, updated, touchedLineIds: [...touchedLineIds] };
      }

      updated += 1;
      touchedLineIds.add(row.campaign_line_id);
    }
  }

  if (updated === 0 && (deliverableIds.length > 0 || packageLineIds.length > 0 || postIds.length > 0)) {
    return {
      error:
        "Invoice line items could not be rebuilt from the corrected assignments. Refresh and try again.",
      updated,
      touchedLineIds: [...touchedLineIds],
    };
  }

  return { updated, touchedLineIds: [...touchedLineIds] };
}

/** @deprecated Use regenerateInvoiceLineItems — kept for import compatibility during migration. */
export async function regenerateInvoiceFromDeliverables(
  supabase: SupabaseClient,
  invoiceId: string,
  headerId: string,
  options?: { defaultVatRate?: number }
): Promise<{ error?: string; usedDeliverables: boolean }> {
  const result = await regenerateInvoiceLineItems(supabase, invoiceId, headerId, options);
  return {
    error: result.error,
    usedDeliverables: result.updated > 0,
  };
}
