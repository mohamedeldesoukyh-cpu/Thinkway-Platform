import type { SupabaseClient } from "@supabase/supabase-js";

import {
  loadLineVatForDeliverable,
  syncDeliverableRollupFromPosts,
} from "@/lib/assignments/sync-post-schedules";
import { loadActiveInvoiceLineItemIds } from "@/lib/billing/invoice-validation-context";
import { syncLineBillingFromDeliverables } from "@/lib/billing/sync-deliverable-billing";
import { syncLineOperationalStatusBatch } from "@/lib/billing/sync-line-operational-status";
import { devLog } from "@/lib/dev-log";

const INVOICED_DELIVERABLE_STATUSES = new Set([
  "invoiced",
  "partially_invoiced",
  "collected",
  "partially_collected",
]);

type DeliverableRow = {
  id: string;
  campaign_line_id: string;
  billing_status: string;
  invoice_line_item_id: string | null;
  locked_at: string | null;
  billable_amount: number | null;
  revenue_before_vat: number | null;
  invoiced_amount?: number | null;
  remaining_amount?: number | null;
};

type PostRow = {
  id: string;
  campaign_line_id: string;
  assignment_deliverable_id: string;
  billing_status: string;
  invoice_line_item_id: string | null;
  locked_at: string | null;
  billable_amount: number | null;
  revenue_before_vat: number | null;
  invoiced_amount?: number | null;
  remaining_amount?: number | null;
};

const INVOICED_POST_STATUSES = new Set([
  "invoiced",
  "partially_invoiced",
  "collected",
  "partially_collected",
]);

type InvoiceLineItemRow = {
  id: string;
  invoice_id: string;
  assignment_deliverable_id: string | null;
  campaign_line_id: string | null;
  revenue_before_vat: number;
};

function deliverableNeedsRepair(
  row: DeliverableRow,
  activeLineItemIds: Set<string>
): boolean {
  const looksInvoiced =
    INVOICED_DELIVERABLE_STATUSES.has(row.billing_status) ||
    Boolean(row.locked_at) ||
    Boolean(row.invoice_line_item_id);

  if (!looksInvoiced) return false;

  if (!row.invoice_line_item_id) return true;
  return !activeLineItemIds.has(row.invoice_line_item_id);
}

export function postScheduleNeedsOrphanRepair(
  row: PostRow,
  activeLineItemIds: Set<string>
): boolean {
  const looksInvoiced =
    INVOICED_POST_STATUSES.has(row.billing_status) ||
    Boolean(row.locked_at) ||
    Boolean(row.invoice_line_item_id);

  if (!looksInvoiced) return false;

  if (!row.invoice_line_item_id) return true;
  return !activeLineItemIds.has(row.invoice_line_item_id);
}

/**
 * Resets deliverables/lines that show invoiced/locked without a live invoice link.
 * Common after failed invoice create rollback (invoice deleted, deliverables left locked).
 */
