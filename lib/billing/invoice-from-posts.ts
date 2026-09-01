import type { SupabaseClient } from "@supabase/supabase-js";

import { assignmentStatusFromBilling, platformLabel } from "@/lib/campaigns/line-assignment";
import {
  assignmentDeliverableBillingSelect,
  resolveDeliverableVatExempt,
} from "@/lib/billing/assignment-deliverable-queries";
import {
  deliverableDisplayLabel,
  deriveLineBillingStatusFromDeliverables,
  type DeliverableBillingRow,
  shouldLockLineFully,
} from "@/lib/billing/deliverable-billing";
import { resolveClientBillableAmount } from "@/lib/billing/client-billable-amount";
import {
  recalculateInvoiceTotals,
  resolveInvoiceLineVatPercent,
} from "@/lib/billing/invoice-from-deliverables";
import { syncLineBillingFromDeliverables } from "@/lib/billing/sync-deliverable-billing";
import { syncLineOperationalStatus } from "@/lib/billing/sync-line-operational-status";
import { operationalStatusForDb } from "@/lib/campaigns/operational-status-utils";
import {
  buildOperationalCoveragePatch,
  resolveInvoiceSlice,
} from "@/lib/billing/partial-assignment-invoice";
import {
  blocksNewInvoiceOperationalRow,
  invoicedRowAllowed,
  invoicedRowBlockMessage,
  isInvoicedOperationalRow,
  isLinkedToLiveInvoiceLineItem,
  loadActiveInvoiceLineItemIds,
  resolveLinkedInvoiceIds,
  resolveOperationalRemainingForInvoice,
  type InvoiceValidationContext,
} from "@/lib/billing/invoice-validation-context";
import type { InvoiceLineItemOpSummary } from "@/lib/billing/invoice-lifecycle-debug";
import { devLog } from "@/lib/dev-log";

export type PostInvoiceLine = {
  id: string;
  campaign_line_id: string;
  assignment_deliverable_id: string;
  sequence_number: number;
  live_date: string | null;
  billable_amount: number;
  invoiced_amount: number;
  remaining_amount: number;
  revenue_before_vat: number;
  billing_status: string;
  locked_at: string | null;
  invoice_line_item_id: string | null;
  linked_invoice_id?: string | null;
  assignment_deliverable: {
    id: string;
    platform: string;
    deliverable_type: string;
    revenue_before_vat: number;
    usage_rights_amount?: number | null;
    agency_fee_amount?: number | null;
    agency_fee_percent?: number | null;
    billable_amount: number;
    revenue_vat_percent: number | null;
    revenue_vat_exempt: boolean | null;
    campaign_line: {
      id: string;
      document_number: string;
      name: string;
      billing_status: string;
      invoice_id: string | null;
      campaign_header_id: string;
      revenue: number;
      revenue_before_vat: number;
      usage_rights_amount?: number | null;
      agency_fee_amount?: number | null;
      agency_fee_percent?: number | null;
      revenue_vat_percent: number | null;
      revenue_vat_exempt: boolean | null;
    } | null;
  } | null;
};

function lineBillingPatch(billingStatus: string) {
  const assignmentStatus = assignmentStatusFromBilling(billingStatus);
  return assignmentStatus
    ? { billing_status: billingStatus, assignment_status: assignmentStatus }
    : { billing_status: billingStatus };
}

function postDisplayLabel(platform: string, deliverableType: string, sequence: number): string {
  return `${platformLabel(platform)} ${deliverableType} #${sequence}`;
}

