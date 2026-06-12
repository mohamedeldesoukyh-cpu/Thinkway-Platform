import type { SupabaseClient } from "@supabase/supabase-js";

import {
  loadLineVatForDeliverable,
  syncDeliverableRollupFromPosts,
} from "@/lib/assignments/sync-post-schedules";
import {
  allocateAmountByRevenueShare,
  resolveClientBillableAmount,
  resolveClientRemainingAmount,
} from "@/lib/billing/client-billable-amount";
import { recalculateInvoiceTotals } from "@/lib/billing/invoice-from-deliverables";
import { loadActiveInvoiceLineItemIds } from "@/lib/billing/invoice-validation-context";
import {
  repairAppendMissingInvoiceLineItems,
  repairIncorrectlyFinanceLockedDraftInvoices,
  repairOrphanedInvoicedOperationalRows,
  repairStalePendingRegenerationInvoices,
} from "@/lib/billing/repair-orphaned-invoice-state";
import { devLog } from "@/lib/dev-log";

type DeliverableCommercialRow = {
  id: string;
  campaign_line_id: string;
  revenue_before_vat: number | null;
  usage_rights_amount?: number | null;
  agency_fee_amount?: number | null;
  agency_fee_percent?: number | null;
  billable_amount: number | null;
  invoiced_amount?: number | null;
  remaining_amount?: number | null;
  locked_at?: string | null;
};

type PostBillingRow = {
  id: string;
  campaign_line_id: string;
  assignment_deliverable_id: string;
  sequence_number: number;
  revenue_before_vat: number | null;
  billable_amount: number | null;
  invoiced_amount: number | null;
  remaining_amount: number | null;
  billing_status: string;
  invoice_line_item_id: string | null;
  locked_at: string | null;
};

type LineItemRow = {
  id: string;
  invoice_id: string;
  assignment_post_schedule_id: string | null;
  revenue_before_vat: number;
};

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function resolveDeliverableBillable(row: DeliverableCommercialRow): number {
  return resolveClientBillableAmount({
    revenue_before_vat: Number(row.revenue_before_vat ?? 0),
    usage_rights_amount: Number(row.usage_rights_amount ?? 0),
    agency_fee_amount: row.agency_fee_amount,
    agency_fee_percent: Number(row.agency_fee_percent ?? 0),
    billable_amount: Number(row.billable_amount ?? 0),
  });
}

function resolveSyncedPostBillable(
  post: PostBillingRow,
  share: number
): number {
  return roundMoney(
    Math.max(
      share,
      Number(post.billable_amount ?? 0),
      Number(post.revenue_before_vat ?? 0)
    )
  );
}

function resolveSyncedPostRemaining(
  post: PostBillingRow,
  billable: number,
  activeLineItemIds: Set<string>
): number {
  const linkedLive =
    Boolean(post.invoice_line_item_id) &&
    activeLineItemIds.has(post.invoice_line_item_id!);

  if (linkedLive) {
    const invoiced = Number(post.invoiced_amount ?? 0);
    return roundMoney(Math.max(0, billable - invoiced));
  }

  return resolveClientRemainingAmount({
    revenue_before_vat: Number(post.revenue_before_vat ?? 0),
    billable_amount: billable,
    invoiced_amount: Number(post.invoiced_amount ?? 0),
    remaining_amount: Number(post.remaining_amount ?? 0),
    locked_at: post.locked_at,
  });
}

