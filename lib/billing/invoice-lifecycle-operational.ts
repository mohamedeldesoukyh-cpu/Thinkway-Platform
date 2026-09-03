import type { SupabaseClient } from "@supabase/supabase-js";

import { assignmentStatusFromBilling } from "@/lib/campaigns/line-assignment";
import { operationalStatusForDb } from "@/lib/campaigns/operational-status-utils";
import { resolveClientBillableAmount } from "@/lib/billing/client-billable-amount";
import { loadInvoiceCoverageSums, type InvoiceCoverageSums } from "@/lib/billing/invoice-coverage-ledger";
import {
  applyCoverageToLedger,
  buildOperationalCoveragePatch,
} from "@/lib/billing/partial-assignment-invoice";
import { syncLineBillingFromDeliverables } from "@/lib/billing/sync-deliverable-billing";
import { syncLineOperationalStatusBatch } from "@/lib/billing/sync-line-operational-status";
import { shouldApplyLiveAdDateLockOnInvoice } from "@/lib/campaigns/live-ad-date";
import { devLog } from "@/lib/dev-log";

export type InvoiceOperationalUnlockMode = "regeneration" | "void" | "unpost";

function lineBillingPatch(billingStatus: string) {
  const assignmentStatus = assignmentStatusFromBilling(billingStatus);
  return assignmentStatus
    ? { billing_status: billingStatus, assignment_status: assignmentStatus }
    : { billing_status: billingStatus };
}

async function resolveInvoiceScopeIds(
  supabase: SupabaseClient,
  invoiceId: string
): Promise<{
  lineItemIds: string[];
  postIds: string[];
  deliverableIds: string[];
  lineIds: string[];
}> {
  const { data: items } = await supabase
    .from("invoice_line_items")
    .select(
      "id, campaign_line_id, assignment_deliverable_id, assignment_post_schedule_id"
    )
    .eq("invoice_id", invoiceId);

  const lineItemIds = new Set<string>();
  const postIds = new Set<string>();
  const deliverableIds = new Set<string>();
  const lineIds = new Set<string>();

  for (const row of items ?? []) {
    const item = row as {
      id: string;
      campaign_line_id: string | null;
      assignment_deliverable_id: string | null;
      assignment_post_schedule_id: string | null;
    };
    lineItemIds.add(item.id);
    if (item.assignment_post_schedule_id) postIds.add(item.assignment_post_schedule_id);
    if (item.assignment_deliverable_id) deliverableIds.add(item.assignment_deliverable_id);
    if (item.campaign_line_id) lineIds.add(item.campaign_line_id);
  }

  if (lineItemIds.size > 0) {
    const { data: linkedPosts } = await supabase
      .from("assignment_post_schedule")
      .select("id, campaign_line_id")
      .in("invoice_line_item_id", [...lineItemIds]);

    for (const post of linkedPosts ?? []) {
      const row = post as { id: string; campaign_line_id: string };
      postIds.add(row.id);
      lineIds.add(row.campaign_line_id);
    }

    const itemById = new Map(
      (items ?? []).map((row) => {
        const item = row as {
          id: string;
          campaign_line_id: string | null;
          assignment_deliverable_id: string | null;
        };
        return [item.id, item] as const;
      })
    );

    const { data: linkedDeliverables } = await supabase
      .from("assignment_deliverables")
      .select("id, campaign_line_id, invoice_line_item_id")
      .in("invoice_line_item_id", [...lineItemIds]);

    for (const deliverable of linkedDeliverables ?? []) {
      const row = deliverable as {
        id: string;
        campaign_line_id: string;
        invoice_line_item_id: string | null;
      };
      const item = row.invoice_line_item_id
        ? itemById.get(row.invoice_line_item_id)
        : undefined;
      if (!item) continue;
      if (item.assignment_deliverable_id && item.assignment_deliverable_id !== row.id) {
        continue;
      }
      if (item.campaign_line_id && item.campaign_line_id !== row.campaign_line_id) {
        continue;
      }
      deliverableIds.add(row.id);
      lineIds.add(row.campaign_line_id);
    }
  }

  return {
    lineItemIds: [...lineItemIds],
    postIds: [...postIds],
    deliverableIds: [...deliverableIds],
    lineIds: [...lineIds],
  };
}