function postInvoiceBeforeVat(
  post: PostInvoiceLine,
  options?: { updatingExisting?: boolean; forRegeneration?: boolean }
): number {
  const remaining = Number(post.remaining_amount ?? 0);
  const revenueBeforeVat = Number(post.revenue_before_vat ?? 0);
  const billable = Number(post.billable_amount ?? 0);
  const invoiced = Number(post.invoiced_amount ?? 0);
  const deliverable = post.assignment_deliverable;
  const deliverableRevenue = Number(deliverable?.revenue_before_vat ?? 0);
  const deliverableBillable = deliverable
    ? resolveClientBillableAmount({
        revenue_before_vat: deliverableRevenue,
        usage_rights_amount: Number(deliverable.usage_rights_amount ?? 0),
        agency_fee_amount: deliverable.agency_fee_amount,
        agency_fee_percent: Number(deliverable.agency_fee_percent ?? 0),
        billable_amount: Number(deliverable.billable_amount ?? 0),
      })
    : 0;
  const line = deliverable?.campaign_line;
  const lineBillable = line
    ? resolveClientBillableAmount({
        revenue_before_vat: Number(line.revenue_before_vat ?? line.revenue ?? 0),
        usage_rights_amount: Number(line.usage_rights_amount ?? 0),
        agency_fee_amount: line.agency_fee_amount,
        agency_fee_percent: Number(line.agency_fee_percent ?? 0),
      })
    : 0;

  const commercialFallback = Math.max(
    revenueBeforeVat,
    billable,
    invoiced,
    deliverableRevenue,
    deliverableBillable,
    lineBillable
  );

  if (options?.forRegeneration) {
    return Math.max(remaining, commercialFallback);
  }

  if (remaining > 0) return remaining;

  if (
    options?.updatingExisting ||
    Boolean(post.locked_at || post.invoice_line_item_id)
  ) {
    return commercialFallback;
  }

  if (revenueBeforeVat > 0) return revenueBeforeVat;
  return billable;
}

export function buildPostInvoiceLinePayload(
  invoiceId: string,
  headerId: string,
  post: PostInvoiceLine,
  sortOrder: number,
  defaultVatRate: number,
  options?: { forRegeneration?: boolean; billedAmount?: number }
) {
  const deliverable = post.assignment_deliverable;
  const line = deliverable?.campaign_line;
  if (!deliverable || !line) {
    throw new Error("Post billing context missing.");
  }

  const beforeVat =
    options?.billedAmount != null
      ? options.billedAmount
      : postInvoiceBeforeVat(post, {
          updatingExisting: Boolean(post.invoice_line_item_id),
          forRegeneration: options?.forRegeneration,
        });
  const vatExempt = Boolean(deliverable.revenue_vat_exempt || line.revenue_vat_exempt);
  const vatPercent = resolveInvoiceLineVatPercent(
    {
      id: deliverable.id,
      campaign_line_id: post.campaign_line_id,
      sort_order: 0,
      platform: deliverable.platform,
      deliverable_type: deliverable.deliverable_type,
      quantity: 1,
      live_date: null,
      billable_amount: post.billable_amount,
      invoiced_amount: post.invoiced_amount,
      collected_amount: 0,
      disputed_amount: 0,
      remaining_amount: post.remaining_amount,
      billing_status: post.billing_status as DeliverableBillingRow["billing_status"],
      invoice_line_item_id: post.invoice_line_item_id,
      locked_at: post.locked_at,
      revenue_before_vat: post.revenue_before_vat,
      revenue_vat_percent: Number(deliverable.revenue_vat_percent ?? 0),
      revenue_vat_exempt: vatExempt,
      label: postDisplayLabel(
        deliverable.platform,
        deliverable.deliverable_type,
        post.sequence_number
      ),
    },
    line,
    defaultVatRate
  );

  return {
    invoice_id: invoiceId,
    campaign_line_id: line.id,
    campaign_header_id: headerId,
    assignment_deliverable_id: deliverable.id,
    assignment_post_schedule_id: post.id,
    sort_order: sortOrder,
    description: `${line.document_number} — ${line.name} · ${postDisplayLabel(
      deliverable.platform,
      deliverable.deliverable_type,
      post.sequence_number
    )}`,
    quantity: 1,
    unit_price: beforeVat,
    revenue_before_vat: beforeVat,
    revenue_vat_percent: vatExempt ? 0 : vatPercent,
    revenue_vat_exempt: vatExempt,
  };
}

type RawPostRow = {
  id: string;
  campaign_line_id: string;
  assignment_deliverable_id: string;
  sequence_number: number;
  live_date?: string | null;
  billable_amount?: number | null;
  invoiced_amount?: number | null;
  remaining_amount?: number | null;
  revenue_before_vat?: number | null;
  billing_status?: string | null;
  locked_at?: string | null;
  invoice_line_item_id?: string | null;
};