/** Recompute post billable/remaining from deliverable client commercial before invoice create. */
export async function syncCampaignPostBillableForInvoice(
  supabase: SupabaseClient,
  campaignHeaderId: string
): Promise<{ syncedPosts: number }> {
  const { data: lineRows } = await supabase
    .from("campaign_lines")
    .select("id")
    .eq("campaign_header_id", campaignHeaderId);

  const lineIds = (lineRows ?? []).map((row) => (row as { id: string }).id);
  if (lineIds.length === 0) {
    return { syncedPosts: 0 };
  }

  const { data: deliverableRows } = await supabase
    .from("assignment_deliverables")
    .select(
      "id, campaign_line_id, revenue_before_vat, usage_rights_amount, agency_fee_amount, agency_fee_percent, billable_amount, invoiced_amount, remaining_amount, locked_at"
    )
    .in("campaign_line_id", lineIds);

  const deliverables = (deliverableRows ?? []) as DeliverableCommercialRow[];
  if (deliverables.length === 0) {
    return { syncedPosts: 0 };
  }

  const deliverableIds = deliverables.map((row) => row.id);
  const { data: postRows } = await supabase
    .from("assignment_post_schedule")
    .select(
      "id, campaign_line_id, assignment_deliverable_id, sequence_number, revenue_before_vat, billable_amount, invoiced_amount, remaining_amount, billing_status, invoice_line_item_id, locked_at"
    )
    .in("assignment_deliverable_id", deliverableIds)
    .order("sequence_number");

  const posts = (postRows ?? []) as PostBillingRow[];
  if (posts.length === 0) {
    return { syncedPosts: 0 };
  }

  const lineItemIds = posts
    .map((row) => row.invoice_line_item_id)
    .filter(Boolean) as string[];
  const activeLineItemIds = await loadActiveInvoiceLineItemIds(supabase, lineItemIds);

  const postsByDeliverable = new Map<string, PostBillingRow[]>();
  for (const post of posts) {
    const list = postsByDeliverable.get(post.assignment_deliverable_id) ?? [];
    list.push(post);
    postsByDeliverable.set(post.assignment_deliverable_id, list);
  }

  let syncedPosts = 0;

  for (const deliverable of deliverables) {
    const deliverablePosts = postsByDeliverable.get(deliverable.id) ?? [];
    if (deliverablePosts.length === 0) continue;

    const deliverableBillable = resolveDeliverableBillable(deliverable);
    const shares = allocateAmountByRevenueShare(
      deliverableBillable,
      deliverablePosts.map((post) => ({
        id: post.id,
        revenue_before_vat: post.revenue_before_vat,
      }))
    );

    for (const post of deliverablePosts) {
      const billable = resolveSyncedPostBillable(
        post,
        shares.get(post.id) ?? 0
      );
      const remaining = resolveSyncedPostRemaining(post, billable, activeLineItemIds);
      const invoiced = roundMoney(Math.max(0, billable - remaining));
      const linkedLive =
        Boolean(post.invoice_line_item_id) &&
        activeLineItemIds.has(post.invoice_line_item_id!);

      const billing_status =
        remaining <= 0.01 && linkedLive
          ? "invoiced"
          : invoiced > 0.01 && remaining > 0.01
            ? "partially_invoiced"
            : remaining > 0.01
              ? "ready_to_invoice"
              : post.billing_status;

      const needsSync =
        roundMoney(Number(post.billable_amount ?? 0)) !== billable ||
        roundMoney(Number(post.remaining_amount ?? 0)) !== remaining ||
        roundMoney(Number(post.invoiced_amount ?? 0)) !== invoiced;

      if (!needsSync) continue;

      const { error } = await supabase
        .from("assignment_post_schedule")
        .update({
          billable_amount: billable,
          invoiced_amount: invoiced,
          remaining_amount: remaining,
          billing_status,
        } as never)
        .eq("id", post.id);

      if (!error) {
        syncedPosts += 1;
        post.billable_amount = billable;
        post.invoiced_amount = invoiced;
        post.remaining_amount = remaining;
        post.billing_status = billing_status;
      }
    }

    try {
      const lineVat = await loadLineVatForDeliverable(
        supabase,
        deliverable.campaign_line_id
      );
      await syncDeliverableRollupFromPosts(supabase, deliverable.id, lineVat);
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        devLog("[repair-invoice-create] deliverable rollup sync failed", {
          campaignHeaderId,
          deliverableId: deliverable.id,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  return { syncedPosts };
}

/**
 * Unlinks posts still billable but tied to draft invoice line items (UI shows uninvoiced, server blocked).
 */
export async function repairStaleLiveDraftInvoicePostLinks(
  supabase: SupabaseClient,
  campaignHeaderId: string
): Promise<{
  unlinkedPosts: number;
  removedLineItems: number;
  voidedDraftInvoices: number;
}> {
  const { data: draftInvoices } = await supabase
    .from("invoices")
    .select("id, document_number, status, amount_paid, total, subtotal")
    .eq("campaign_header_id", campaignHeaderId)
    .eq("status", "draft")
    .neq("regeneration_status", "pending_regeneration");

  const draftInvoiceIds = new Set(
    (draftInvoices ?? []).map((row) => (row as { id: string }).id)
  );

  const { data: lineRows } = await supabase
    .from("campaign_lines")
    .select("id")
    .eq("campaign_header_id", campaignHeaderId);

  const lineIds = (lineRows ?? []).map((row) => (row as { id: string }).id);
  if (lineIds.length === 0) {
    return { unlinkedPosts: 0, removedLineItems: 0, voidedDraftInvoices: 0 };
  }

  const { data: postRows } = await supabase
    .from("assignment_post_schedule")
    .select(
      "id, campaign_line_id, assignment_deliverable_id, sequence_number, revenue_before_vat, billable_amount, invoiced_amount, remaining_amount, billing_status, invoice_line_item_id, locked_at"
    )
    .in("campaign_line_id", lineIds);

  const posts = (postRows ?? []) as PostBillingRow[];
  const lineItemIds = posts
    .map((row) => row.invoice_line_item_id)
    .filter(Boolean) as string[];

  if (lineItemIds.length === 0) {
    return { unlinkedPosts: 0, removedLineItems: 0, voidedDraftInvoices: 0 };
  }

  const activeLineItemIds = await loadActiveInvoiceLineItemIds(supabase, lineItemIds);
  const { data: lineItems } = await supabase
    .from("invoice_line_items")
    .select("id, invoice_id, assignment_post_schedule_id, revenue_before_vat")
    .in("id", lineItemIds);

  const lineItemById = new Map(
    (lineItems ?? []).map((row) => {
      const item = row as LineItemRow;
      return [item.id, item] as const;
    })
  );

  let unlinkedPosts = 0;
  let removedLineItems = 0;
  const touchedInvoiceIds = new Set<string>();
  const repairedDeliverableIds = new Set<string>();

  for (const post of posts) {
    if (!post.invoice_line_item_id || !activeLineItemIds.has(post.invoice_line_item_id)) {
      continue;
    }

    const lineItem = lineItemById.get(post.invoice_line_item_id);
    if (!lineItem || !draftInvoiceIds.has(lineItem.invoice_id)) {
      continue;
    }

    const billable = resolveClientBillableAmount({
      revenue_before_vat: Number(post.revenue_before_vat ?? 0),
      billable_amount: Number(post.billable_amount ?? 0),
    });
    const lineItemAmount = Number(lineItem.revenue_before_vat ?? 0);
    const invoiced = Number(post.invoiced_amount ?? 0);
    const remaining = roundMoney(
      Math.max(
        Number(post.remaining_amount ?? 0),
        Math.max(0, billable - Math.max(invoiced, lineItemAmount))
      )
    );

    const staleLiveDraftLink =
      remaining > 0.01 ||
      (billable > lineItemAmount + 0.01 && remaining > 0.01) ||
      (billable > 0.01 && lineItemAmount <= 0.01);

    if (!staleLiveDraftLink) {
      continue;
    }

    const nextBillingStatus =
      invoiced > 0.01 && remaining > 0.01
        ? "partially_invoiced"
        : "ready_to_invoice";

    const { error: postError } = await supabase
      .from("assignment_post_schedule")
      .update({
        invoice_line_item_id: null,
        locked_at: null,
        invoiced_at: null,
        billable_amount: billable,
        invoiced_amount: invoiced,
        remaining_amount: remaining,
        billing_status: nextBillingStatus,
      } as never)
      .eq("id", post.id);

    if (postError) continue;

    unlinkedPosts += 1;
    repairedDeliverableIds.add(post.assignment_deliverable_id);
    touchedInvoiceIds.add(lineItem.invoice_id);

    const { error: deleteError } = await supabase
      .from("invoice_line_items")
      .delete()
      .eq("id", lineItem.id);

    if (!deleteError) {
      removedLineItems += 1;
      lineItemById.delete(lineItem.id);
    }
  }

  for (const deliverableId of repairedDeliverableIds) {
    const post = posts.find((row) => row.assignment_deliverable_id === deliverableId);
    if (!post) continue;
    try {
      const lineVat = await loadLineVatForDeliverable(supabase, post.campaign_line_id);
      await syncDeliverableRollupFromPosts(supabase, deliverableId, lineVat);
    } catch {
      // rollup best-effort
    }
  }

  let voidedDraftInvoices = 0;

  for (const invoiceId of touchedInvoiceIds) {
    await recalculateInvoiceTotals(supabase, invoiceId);

    const { count } = await supabase
      .from("invoice_line_items")
      .select("id", { count: "exact", head: true })
      .eq("invoice_id", invoiceId);

    if ((count ?? 0) > 0) continue;

    const draft = (draftInvoices ?? []).find(
      (row) => (row as { id: string }).id === invoiceId
    ) as { amount_paid?: number | null; total?: number | null; subtotal?: number | null } | undefined;

    const collected = Number(draft?.amount_paid ?? 0);
    const total = Number(draft?.total ?? draft?.subtotal ?? 0);
    if (collected > 0.01 || total > 0.01) continue;

    const { error } = await supabase
      .from("invoices")
      .update({ status: "void" } as never)
      .eq("id", invoiceId);

    if (!error) {
      voidedDraftInvoices += 1;
    }
  }

  if (
    process.env.NODE_ENV === "development" &&
    (unlinkedPosts > 0 || removedLineItems > 0 || voidedDraftInvoices > 0)
  ) {
    devLog("[repair-invoice-create] cleared stale live draft post links", {
      campaignHeaderId,
      unlinkedPosts,
      removedLineItems,
      voidedDraftInvoices,
    });
  }

  return { unlinkedPosts, removedLineItems, voidedDraftInvoices };
}

/** Full repair pipeline invoked immediately before invoice create validation. */
export async function runPreInvoiceCreateRepairPipeline(
  supabase: SupabaseClient,
  campaignHeaderId: string
): Promise<void> {
  await repairOrphanedInvoicedOperationalRows(supabase, campaignHeaderId);
  await syncCampaignPostBillableForInvoice(supabase, campaignHeaderId);
  await repairStaleLiveDraftInvoicePostLinks(supabase, campaignHeaderId);
  await repairStalePendingRegenerationInvoices(supabase, campaignHeaderId);
  await repairIncorrectlyFinanceLockedDraftInvoices(supabase, campaignHeaderId);
  await repairAppendMissingInvoiceLineItems(supabase, campaignHeaderId);
}