async function applyCoverageToOperationalScope(
  supabase: SupabaseClient,
  scope: {
    postIds: string[];
    deliverableIds: string[];
    lineIds: string[];
    lineItemIds: string[];
  },
  options: {
    excludeInvoiceId?: string;
    now: string;
    lineItemIdByPost?: Map<string, string>;
    lineItemIdByDeliverable?: Map<string, string>;
  }
): Promise<{ error?: string; sums: InvoiceCoverageSums }> {
  const { sums, error } = await loadInvoiceCoverageSums(
    supabase,
    {
      postIds: scope.postIds,
      deliverableIds: scope.deliverableIds,
      lineIds: scope.lineIds,
    },
    { excludeInvoiceId: options.excludeInvoiceId }
  );
  if (error) return { error, sums };

  if (scope.postIds.length > 0) {
    const { data: postRows, error: loadError } = await supabase
      .from("assignment_post_schedule")
      .select("id, live_date, billable_amount, revenue_before_vat, invoice_line_item_id")
      .in("id", scope.postIds);
    if (loadError) return { error: loadError.message, sums };

    for (const post of postRows ?? []) {
      const row = post as {
        id: string;
        live_date: string | null;
        billable_amount: number | null;
        revenue_before_vat: number | null;
        invoice_line_item_id: string | null;
      };
      const billable = resolveClientBillableAmount({
        revenue_before_vat: row.revenue_before_vat,
        billable_amount: row.billable_amount,
      });
      const invoicedCoverage = sums.posts.get(row.id) ?? 0;
      const lineItemId =
        options.lineItemIdByPost?.get(row.id) ??
        (invoicedCoverage > 0 ? row.invoice_line_item_id : null);
      const patch = buildOperationalCoveragePatch({
        billable,
        invoicedCoverage,
        lineItemId,
        now: options.now,
        lockLiveDate:
          applyCoverageToLedger({ billable, invoicedCoverage }).shouldLock &&
          shouldApplyLiveAdDateLockOnInvoice(row.live_date),
      });
      const { error: updateError } = await supabase
        .from("assignment_post_schedule")
        .update(patch)
        .eq("id", row.id);
      if (updateError) return { error: updateError.message, sums };
    }
  }

  if (scope.deliverableIds.length > 0) {
    const { data: deliverableRows, error: loadError } = await supabase
      .from("assignment_deliverables")
      .select(
        "id, live_date, billable_amount, revenue_before_vat, usage_rights_amount, agency_fee_amount, agency_fee_percent, invoice_line_item_id"
      )
      .in("id", scope.deliverableIds);
    if (loadError) return { error: loadError.message, sums };

    for (const deliverable of deliverableRows ?? []) {
      const row = deliverable as {
        id: string;
        live_date: string | null;
        billable_amount: number | null;
        revenue_before_vat: number | null;
        usage_rights_amount?: number | null;
        agency_fee_amount?: number | null;
        agency_fee_percent?: number | null;
        invoice_line_item_id: string | null;
      };
      const billable = resolveClientBillableAmount({
        revenue_before_vat: row.revenue_before_vat,
        usage_rights_amount: row.usage_rights_amount,
        agency_fee_amount: row.agency_fee_amount,
        agency_fee_percent: row.agency_fee_percent,
        billable_amount: row.billable_amount,
      });
      const invoicedCoverage = sums.deliverables.get(row.id) ?? 0;
      const lineItemId =
        options.lineItemIdByDeliverable?.get(row.id) ??
        (invoicedCoverage > 0 ? row.invoice_line_item_id : null);
      const coverage = applyCoverageToLedger({ billable, invoicedCoverage });
      const patch = buildOperationalCoveragePatch({
        billable,
        invoicedCoverage,
        lineItemId,
        now: options.now,
        lockLiveDate: coverage.shouldLock && shouldApplyLiveAdDateLockOnInvoice(row.live_date),
      });
      const { error: updateError } = await supabase
        .from("assignment_deliverables")
        .update(patch)
        .eq("id", row.id);
      if (updateError) return { error: updateError.message, sums };
    }
  }

  return { sums };
}