export async function fetchPostsForInvoicing(
  supabase: SupabaseClient,
  campaignId: string,
  postIds: string[]
): Promise<{ posts: PostInvoiceLine[]; error?: string }> {
  if (postIds.length === 0) return { posts: [] };

  const postSelectWithBilling =
    "id, campaign_line_id, assignment_deliverable_id, sequence_number, live_date, billable_amount, invoiced_amount, remaining_amount, revenue_before_vat, billing_status, locked_at, invoice_line_item_id";
  const postSelectFallback =
    "id, campaign_line_id, assignment_deliverable_id, sequence_number, live_date, revenue_before_vat, billing_status, locked_at, invoice_line_item_id";

  const primaryPostResult = await supabase
    .from("assignment_post_schedule")
    .select(postSelectWithBilling)
    .in("id", postIds)
    .order("sequence_number");

  const postResult =
    primaryPostResult.error &&
    /column|does not exist/i.test(primaryPostResult.error.message)
      ? await supabase
          .from("assignment_post_schedule")
          .select(postSelectFallback)
          .in("id", postIds)
          .order("sequence_number")
      : primaryPostResult;

  if (postResult.error) {
    return { posts: [], error: postResult.error.message };
  }

  const rawPosts = (postResult.data ?? []) as RawPostRow[];
  if (rawPosts.length === 0) {
    return { posts: [] };
  }

  const lineIds = [...new Set(rawPosts.map((row) => row.campaign_line_id).filter(Boolean))];
  const deliverableIds = [
    ...new Set(rawPosts.map((row) => row.assignment_deliverable_id).filter(Boolean)),
  ];

  const { data: lines, error: lineError } = await supabase
    .from("campaign_lines")
    .select(
      "id, document_number, name, billing_status, invoice_id, campaign_header_id, revenue, revenue_before_vat, usage_rights_amount, agency_fee_amount, agency_fee_percent, revenue_vat_percent, revenue_vat_exempt"
    )
    .eq("campaign_header_id", campaignId)
    .in("id", lineIds);

  if (lineError) {
    return { posts: [], error: lineError.message };
  }

  const lineById = new Map(
    (lines ?? []).map((row) => {
      const line = row as {
        id: string;
        document_number: string;
        name: string;
        billing_status: string;
        invoice_id: string | null;
        campaign_header_id: string;
        revenue: number | null;
        revenue_before_vat: number | null;
        usage_rights_amount?: number | null;
        agency_fee_amount?: number | null;
        agency_fee_percent?: number | null;
        revenue_vat_percent: number | null;
        revenue_vat_exempt: boolean | null;
      };
      return [line.id, line] as const;
    })
  );

  const { data: deliverables, error: deliverableError } = await supabase
    .from("assignment_deliverables")
    .select(
      "id, platform, deliverable_type, revenue_before_vat, usage_rights_amount, agency_fee_amount, agency_fee_percent, billable_amount, revenue_vat_percent, revenue_vat_exempt"
    )
    .in("id", deliverableIds);

  if (deliverableError) {
    return { posts: [], error: deliverableError.message };
  }

  const deliverableById = new Map(
    (deliverables ?? []).map((row) => {
      const deliverable = row as {
        id: string;
        platform: string;
        deliverable_type: string;
        revenue_before_vat: number | null;
        usage_rights_amount?: number | null;
        agency_fee_amount?: number | null;
        agency_fee_percent?: number | null;
        billable_amount: number | null;
        revenue_vat_percent: number | null;
        revenue_vat_exempt: boolean | null;
      };
      return [deliverable.id, deliverable] as const;
    })
  );

  const lineItemIds = rawPosts
    .map((row) => row.invoice_line_item_id)
    .filter(Boolean) as string[];
  const linkedInvoiceByLineItem = await resolveLinkedInvoiceIds(supabase, lineItemIds);

  const posts: PostInvoiceLine[] = [];

  for (const row of rawPosts) {
    const line = lineById.get(row.campaign_line_id);
    const deliverable = deliverableById.get(row.assignment_deliverable_id);
    if (!line || !deliverable) continue;

    const revenueBeforeVat = Number(row.revenue_before_vat ?? 0);
    const billable = Number(row.billable_amount ?? revenueBeforeVat);
    const remaining = Number(
      row.remaining_amount ?? Math.max(0, billable - Number(row.invoiced_amount ?? 0))
    );

    posts.push({
      id: row.id,
      campaign_line_id: row.campaign_line_id,
      assignment_deliverable_id: row.assignment_deliverable_id,
      sequence_number: Number(row.sequence_number ?? 1),
      live_date: row.live_date ?? null,
      billable_amount: billable,
      invoiced_amount: Number(row.invoiced_amount ?? 0),
      remaining_amount: remaining,
      revenue_before_vat: revenueBeforeVat,
      billing_status: String(row.billing_status ?? "ready_to_invoice"),
      locked_at: row.locked_at ?? null,
      invoice_line_item_id: row.invoice_line_item_id ?? null,
      linked_invoice_id: row.invoice_line_item_id
        ? (linkedInvoiceByLineItem.get(row.invoice_line_item_id) ?? null)
        : null,
      assignment_deliverable: {
        id: deliverable.id,
        platform: deliverable.platform,
        deliverable_type: deliverable.deliverable_type,
        revenue_before_vat: Number(deliverable.revenue_before_vat ?? 0),
        usage_rights_amount: Number(deliverable.usage_rights_amount ?? 0),
        agency_fee_amount:
          deliverable.agency_fee_amount != null
            ? Number(deliverable.agency_fee_amount)
            : null,
        agency_fee_percent: Number(deliverable.agency_fee_percent ?? 0),
        billable_amount: Number(deliverable.billable_amount ?? 0),
        revenue_vat_percent: Number(deliverable.revenue_vat_percent ?? 0),
        revenue_vat_exempt: Boolean(deliverable.revenue_vat_exempt),
        campaign_line: {
          id: line.id,
          document_number: line.document_number,
          name: line.name,
          billing_status: line.billing_status,
          invoice_id: line.invoice_id,
          campaign_header_id: line.campaign_header_id,
          revenue: Number(line.revenue ?? 0),
          revenue_before_vat: Number(line.revenue_before_vat ?? line.revenue ?? 0),
          usage_rights_amount: Number(line.usage_rights_amount ?? 0),
          agency_fee_amount:
            line.agency_fee_amount != null ? Number(line.agency_fee_amount) : null,
          agency_fee_percent: Number(line.agency_fee_percent ?? 0),
          revenue_vat_percent: Number(line.revenue_vat_percent ?? 0),
          revenue_vat_exempt: Boolean(line.revenue_vat_exempt),
        },
      },
    });
  }

  return { posts };
}

