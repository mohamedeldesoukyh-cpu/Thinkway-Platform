import type { SupabaseClient } from "@supabase/supabase-js";

import { assignmentStatusFromBilling } from "@/features/campaigns/line-assignment";
import { operationalStatusForDb } from "@/lib/campaigns/operational-status-utils";
import { syncLineBillingFromDeliverables } from "@/lib/billing/sync-deliverable-billing";
import { syncLineOperationalStatusBatch } from "@/lib/billing/sync-line-operational-status";
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

  if (scope.postIds.length > 0) {
    const { data: postRows, error: loadError } = await supabase
      .from("assignment_post_schedule")
      .select("id, billable_amount, revenue_before_vat")
      .in("id", scope.postIds);

    if (loadError) {
      return { ...scope, error: loadError.message };
    }

    for (const post of postRows ?? []) {
      const row = post as {
        id: string;
        billable_amount: number | null;
        revenue_before_vat: number | null;
      };
      const billable = Number(row.billable_amount ?? row.revenue_before_vat ?? 0);
      const postPatch: Record<string, unknown> = {
        locked_at: null,
        billing_status: "ready_to_invoice",
        invoiced_amount: 0,
        remaining_amount: billable,
      };

      if (!preserveLineItems) {
        postPatch.invoice_line_item_id = null;
        postPatch.invoiced_at = null;
      }

      const { error } = await supabase
        .from("assignment_post_schedule")
        .update(postPatch)
        .eq("id", row.id);

      if (error) {
        return { ...scope, error: error.message };
      }
    }
  }

  if (scope.deliverableIds.length > 0) {
    const { data: deliverableRows, error: loadError } = await supabase
      .from("assignment_deliverables")
      .select("id, billable_amount, revenue_before_vat")
      .in("id", scope.deliverableIds);

    if (loadError) {
      return { ...scope, error: loadError.message };
    }

    for (const deliverable of deliverableRows ?? []) {
      const row = deliverable as {
        id: string;
        billable_amount: number | null;
        revenue_before_vat: number | null;
      };
      const billable = Number(row.billable_amount ?? row.revenue_before_vat ?? 0);
      const deliverablePatch: Record<string, unknown> = {
        locked_at: null,
        billing_status: "ready_to_invoice",
        invoiced_amount: 0,
        invoiced_at: null,
        remaining_amount: billable,
      };

      if (!preserveLineItems) {
        deliverablePatch.invoice_line_item_id = null;
      }

      const { error } = await supabase
        .from("assignment_deliverables")
        .update(deliverablePatch)
        .eq("id", row.id);

      if (error) {
        return { ...scope, error: error.message };
      }
    }
  }

  for (const lineId of scope.lineIds) {
    await syncLineBillingFromDeliverables(supabase, lineId, "moved_to_billing");

    const { data: lineDeliverables } = await supabase
      .from("assignment_deliverables")
      .select("locked_at")
      .eq("campaign_line_id", lineId);

    const anyLocked = (lineDeliverables ?? []).some((d) => d.locked_at);
    const allLocked =
      (lineDeliverables ?? []).length > 0 &&
      (lineDeliverables ?? []).every((d) => d.locked_at);

    await supabase
      .from("campaign_lines")
      .update({
        revenue_locked: mode === "unpost" ? false : allLocked,
        cost_locked: mode === "unpost" ? false : allLocked,
        vendor_assignment_locked: mode === "unpost" ? false : allLocked,
        vat_locked: mode === "unpost" ? false : anyLocked,
        finance_override_until: overrideUntil,
        invoice_id: null,
        operational_status: "io_generated",
        billing_status: "moved_to_billing",
      } as never)
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

  if (scope.lineItemIds.length > 0) {
    const { data: lineItems } = await supabase
      .from("invoice_line_items")
      .select(
        "id, assignment_post_schedule_id, assignment_deliverable_id, revenue_before_vat, unit_price"
      )
      .in("id", scope.lineItemIds);

    for (const item of lineItems ?? []) {
      const row = item as {
        id: string;
        assignment_post_schedule_id: string | null;
        assignment_deliverable_id: string | null;
        revenue_before_vat: number | null;
        unit_price: number | null;
      };
      const amount = Number(row.revenue_before_vat ?? row.unit_price ?? 0);

      if (row.assignment_post_schedule_id) {
        await supabase
          .from("assignment_post_schedule")
          .update({
            invoice_line_item_id: row.id,
            locked_at: now,
            invoiced_at: now,
            invoiced_amount: amount,
            remaining_amount: 0,
            billing_status: "invoiced",
          })
          .eq("id", row.assignment_post_schedule_id);
      }

      if (row.assignment_deliverable_id) {
        await supabase
          .from("assignment_deliverables")
          .update({
            invoice_line_item_id: row.id,
            locked_at: now,
            invoiced_at: now,
            invoiced_amount: amount,
            remaining_amount: 0,
            billing_status: "invoiced",
          })
          .eq("id", row.assignment_deliverable_id);
      }
    }
  }

  if (scope.lineIds.length > 0) {
    const { error: lineError } = await supabase
      .from("campaign_lines")
      .update({
        ...lineBillingPatch(billingStatus),
        operational_status: operationalStatusForDb("locked"),
        revenue_locked: true,
        cost_locked: true,
        vendor_assignment_locked: true,
        vat_locked: true,
        invoice_id: invoiceId,
        billing_invoiced_at: now,
        finance_override_until: null,
      } as never)
      .in("id", scope.lineIds);

    if (lineError) {
      return { lineIds: scope.lineIds, error: lineError.message };
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