/**
 * PR2: Single unlock path — posts, deliverables, assignments transition together.
 * Invoice line items are preserved for regeneration (commercial correction on same invoice).
 */
export async function unlockInvoiceOperationalScope(
  supabase: SupabaseClient,
  invoiceId: string,
  options?: {
    mode?: InvoiceOperationalUnlockMode;
    financeOverrideHours?: number;
    preserveLineItems?: boolean;
  }
): Promise<{
  lineIds: string[];
  postIds: string[];
  deliverableIds: string[];
  lineItemIds: string[];
  error?: string;
}> {
  const mode = options?.mode ?? "regeneration";
  const preserveLineItems = options?.preserveLineItems ?? mode === "regeneration";
  const overrideHours = options?.financeOverrideHours ?? 72;
  const overrideUntil = new Date(Date.now() + overrideHours * 3600000).toISOString();
  const scope = await resolveInvoiceScopeIds(supabase, invoiceId);

  const coverage = await applyCoverageToOperationalScope(supabase, scope, {
    excludeInvoiceId: invoiceId,
    now: new Date().toISOString(),
  });
  if (coverage.error) {
    return { ...scope, error: coverage.error };
  }

  for (const lineId of scope.lineIds) {
    await syncLineBillingFromDeliverables(supabase, lineId, "moved_to_billing");

    const { data: lineDeliverables } = await supabase
      .from("assignment_deliverables")
      .select("locked_at, remaining_amount, invoiced_amount")
      .eq("campaign_line_id", lineId);

    const remaining = (lineDeliverables ?? []).reduce(
      (sum, row) => sum + Number((row as { remaining_amount?: number | null }).remaining_amount ?? 0),
      0
    );
    const invoiced = (lineDeliverables ?? []).reduce(
      (sum, row) => sum + Number((row as { invoiced_amount?: number | null }).invoiced_amount ?? 0),
      0
    );
    const anyLocked = (lineDeliverables ?? []).some((d) => d.locked_at);
    const allLocked =
      (lineDeliverables ?? []).length > 0 &&
      (lineDeliverables ?? []).every((d) => d.locked_at);
    const stillPartial = invoiced > 0.01 && remaining > 0.01;

    const linePatch: Record<string, unknown> = {
        revenue_locked: mode === "unpost" ? false : allLocked,
        cost_locked: mode === "unpost" ? false : allLocked,
        vendor_assignment_locked: mode === "unpost" ? false : allLocked,
        vat_locked: mode === "unpost" ? false : anyLocked,
        finance_override_until: overrideUntil,
        operational_status: stillPartial ? "partially_invoiced" : "io_generated",
        billing_status: stillPartial ? "partially_invoiced" : "moved_to_billing",
      };
    if (!stillPartial) {
      linePatch.invoice_id = null;
    }

    await supabase
      .from("campaign_lines")
      .update(linePatch as never)
      .eq("id", lineId);
  }

  if (scope.lineIds.length > 0) {
    await syncLineOperationalStatusBatch(supabase, scope.lineIds);
  }

  if (!preserveLineItems && scope.lineItemIds.length > 0) {
    await supabase.from("invoice_line_items").delete().eq("invoice_id", invoiceId);
  }

  await supabase
    .from("invoices")
    .update({ is_operational_locked: false } as never)
    .eq("id", invoiceId);

  if (process.env.NODE_ENV === "development") {
    devLog("[invoice-lifecycle-operational] unlock", {
      invoiceId,
      mode,
      preserveLineItems,
      ...scope,
    });
  }

  return scope;
}

/**
 * PR2: Single relock path after create/append/regenerate.
 */