function resolvePostRemainingForInvoiceValidation(
  post: PostInvoiceLine,
  activeLineItemIds: Set<string>
): number {
  return resolveOperationalRemainingForInvoice(post, activeLineItemIds);
}

function enrichPostForInvoiceValidation(
  post: PostInvoiceLine,
  activeLineItemIds: Set<string>
): PostInvoiceLine {
  const remaining = resolvePostRemainingForInvoiceValidation(post, activeLineItemIds);
  const staleInvoicedPointer =
    isInvoicedOperationalRow(post) &&
    !isLinkedToLiveInvoiceLineItem(post, activeLineItemIds);

  if (!staleInvoicedPointer) {
    return { ...post, remaining_amount: remaining };
  }

  const invoiced = Number(post.invoiced_amount ?? 0);

  return {
    ...post,
    remaining_amount: remaining,
    invoice_line_item_id: null,
    locked_at: null,
    linked_invoice_id: null,
    billing_status:
      remaining > 0 && invoiced > 0
        ? "partially_invoiced"
        : remaining > 0
          ? "ready_to_invoice"
          : post.billing_status,
  };
}

/** Aligns post financials with UI linkage before server validation and lock. */
export async function preparePostsForInvoiceValidation(
  supabase: SupabaseClient,
  posts: PostInvoiceLine[]
): Promise<{ posts: PostInvoiceLine[]; activeLineItemIds: Set<string> }> {
  const lineItemIds = posts
    .map((post) => post.invoice_line_item_id)
    .filter(Boolean) as string[];
  const activeLineItemIds = await loadActiveInvoiceLineItemIds(supabase, lineItemIds);
  const prepared = posts.map((post) =>
    enrichPostForInvoiceValidation(post, activeLineItemIds)
  );

  for (let index = 0; index < posts.length; index++) {
    const raw = posts[index]!;
    const enriched = prepared[index]!;
    const staleInvoicedPointer =
      isInvoicedOperationalRow(raw) &&
      !isLinkedToLiveInvoiceLineItem(raw, activeLineItemIds);

    if (!staleInvoicedPointer) continue;

    const patch: Record<string, unknown> = {
      remaining_amount: enriched.remaining_amount,
    };

    if (
      raw.invoice_line_item_id ||
      raw.locked_at ||
      enriched.remaining_amount > 0
    ) {
      patch.billing_status = enriched.billing_status;
      patch.invoice_line_item_id = null;
      patch.locked_at = null;
      patch.invoiced_at = null;
    }

    const { error } = await supabase
      .from("assignment_post_schedule")
      .update(patch)
      .eq("id", raw.id);

    if (error && process.env.NODE_ENV === "development") {
      devLog("[billing-invoice] stale post financial sync failed", {
        postId: raw.id,
        message: error.message,
      });
    }
  }

  return { posts: prepared, activeLineItemIds };
}