export async function repairOrphanedInvoicedOperationalRows(
  supabase: SupabaseClient,
  campaignHeaderId: string
): Promise<{
  repairedDeliverables: number;
  repairedPosts: number;
  repairedLineIds: string[];
}> {
  const { data: lineRows } = await supabase
    .from("campaign_lines")
    .select("id, invoice_id, billing_status, vendor_io_id")
    .eq("campaign_header_id", campaignHeaderId);

  const lineIds = (lineRows ?? []).map((row) => (row as { id: string }).id);
  if (lineIds.length === 0) {
    return { repairedDeliverables: 0, repairedPosts: 0, repairedLineIds: [] };
  }

  const { data: deliverableRows } = await supabase
    .from("assignment_deliverables")
    .select(
      "id, campaign_line_id, billing_status, invoice_line_item_id, locked_at, billable_amount, revenue_before_vat"
    )
    .in("campaign_line_id", lineIds);

  const { data: postRows } = await supabase
    .from("assignment_post_schedule")
    .select(
      "id, campaign_line_id, assignment_deliverable_id, billing_status, invoice_line_item_id, locked_at, billable_amount, revenue_before_vat, invoiced_amount, remaining_amount"
    )
    .in("campaign_line_id", lineIds);

  const deliverables = (deliverableRows ?? []) as DeliverableRow[];
  const posts = (postRows ?? []) as PostRow[];
  const lineItemIds = [
    ...deliverables.map((row) => row.invoice_line_item_id),
    ...posts.map((row) => row.invoice_line_item_id),
  ].filter(Boolean) as string[];

  const activeLineItemIds = await loadActiveInvoiceLineItemIds(supabase, lineItemIds);

  const orphanDeliverableIds = deliverables
    .filter((row) => deliverableNeedsRepair(row, activeLineItemIds))
    .map((row) => row.id);

  const repairedLineIds = new Set<string>();

  if (orphanDeliverableIds.length > 0) {
    for (const deliverableId of orphanDeliverableIds) {
      const row = deliverables.find((entry) => entry.id === deliverableId);
      const billable = Number(row?.billable_amount ?? row?.revenue_before_vat ?? 0);

      const { error } = await supabase
        .from("assignment_deliverables")
        .update({
          billing_status: "ready_to_invoice",
          invoice_line_item_id: null,
          invoiced_amount: 0,
          invoiced_at: null,
          locked_at: null,
          remaining_amount: billable,
        } as never)
        .eq("id", deliverableId);

      if (error) {
        if (process.env.NODE_ENV === "development") {
          devLog("[repair-orphaned-invoice] deliverable reset failed", {
            campaignHeaderId,
            deliverableId,
            message: error.message,
          });
        }
        continue;
      }

      if (row) repairedLineIds.add(row.campaign_line_id);
    }
  }

  const orphanPostIds = posts
    .filter((row) => postScheduleNeedsOrphanRepair(row, activeLineItemIds))
    .map((row) => row.id);

  const repairedDeliverableIds = new Set<string>();

  if (orphanPostIds.length > 0) {
    for (const postId of orphanPostIds) {
      const row = posts.find((entry) => entry.id === postId);
      const billable = Number(row?.billable_amount ?? row?.revenue_before_vat ?? 0);

      const { error } = await supabase
        .from("assignment_post_schedule")
        .update({
          billing_status: "ready_to_invoice",
          invoice_line_item_id: null,
          invoiced_amount: 0,
          invoiced_at: null,
          locked_at: null,
          remaining_amount: billable,
        } as never)
        .eq("id", postId);

      if (error) {
        if (process.env.NODE_ENV === "development") {
          devLog("[repair-orphaned-invoice] post reset failed", {
            campaignHeaderId,
            postId,
            message: error.message,
          });
        }
        continue;
      }

      if (row) {
        repairedLineIds.add(row.campaign_line_id);
        repairedDeliverableIds.add(row.assignment_deliverable_id);
      }
    }
  }

  for (const deliverableId of repairedDeliverableIds) {
    const post = posts.find((entry) => entry.assignment_deliverable_id === deliverableId);
    if (!post) continue;

    try {
      const lineVat = await loadLineVatForDeliverable(supabase, post.campaign_line_id);
      await syncDeliverableRollupFromPosts(supabase, deliverableId, lineVat);
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        devLog("[repair-orphaned-invoice] deliverable rollup sync failed", {
          campaignHeaderId,
          deliverableId,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  const liveLineInvoiceIds = new Set<string>();
  const lineInvoiceIds = (lineRows ?? [])
    .map((row) => (row as { invoice_id: string | null }).invoice_id)
    .filter(Boolean) as string[];

  if (lineInvoiceIds.length > 0) {
    const { data: invoices } = await supabase
      .from("invoices")
      .select("id")
      .in("id", lineInvoiceIds)
      .neq("status", "void");
    for (const row of invoices ?? []) {
      liveLineInvoiceIds.add((row as { id: string }).id);
    }
  }

  for (const line of lineRows ?? []) {
    const row = line as {
      id: string;
      invoice_id: string | null;
      billing_status: string;
      vendor_io_id: string | null;
    };
    const headerInvoiced = ["invoiced", "paid", "partially_paid", "partially_invoiced"].includes(
      row.billing_status
    );
    const orphanLine =
      repairedLineIds.has(row.id) ||
      (headerInvoiced && !row.invoice_id) ||
      (row.invoice_id && !liveLineInvoiceIds.has(row.invoice_id));

    if (!orphanLine) continue;

    repairedLineIds.add(row.id);

    await supabase
      .from("campaign_lines")
      .update({
        invoice_id: null,
        billing_invoiced_at: null,
        revenue_locked: false,
        cost_locked: false,
        vendor_assignment_locked: false,
        vat_locked: false,
        operational_status: "io_generated",
      } as never)
      .eq("id", row.id);

    const billingHint = row.vendor_io_id ? "moved_to_billing" : "approved";
    await syncLineBillingFromDeliverables(supabase, row.id, billingHint);
  }

  const lineIdList = [...repairedLineIds];
  if (lineIdList.length > 0) {
    await syncLineOperationalStatusBatch(supabase, lineIdList);
  }

  if (
    process.env.NODE_ENV === "development" &&
    (orphanDeliverableIds.length > 0 || orphanPostIds.length > 0 || lineIdList.length > 0)
  ) {
    devLog("[repair-orphaned-invoice] repaired", {
      campaignHeaderId,
      deliverables: orphanDeliverableIds.length,
      posts: orphanPostIds.length,
      lines: lineIdList,
    });
  }

  return {
    repairedDeliverables: orphanDeliverableIds.length,
    repairedPosts: orphanPostIds.length,
    repairedLineIds: lineIdList,
  };
}

/**
 * Clears stale pending_regeneration only when assignments are still locked to the invoice
 * (append/relock succeeded but regeneration_status was not activated).
 * Skips legitimate ungenerate where lines were unlocked and invoice_id was cleared.
 */
export async function repairStalePendingRegenerationInvoices(
  supabase: SupabaseClient,
  campaignHeaderId: string
): Promise<{ repairedInvoiceIds: string[] }> {
  const { data: invoiceRows } = await supabase
    .from("invoices")
    .select("id, regeneration_status, subtotal, revenue_before_vat, status")
    .eq("campaign_header_id", campaignHeaderId)
    .eq("regeneration_status", "pending_regeneration")
    .neq("status", "void");

  const repairedInvoiceIds: string[] = [];

  for (const row of invoiceRows ?? []) {
    const invoice = row as {
      id: string;
      subtotal: number | null;
      revenue_before_vat: number | null;
    };
    const revenue = Number(invoice.revenue_before_vat ?? invoice.subtotal ?? 0);
    if (revenue <= 0) continue;

    const { count: lockedLineCount, error: lineCountError } = await supabase
      .from("campaign_lines")
      .select("id", { count: "exact", head: true })
      .eq("invoice_id", invoice.id);

    if (lineCountError || !lockedLineCount || lockedLineCount === 0) continue;

    const { error } = await supabase
      .from("invoices")
      .update({
        regeneration_status: "active",
        is_operational_locked: false,
      } as never)
      .eq("id", invoice.id);

    if (!error) {
      repairedInvoiceIds.push(invoice.id);
    }
  }

  if (process.env.NODE_ENV === "development" && repairedInvoiceIds.length > 0) {
    devLog("[repair-orphaned-invoice] activated pending_regeneration invoices", {
      campaignHeaderId,
      invoiceIds: repairedInvoiceIds,
    });
  }

  return { repairedInvoiceIds };
}

/**
 * Clears invoice-header finance lock on draft invoices incorrectly locked during billing relock.
 * Line/deliverable locks remain; only the register "Locked" flag and ungenerate gate are reset.
 */
export async function repairIncorrectlyFinanceLockedDraftInvoices(
  supabase: SupabaseClient,
  campaignHeaderId: string
): Promise<{ repairedInvoiceIds: string[] }> {
  const { data: invoiceRows, error: loadError } = await supabase
    .from("invoices")
    .select("id")
    .eq("campaign_header_id", campaignHeaderId)
    .eq("status", "draft")
    .eq("is_operational_locked", true)
    .neq("regeneration_status", "pending_regeneration");

  if (loadError || !invoiceRows?.length) {
    return { repairedInvoiceIds: [] };
  }

  const invoiceIds = (invoiceRows ?? []).map((row) => (row as { id: string }).id);
  const { error } = await supabase
    .from("invoices")
    .update({ is_operational_locked: false } as never)
    .in("id", invoiceIds);

  if (process.env.NODE_ENV === "development" && !error && invoiceIds.length > 0) {
    devLog("[repair-orphaned-invoice] cleared draft finance lock flags", {
      campaignHeaderId,
      invoiceIds,
    });
  }

  return { repairedInvoiceIds: error ? [] : invoiceIds };
}

const UNLOCKED_LINE_BILLING = new Set([
  "moved_to_billing",
  "io_generated",
  "partially_invoiced",
  "approved",
]);

/**
 * Repairs invoice headers left `active` after ungenerate unlocked assignments
 * (common when stale line items remained or page-load repair reverted pending_regeneration).
 */
export async function repairDesyncedUngeneratedInvoiceHeaders(
  supabase: SupabaseClient,
  campaignHeaderId: string
): Promise<{ repairedInvoiceIds: string[] }> {
  const { data: invoiceRows } = await supabase
    .from("invoices")
    .select("id, regeneration_status, subtotal, revenue_before_vat, status")
    .or(`campaign_header_id.eq.${campaignHeaderId},campaign_id.eq.${campaignHeaderId}`)
    .eq("regeneration_status", "active")
    .neq("status", "void");

  if (!invoiceRows?.length) {
    return { repairedInvoiceIds: [] };
  }

  const { data: campaignLines } = await supabase
    .from("campaign_lines")
    .select("id, billing_status, invoice_id")
    .eq("campaign_header_id", campaignHeaderId);

  const lines = (campaignLines ?? []) as Array<{
    id: string;
    billing_status: string;
    invoice_id: string | null;
  }>;

  const hasUnlockedReadyLines = lines.some(
    (line) => !line.invoice_id && UNLOCKED_LINE_BILLING.has(line.billing_status)
  );

  if (!hasUnlockedReadyLines) {
    return { repairedInvoiceIds: [] };
  }

  const repairedInvoiceIds: string[] = [];

  for (const row of invoiceRows) {
    const invoice = row as {
      id: string;
      subtotal: number | null;
      revenue_before_vat: number | null;
    };
    const revenue = Number(invoice.revenue_before_vat ?? invoice.subtotal ?? 0);
    if (revenue <= 0) continue;

    const { count: lockedLineCount, error: lineCountError } = await supabase
      .from("campaign_lines")
      .select("id", { count: "exact", head: true })
      .eq("invoice_id", invoice.id);

    if (lineCountError || (lockedLineCount ?? 0) > 0) continue;

    const { error: headerError } = await supabase
      .from("invoices")
      .update({
        regeneration_status: "pending_regeneration",
        is_operational_locked: false,
      } as never)
      .eq("id", invoice.id);

    if (headerError) continue;

    await supabase.from("invoice_line_items").delete().eq("invoice_id", invoice.id);

    repairedInvoiceIds.push(invoice.id);
  }

  if (process.env.NODE_ENV === "development" && repairedInvoiceIds.length > 0) {
    devLog("[repair-orphaned-invoice] desynced ungenerate headers repaired", {
      campaignHeaderId,
      invoiceIds: repairedInvoiceIds,
    });
  }

  return { repairedInvoiceIds };
}

/** Resets billing ops state on assignments that reached billing without Vendor IO. */
export async function repairLinesBillingWithoutVendorIo(
  supabase: SupabaseClient,
  campaignHeaderId: string
): Promise<{ repairedLineIds: string[] }> {
  const { data: lines } = await supabase
    .from("campaign_lines")
    .select("id, billing_status, vendor_io_id, invoice_id")
    .eq("campaign_header_id", campaignHeaderId)
    .is("vendor_io_id", null)
    .in("billing_status", [
      "moved_to_billing",
      "partially_invoiced",
      "invoiced",
      "partially_paid",
    ]);

  const repairedLineIds: string[] = [];

  for (const row of lines ?? []) {
    const line = row as {
      id: string;
      billing_status: string;
      invoice_id: string | null;
    };

    if (line.invoice_id) continue;

    const { data: deliverables } = await supabase
      .from("assignment_deliverables")
      .select("id, invoiced_amount, invoice_line_item_id, billable_amount, revenue_before_vat")
      .eq("campaign_line_id", line.id);

    const hasInvoiceProof = (deliverables ?? []).some((deliverable) => {
      const typed = deliverable as {
        invoiced_amount: number | null;
        invoice_line_item_id: string | null;
      };
      return (
        Boolean(typed.invoice_line_item_id) || Number(typed.invoiced_amount ?? 0) > 0.01
      );
    });
    if (hasInvoiceProof) continue;

    await supabase
      .from("campaign_lines")
      .update({
        billing_status: "approved",
        operational_status: "draft",
        invoice_id: null,
        billing_invoiced_at: null,
        revenue_locked: false,
        cost_locked: false,
        vendor_assignment_locked: false,
        vat_locked: false,
      } as never)
      .eq("id", line.id);

    for (const deliverable of deliverables ?? []) {
      const typed = deliverable as {
        id: string;
        billable_amount: number | null;
        revenue_before_vat: number | null;
      };
      const billable = Number(typed.billable_amount ?? typed.revenue_before_vat ?? 0);
      await supabase
        .from("assignment_deliverables")
        .update({
          billing_status: "ready_to_invoice",
          invoice_line_item_id: null,
          locked_at: null,
          invoiced_at: null,
          invoiced_amount: 0,
          remaining_amount: billable,
        } as never)
        .eq("id", typed.id);
    }

    repairedLineIds.push(line.id);
  }

  if (repairedLineIds.length > 0) {
    await syncLineOperationalStatusBatch(supabase, repairedLineIds);
  }

  if (process.env.NODE_ENV === "development" && repairedLineIds.length > 0) {
    devLog("[repair-orphaned-invoice] reset non-IO billing lines", {
      campaignHeaderId,
      lineIds: repairedLineIds,
    });
  }

  return { repairedLineIds };
}

/** Removes invoice rows linked to assignments that never received Vendor IO. */
export async function repairNonIoInvoiceLineItemsForCampaign(
  supabase: SupabaseClient,
  campaignHeaderId: string
): Promise<{ repairedInvoiceIds: string[] }> {
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id")
    .eq("campaign_header_id", campaignHeaderId)
    .neq("status", "void");

  const { pruneNonIoInvoiceLineItems } = await import(
    "@/lib/billing/invoice-regeneration-selection"
  );

  const repairedInvoiceIds: string[] = [];
  for (const row of invoices ?? []) {
    const invoiceId = (row as { id: string }).id;
    const result = await pruneNonIoInvoiceLineItems(supabase, invoiceId);
    if (result.removedLineIds.length > 0) {
      repairedInvoiceIds.push(invoiceId);
    }
  }

  if (process.env.NODE_ENV === "development" && repairedInvoiceIds.length > 0) {
    devLog("[repair-orphaned-invoice] pruned non-IO invoice rows", {
      campaignHeaderId,
      invoiceIds: repairedInvoiceIds,
    });
  }

  return { repairedInvoiceIds };
}

/**
 * After regenerate with deleted line items, invoice totals may exist while assignments
 * stayed unlocked in the billing queue. Relock when live line items exist on active invoices.
 */
export async function repairActiveInvoiceOperationalRelock(
  supabase: SupabaseClient,
  campaignHeaderId: string
): Promise<{ relockedInvoiceIds: string[] }> {
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, regeneration_status, status")
    .or(`campaign_header_id.eq.${campaignHeaderId},campaign_id.eq.${campaignHeaderId}`)
    .eq("regeneration_status", "active")
    .neq("status", "void");

  const relockedInvoiceIds: string[] = [];

  const { data: campaignLines } = await supabase
    .from("campaign_lines")
    .select("id, revenue, revenue_before_vat")
    .eq("campaign_header_id", campaignHeaderId);

  const campaignLineIds = (campaignLines ?? []).map((row) => (row as { id: string }).id);

  const { data: deliverableRows } = await supabase
    .from("assignment_deliverables")
    .select("id, campaign_line_id, billable_amount, revenue_before_vat")
    .eq("campaign_header_id", campaignHeaderId);

  const deliverables = (deliverableRows ?? []) as Array<{
    id: string;
    campaign_line_id: string;
    billable_amount: number | null;
    revenue_before_vat: number | null;
  }>;

  const {
    resolveExpectedLineBillable,
    sumInvoiceLineRevenueForCampaignLine,
  } = await import("@/lib/billing/invoice-from-deliverables");

  for (const invoice of invoices ?? []) {
    const inv = invoice as { id: string };
    const { data: invoiceLineItems } = await supabase
      .from("invoice_line_items")
      .select("campaign_line_id, revenue_before_vat")
      .eq("invoice_id", inv.id);

    const { count } = await supabase
      .from("invoice_line_items")
      .select("id", { count: "exact", head: true })
      .eq("invoice_id", inv.id);

    const hasCoverageGap = (campaignLines ?? []).some((raw) => {
      const line = raw as {
        id: string;
        revenue?: number | null;
        revenue_before_vat?: number | null;
      };
      const expected = resolveExpectedLineBillable(line, deliverables);
      const invoiced = sumInvoiceLineRevenueForCampaignLine(
        (invoiceLineItems ?? []) as Array<{
          campaign_line_id: string | null;
          revenue_before_vat: number | null;
        }>,
        line.id
      );
      return expected > 0.01 && invoiced < expected - 0.01;
    });

    if (hasCoverageGap) continue;

    const { data: unlockedLines } = await supabase
      .from("campaign_lines")
      .select("id, billing_status, invoice_id, vendor_io_id")
      .eq("campaign_header_id", campaignHeaderId)
      .in("billing_status", ["partially_invoiced", "invoiced", "partially_paid"])
      .is("invoice_id", null)
      .not("vendor_io_id", "is", null);

    const hasUnlockedAssignments = (unlockedLines ?? []).length > 0;
    if (!hasUnlockedAssignments) continue;

    if ((count ?? 0) === 0 && campaignLineIds.length > 0) {
      const { filterIoGatedCampaignLineIds } = await import(
        "@/lib/billing/invoice-regeneration-selection"
      );
      const ioGatedLineIds = await filterIoGatedCampaignLineIds(supabase, campaignLineIds);
      if (ioGatedLineIds.length === 0) continue;

      const { regenerateInvoiceLineItems } = await import(
        "@/lib/billing/invoice-from-deliverables"
      );
      const recreate = await regenerateInvoiceLineItems(supabase, inv.id, campaignHeaderId, {
        lineIds: ioGatedLineIds,
      });
      if (!recreate.error && recreate.updated > 0) {
        relockedInvoiceIds.push(inv.id);
        continue;
      }
    }

    if ((count ?? 0) === 0) continue;

    const { relockInvoiceOperationalScope } = await import(
      "@/lib/billing/invoice-lifecycle-operational"
    );
    const result = await relockInvoiceOperationalScope(supabase, inv.id, {
      billingStatus: "invoiced",
    });
    if (!result.error) {
      relockedInvoiceIds.push(inv.id);
    }
  }

  if (process.env.NODE_ENV === "development" && relockedInvoiceIds.length > 0) {
    devLog("[repair-orphaned-invoice] active invoice operational relock", {
      campaignHeaderId,
      invoiceIds: relockedInvoiceIds,
    });
  }

  return { relockedInvoiceIds };
}

const LINE_INVOICED_STATUSES = new Set([
  "invoiced",
  "partially_invoiced",
  "partially_paid",
  "paid",
]);

/** Only repair-append when the assignment already belongs on an invoice — never auto-invoice new IO lines. */
export function resolveRepairAppendTargetInvoiceId(
  line: Pick<{ invoice_id: string | null; billing_status: string }, "invoice_id" | "billing_status">,
  primaryInvoiceId: string
): string | null {
  if (line.invoice_id) return line.invoice_id;
  if (LINE_INVOICED_STATUSES.has(line.billing_status)) {
    return primaryInvoiceId;
  }
  return null;
}

/**
 * Re-links deliverables to invoice line items and inserts missing rows after a
 * partial append (assignment shows invoiced but INV subtotal did not grow).
 * Must run before repairOrphanedInvoicedOperationalRows.
 */
export async function repairAppendMissingInvoiceLineItems(
  supabase: SupabaseClient,
  campaignHeaderId: string
): Promise<{ repairedDeliverables: number; recalculatedInvoiceIds: string[] }> {
  const { data: header } = await supabase
    .from("campaign_headers")
    .select("client_id")
    .eq("id", campaignHeaderId)
    .maybeSingle();

  const clientId = (header as { client_id: string } | null)?.client_id;

  const { data: invoiceRows } = await supabase
    .from("invoices")
    .select("id, status, regeneration_status, created_at")
    .eq("campaign_header_id", campaignHeaderId)
    .neq("status", "void")
    .neq("regeneration_status", "pending_regeneration")
    .order("created_at", { ascending: true });

  const liveInvoices = (invoiceRows ?? []) as Array<{
    id: string;
    status: string;
    regeneration_status: string | null;
  }>;

  const primaryInvoice =
    liveInvoices.find((inv) => inv.status === "draft") ?? liveInvoices[0] ?? null;

  if (!primaryInvoice) {
    return { repairedDeliverables: 0, recalculatedInvoiceIds: [] };
  }

  const invoiceIds = liveInvoices.map((inv) => inv.id);

  const { data: lineRows } = await supabase
    .from("campaign_lines")
    .select("id, invoice_id, billing_status, revenue, revenue_before_vat")
    .eq("campaign_header_id", campaignHeaderId);

  const linesById = new Map<
    string,
    {
      id: string;
      invoice_id: string | null;
      billing_status: string;
      revenue?: number | null;
      revenue_before_vat?: number | null;
    }
  >();
  for (const row of lineRows ?? []) {
    const typed = row as {
      id: string;
      invoice_id: string | null;
      billing_status: string;
      revenue?: number | null;
      revenue_before_vat?: number | null;
    };
    linesById.set(typed.id, typed);
  }

  const campaignLineIds = [...linesById.keys()];
  const deliverableQuery = supabase
    .from("assignment_deliverables")
    .select(
      "id, campaign_line_id, invoice_line_item_id, locked_at, billing_status, billable_amount, revenue_before_vat, invoiced_amount, remaining_amount"
    );

  const { data: deliverableRows } =
    campaignLineIds.length > 0
      ? await deliverableQuery.in("campaign_line_id", campaignLineIds)
      : await deliverableQuery.eq("campaign_header_id", campaignHeaderId);

  const deliverables = (deliverableRows ?? []) as DeliverableRow[];

  const { data: lineItems } = await supabase
    .from("invoice_line_items")
    .select(
      "id, invoice_id, assignment_deliverable_id, campaign_line_id, revenue_before_vat"
    )
    .in("invoice_id", invoiceIds.length > 0 ? invoiceIds : [primaryInvoice.id]);

  const itemById = new Map<string, InvoiceLineItemRow>();
  const itemByDeliverableId = new Map<string, InvoiceLineItemRow>();

  for (const raw of lineItems ?? []) {
    const item = raw as InvoiceLineItemRow;
    itemById.set(item.id, item);
    if (item.assignment_deliverable_id) {
      itemByDeliverableId.set(item.assignment_deliverable_id, item);
    }
  }

  const { filterIoGatedCampaignLineIds } = await import(
    "@/lib/billing/invoice-regeneration-selection"
  );
  const ioGatedLineIdSet = new Set(
    await filterIoGatedCampaignLineIds(supabase, [...linesById.keys()])
  );

  const now = new Date().toISOString();
  let relinked = 0;
  const toInsertByInvoice = new Map<string, string[]>();

  const queueInsert = (invoiceId: string, deliverableId: string) => {
    const list = toInsertByInvoice.get(invoiceId) ?? [];
    if (!list.includes(deliverableId)) {
      list.push(deliverableId);
      toInsertByInvoice.set(invoiceId, list);
    }
  };

  for (const deliverable of deliverables) {
    const line = linesById.get(deliverable.campaign_line_id);
    if (!line || !ioGatedLineIdSet.has(line.id)) continue;

    const targetInvoiceId = line
      ? resolveRepairAppendTargetInvoiceId(line, primaryInvoice.id)
      : null;

    const itemForDeliverable = itemByDeliverableId.get(deliverable.id);
    if (
      itemForDeliverable &&
      itemForDeliverable.campaign_line_id === deliverable.campaign_line_id
    ) {
      const amount = Number(itemForDeliverable.revenue_before_vat ?? 0);
      const needsRelink =
        deliverable.invoice_line_item_id !== itemForDeliverable.id ||
        !deliverable.locked_at ||
        deliverable.billing_status !== "invoiced" ||
        Number(deliverable.invoiced_amount) <= 0;

      if (needsRelink) {
        await supabase
          .from("assignment_deliverables")
          .update({
            invoice_line_item_id: itemForDeliverable.id,
            locked_at: deliverable.locked_at ?? now,
            invoiced_at: now,
            invoiced_amount: amount,
            remaining_amount: 0,
            billing_status: "invoiced",
          } as never)
          .eq("id", deliverable.id);
        relinked += 1;
      }

      if (line && !line.invoice_id) {
        await supabase
          .from("campaign_lines")
          .update({ invoice_id: itemForDeliverable.invoice_id } as never)
          .eq("id", line.id);
      }
      continue;
    }

    const stalePointer =
      Boolean(deliverable.invoice_line_item_id) &&
      !itemById.has(deliverable.invoice_line_item_id!);
    const lineLooksInvoiced = LINE_INVOICED_STATUSES.has(line?.billing_status ?? "");
    const deliverableLooksInvoiced =
      Boolean(deliverable.locked_at) ||
      INVOICED_DELIVERABLE_STATUSES.has(deliverable.billing_status) ||
      Number(deliverable.invoiced_amount) > 0;

    if (!targetInvoiceId || (!lineLooksInvoiced && !deliverableLooksInvoiced && !stalePointer)) {
      continue;
    }

    queueInsert(targetInvoiceId, deliverable.id);
  }

  const {
    fetchDeliverablesForInvoicing,
    insertPackageAssignmentLineItems,
    lineHasAssignmentDeliverables,
    lockDeliverablesOnInvoice,
    recalculateInvoiceTotals,
    resolveExpectedLineBillable,
    sumInvoiceLineRevenueForCampaignLine,
  } = await import("@/lib/billing/invoice-from-deliverables");

  for (const line of linesById.values()) {
    if (!ioGatedLineIdSet.has(line.id)) continue;

    const targetInvoiceId = resolveRepairAppendTargetInvoiceId(line, primaryInvoice.id);
    if (!targetInvoiceId) continue;

    const expectedBillable = resolveExpectedLineBillable(line, deliverables);
    const invoicedOnTarget = sumInvoiceLineRevenueForCampaignLine(
      [...itemById.values()].filter((item) => item.invoice_id === targetInvoiceId),
      line.id
    );

    if (expectedBillable <= 0.01 || invoicedOnTarget >= expectedBillable - 0.01) {
      continue;
    }

    if (line.invoice_id && invoicedOnTarget < expectedBillable - 0.01) {
      await supabase
        .from("campaign_lines")
        .update({
          invoice_id: null,
          billing_invoiced_at: null,
          revenue_locked: false,
          cost_locked: false,
          vendor_assignment_locked: false,
          vat_locked: false,
          operational_status: "io_generated",
        } as never)
        .eq("id", line.id);
      line.invoice_id = null;
    }

    const lineDeliverables = deliverables.filter((d) => d.campaign_line_id === line.id);
    const hasDeliverableBreakdown = await lineHasAssignmentDeliverables(supabase, [line.id]);
    if (!hasDeliverableBreakdown || lineDeliverables.length === 0) {
      continue;
    }

    for (const deliverable of lineDeliverables) {
      const linkedItem = itemByDeliverableId.get(deliverable.id);
      if (
        linkedItem &&
        linkedItem.invoice_id === targetInvoiceId &&
        linkedItem.campaign_line_id === line.id
      ) {
        continue;
      }
      queueInsert(targetInvoiceId, deliverable.id);
    }
  }

  const {
    resolveClientBillingVatRate,
  } = await import("@/lib/vat/queries");
  const { vatRate } = clientId
    ? await resolveClientBillingVatRate(supabase, clientId)
    : { vatRate: 0 };

  let repairedDeliverables = relinked;
  const recalculatedInvoiceIds: string[] = [];

  for (const line of linesById.values()) {
    if (!ioGatedLineIdSet.has(line.id)) continue;

    const lineDeliverables = deliverables.filter((d) => d.campaign_line_id === line.id);
    const hasDeliverableBreakdown = await lineHasAssignmentDeliverables(supabase, [line.id]);
    if (hasDeliverableBreakdown && lineDeliverables.length > 0) continue;

    const targetInvoiceId = resolveRepairAppendTargetInvoiceId(line, primaryInvoice.id);
    if (!targetInvoiceId) continue;

    const expectedBillable = resolveExpectedLineBillable(line, deliverables);
    const invoicedOnTarget = sumInvoiceLineRevenueForCampaignLine(
      [...itemById.values()].filter((item) => item.invoice_id === targetInvoiceId),
      line.id
    );
    if (expectedBillable <= 0.01 || invoicedOnTarget >= expectedBillable - 0.01) {
      continue;
    }

    const packageInsert = await insertPackageAssignmentLineItems(
      supabase,
      targetInvoiceId,
      campaignHeaderId,
      [line.id],
      { defaultVatRate: vatRate, forRegeneration: true }
    );

    if (!packageInsert.error && packageInsert.inserted > 0) {
      repairedDeliverables += 1;
      recalculatedInvoiceIds.push(targetInvoiceId);
      devLog("[repair-orphaned-invoice] inserted package line item for coverage gap", {
        campaignHeaderId,
        lineId: line.id,
        invoiceId: targetInvoiceId,
        expectedBillable,
        invoicedOnTarget,
      });
    } else if (packageInsert.error) {
      devLog("[repair-orphaned-invoice] package coverage repair failed", {
        campaignHeaderId,
        lineId: line.id,
        invoiceId: targetInvoiceId,
        error: packageInsert.error,
      });
    }
  }

  if (toInsertByInvoice.size === 0) {
    if (repairedDeliverables > 0) {
      for (const invoiceId of [...new Set(recalculatedInvoiceIds)]) {
        await recalculateInvoiceTotals(supabase, invoiceId);
      }
      const { relockInvoiceOperationalScope } = await import(
        "@/lib/billing/invoice-lifecycle-operational"
      );
      for (const invoiceId of [...new Set(recalculatedInvoiceIds)]) {
        await relockInvoiceOperationalScope(supabase, invoiceId, {
          billingStatus: "invoiced",
        });
      }
    }
    return {
      repairedDeliverables,
      recalculatedInvoiceIds: [...new Set(recalculatedInvoiceIds)],
    };
  }

  for (const [invoiceId, deliverableIds] of toInsertByInvoice) {
    for (const deliverableId of deliverableIds) {
      const row = deliverables.find((entry) => entry.id === deliverableId);
      const billable = Number(row?.billable_amount ?? row?.revenue_before_vat ?? 0);

      await supabase
        .from("assignment_deliverables")
        .update({
          invoice_line_item_id: null,
          locked_at: null,
          invoiced_at: null,
          invoiced_amount: 0,
          billing_status: "ready_to_invoice",
          remaining_amount: billable,
        } as never)
        .eq("id", deliverableId);
    }

    const { deliverables: fetched, error: fetchError } = await fetchDeliverablesForInvoicing(
      supabase,
      campaignHeaderId,
      deliverableIds
    );

    if (fetchError || fetched.length === 0) {
      devLog("[repair-orphaned-invoice] append line item repair skipped", {
        campaignHeaderId,
        invoiceId,
        fetchError,
        deliverableIds,
      });
      continue;
    }

    const lockResult = await lockDeliverablesOnInvoice(
      supabase,
      invoiceId,
      campaignHeaderId,
      fetched,
      {
        defaultVatRate: vatRate,
        updateExistingOnTargetInvoice: true,
        forRegeneration: true,
      }
    );

    if (lockResult.error) {
      devLog("[repair-orphaned-invoice] append line item repair failed", {
        campaignHeaderId,
        invoiceId,
        error: lockResult.error,
      });
      continue;
    }

    const recalc = await recalculateInvoiceTotals(supabase, invoiceId);
    if (!recalc.error) {
      recalculatedInvoiceIds.push(invoiceId);
    }

    repairedDeliverables += deliverableIds.length;
  }

  if (repairedDeliverables > 0) {
    const { relockInvoiceOperationalScope } = await import(
      "@/lib/billing/invoice-lifecycle-operational"
    );
    for (const invoiceId of [...new Set(recalculatedInvoiceIds)]) {
      await relockInvoiceOperationalScope(supabase, invoiceId, {
        billingStatus: "invoiced",
      });
    }

    devLog("[repair-orphaned-invoice] repaired campaign invoice line integrity", {
      campaignHeaderId,
      repairedDeliverables,
      recalculatedInvoiceIds,
    });
  }

  const { data: refreshedItems } = await supabase
    .from("invoice_line_items")
    .select("invoice_id, campaign_line_id")
    .in("invoice_id", invoiceIds.length > 0 ? invoiceIds : [primaryInvoice.id]);

  for (const line of linesById.values()) {
    if (!LINE_INVOICED_STATUSES.has(line.billing_status) || line.invoice_id) continue;

    const lineItem = (refreshedItems ?? []).find(
      (raw) => (raw as { campaign_line_id: string | null }).campaign_line_id === line.id
    ) as { invoice_id: string } | undefined;

    if (!lineItem?.invoice_id) continue;

    await supabase
      .from("campaign_lines")
      .update({ invoice_id: lineItem.invoice_id } as never)
      .eq("id", line.id);
  }

  return { repairedDeliverables, recalculatedInvoiceIds };
}