export async function relockInvoiceOperationalScope(
  supabase: SupabaseClient,
  invoiceId: string,
  options?: { billingStatus?: string }
): Promise<{ lineIds: string[]; error?: string }> {
  const scope = await resolveInvoiceScopeIds(supabase, invoiceId);
  const billingStatus = options?.billingStatus ?? "invoiced";
  const now = new Date().toISOString();

  const { data: lineItems } = scope.lineItemIds.length
    ? await supabase
        .from("invoice_line_items")
        .select("id, assignment_post_schedule_id, assignment_deliverable_id")
        .in("id", scope.lineItemIds)
    : { data: [] as Array<{ id: string }> };

  const lineItemIdByPost = new Map<string, string>();
  const lineItemIdByDeliverable = new Map<string, string>();
  for (const item of lineItems ?? []) {
    const row = item as {
      id: string;
      assignment_post_schedule_id: string | null;
      assignment_deliverable_id: string | null;
    };
    if (row.assignment_post_schedule_id) {
      lineItemIdByPost.set(row.assignment_post_schedule_id, row.id);
    }
    if (row.assignment_deliverable_id && !row.assignment_post_schedule_id) {
      lineItemIdByDeliverable.set(row.assignment_deliverable_id, row.id);
    }
  }

  const coverage = await applyCoverageToOperationalScope(supabase, scope, {
    now,
    lineItemIdByPost,
    lineItemIdByDeliverable,
  });
  if (coverage.error) {
    return { lineIds: scope.lineIds, error: coverage.error };
  }

  if (scope.lineIds.length > 0) {
    for (const lineId of scope.lineIds) {
      await syncLineBillingFromDeliverables(supabase, lineId, "moved_to_billing");
    }

    const { data: lines } = await supabase
      .from("campaign_lines")
      .select(
        "id, revenue, revenue_before_vat, usage_rights_amount, agency_fee_amount, agency_fee_percent"
      )
      .in("id", scope.lineIds);

    for (const line of lines ?? []) {
      const lineId = (line as { id: string }).id;
      const billable = resolveClientBillableAmount(line as never);
      const { data: deliverables } = await supabase
        .from("assignment_deliverables")
        .select("id, remaining_amount, invoiced_amount, locked_at")
        .eq("campaign_line_id", lineId);

      let invoiced = coverage.sums.lines.get(lineId) ?? 0;
      for (const row of deliverables ?? []) {
        const deliverableId = (row as { id?: string }).id;
        if (deliverableId) {
          invoiced += coverage.sums.deliverables.get(deliverableId) ?? 0;
        }
      }
      invoiced = Math.round(invoiced * 100) / 100;
      if (invoiced <= 0.01) {
        invoiced = (deliverables ?? []).reduce(
          (sum, row) =>
            sum + Number((row as { invoiced_amount?: number | null }).invoiced_amount ?? 0),
          0
        );
      }
      let remaining = Math.max(0, billable - invoiced);
      if ((deliverables ?? []).length > 0 && invoiced <= 0.01) {
        remaining = (deliverables ?? []).reduce(
          (sum, row) =>
            sum + Number((row as { remaining_amount?: number | null }).remaining_amount ?? 0),
          0
        );
      }
      const fullyInvoiced = remaining <= 0.01 && invoiced > 0.01;
      const nextBilling = fullyInvoiced
        ? billingStatus
        : invoiced > 0.01
          ? "partially_invoiced"
          : "moved_to_billing";
      const { error: lineError } = await supabase
        .from("campaign_lines")
        .update({
          ...lineBillingPatch(nextBilling),
          operational_status: operationalStatusForDb(
            fullyInvoiced ? "locked" : invoiced > 0.01 ? "partially_invoiced" : "io_generated"
          ),
          revenue_locked: fullyInvoiced,
          cost_locked: fullyInvoiced,
          vendor_assignment_locked: fullyInvoiced,
          vat_locked: fullyInvoiced,
          invoice_id: invoiceId,
          billing_invoiced_at: fullyInvoiced ? now : null,
          finance_override_until: null,
        } as never)
        .eq("id", lineId);

      if (lineError) {
        return { lineIds: scope.lineIds, error: lineError.message };
      }
    }

    await syncLineOperationalStatusBatch(supabase, scope.lineIds);
  }

  if (scope.lineItemIds.length > 0 || scope.lineIds.length > 0) {
    const { error: invoiceError } = await supabase
      .from("invoices")
      .update({ regeneration_status: "active" } as never)
      .eq("id", invoiceId);

    if (invoiceError) {
      return { lineIds: scope.lineIds, error: invoiceError.message };
    }
  }

  if (process.env.NODE_ENV === "development") {
    devLog("[invoice-lifecycle-operational] relock", {
      invoiceId,
      billingStatus,
      lineIds: scope.lineIds,
    });
  }

  return { lineIds: scope.lineIds };
}