export function validatePostsForInvoice(
  posts: PostInvoiceLine[],
  validationCtx: InvoiceValidationContext = { mode: "new" },
  activeLineItemIds: Set<string> = new Set()
): string | null {
  if (posts.length === 0) {
    return "No billable deliverables selected.";
  }

  for (const post of posts) {
    if (!post.assignment_deliverable?.campaign_line) {
      return "Selected post rows are missing billing context.";
    }

    if (validationCtx.mode === "append") {
      if (!invoicedRowAllowed(post, validationCtx)) {
        return invoicedRowBlockMessage("post", validationCtx);
      }
    } else if (blocksNewInvoiceOperationalRow(post, activeLineItemIds)) {
      return invoicedRowBlockMessage("post", validationCtx);
    }

    const remaining = resolvePostRemainingForInvoiceValidation(post, activeLineItemIds);
    if (validationCtx.mode === "new" && remaining <= 0.01) {
      return "Selected post rows include already invoiced items.";
    }
    if (post.billing_status === "disputed" || post.billing_status === "cancelled") {
      return "Disputed or cancelled posts cannot be invoiced.";
    }
  }

  return null;
}

async function syncDeliverableTotalsFromPosts(
  supabase: SupabaseClient,
  deliverableId: string
): Promise<void> {
  const { data: posts } = await supabase
    .from("assignment_post_schedule")
    .select("billable_amount, invoiced_amount, collected_amount, remaining_amount, locked_at, billing_status")
    .eq("assignment_deliverable_id", deliverableId);

  if (!posts?.length) return;

  const billable = posts.reduce((sum, row) => sum + Number(row.billable_amount ?? 0), 0);
  const invoiced = posts.reduce((sum, row) => sum + Number(row.invoiced_amount ?? 0), 0);
  const collected = posts.reduce((sum, row) => sum + Number(row.collected_amount ?? 0), 0);
  const remaining = posts.reduce((sum, row) => sum + Number(row.remaining_amount ?? 0), 0);
  const allLocked = posts.every((row) => Boolean(row.locked_at));

  await supabase
    .from("assignment_deliverables")
    .update({
      billable_amount: billable,
      invoiced_amount: invoiced,
      collected_amount: collected,
      remaining_amount: remaining,
      billing_status: allLocked
        ? "invoiced"
        : invoiced > 0
          ? "partially_invoiced"
          : "ready_to_invoice",
      locked_at: allLocked ? new Date().toISOString() : null,
    })
    .eq("id", deliverableId);
}

export async function lockPostsOnInvoice(
  supabase: SupabaseClient,
  invoiceId: string,
  headerId: string,
  posts: PostInvoiceLine[],
  options?: {
    defaultVatRate?: number;
    updateExistingOnTargetInvoice?: boolean;
    forRegeneration?: boolean;
    billedByPostId?: Map<string, number>;
  }
): Promise<{ error?: string; lineItemOps?: InvoiceLineItemOpSummary }> {
  const defaultVatRate = options?.defaultVatRate ?? 0;
  const updateExisting = options?.updateExistingOnTargetInvoice ?? false;
  const forRegeneration = options?.forRegeneration ?? false;
  const billedByPostId = options?.billedByPostId;
  const now = new Date().toISOString();
  let sortOrder = 0;
  const lineIds = new Set<string>();
  const deliverableIds = new Set<string>();
  const lineItemOps: InvoiceLineItemOpSummary = { updated: [], created: [] };

  for (const post of posts) {
    sortOrder += 1;
    const remaining = Number(post.remaining_amount ?? 0);
    const requested = billedByPostId?.get(post.id);
    const slice = resolveInvoiceSlice({
      remaining,
      invoiced: Number(post.invoiced_amount ?? 0),
      billable: Number(post.billable_amount ?? remaining),
      requestedAmount: requested == null ? remaining : requested,
    });
    if (slice.error) {
      return { error: slice.error, lineItemOps };
    }

    const updatingExisting =
      updateExisting &&
      Boolean(post.invoice_line_item_id) &&
      post.linked_invoice_id === invoiceId;
    let existingOnInvoice = 0;
    let lineItemId = post.invoice_line_item_id;
    let reuseLineItem = updatingExisting;

    if (reuseLineItem && lineItemId) {
      const { data: existingItem } = await supabase
        .from("invoice_line_items")
        .select("id, revenue_before_vat")
        .eq("id", lineItemId)
        .eq("invoice_id", invoiceId)
        .maybeSingle();
      existingOnInvoice = Number(
        (existingItem as { revenue_before_vat?: number | null } | null)?.revenue_before_vat ?? 0
      );
    }

    const billedAmount = reuseLineItem
      ? slice.billedAmount + existingOnInvoice
      : slice.billedAmount;
    const payload = buildPostInvoiceLinePayload(
      invoiceId,
      headerId,
      post,
      sortOrder,
      defaultVatRate,
      { forRegeneration, billedAmount }
    );

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

    const lockLiveAdDate = Boolean(post.live_date?.trim());
    const postLockPatch = buildOperationalCoveragePatch({
      billable: Number(post.billable_amount ?? remaining),
      invoicedCoverage: slice.invoicedAfter,
      lineItemId: lineItemId ?? null,
      now,
      lockLiveDate: lockLiveAdDate && slice.shouldLock,
    });

    const { error: lockError } = await supabase
      .from("assignment_post_schedule")
      .update(postLockPatch)
      .eq("id", post.id);

    if (lockError) {
      return { error: lockError.message, lineItemOps };
    }

    lineIds.add(post.campaign_line_id);
    deliverableIds.add(post.assignment_deliverable_id);

    if (process.env.NODE_ENV === "development") {
      devLog("[billing-sync] post locked on invoice", {
        postId: post.id,
        invoiceId,
        billedAmount: slice.billedAmount,
        remainingAfter: slice.remainingAfter,
        lineItemMode: reuseLineItem ? "updated" : "created",
        lineItemId,
      });
    }
  }

  for (const deliverableId of deliverableIds) {
    await syncDeliverableTotalsFromPosts(supabase, deliverableId);
  }

  for (const lineId of lineIds) {
    const { data: allRows } = await supabase
      .from("assignment_deliverables")
      .select(assignmentDeliverableBillingSelect(false))
      .eq("campaign_line_id", lineId)
      .order("sort_order");

    const mappedAll = ((allRows ?? []) as unknown as DeliverableBillingRow[]).map((row) => ({
      ...row,
      revenue_vat_exempt: resolveDeliverableVatExempt(row, true),
      label: deliverableDisplayLabel(row),
    }));

    const sample = mappedAll[0];
    const currentStatus = sample?.billing_status ?? "moved_to_billing";
    const nextStatus = deriveLineBillingStatusFromDeliverables(mappedAll, currentStatus);
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
      linePatch.operational_status = operationalStatusForDb("locked");
    } else if (partialLock) {
      linePatch.operational_status = "io_generated";
    }

    await supabase.from("campaign_lines").update(linePatch as never).eq("id", lineId);
    await syncLineBillingFromDeliverables(supabase, lineId, nextStatus);
    await syncLineOperationalStatus(supabase, lineId);
  }

  return { lineItemOps };
}
