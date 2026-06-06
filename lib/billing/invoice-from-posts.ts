import type { SupabaseClient } from "@supabase/supabase-js";

import { assignmentStatusFromBilling, platformLabel } from "@/features/campaigns/line-assignment";
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
import {
  recalculateInvoiceTotals,
  resolveInvoiceLineVatPercent,
} from "@/lib/billing/invoice-from-deliverables";
import { syncLineBillingFromDeliverables } from "@/lib/billing/sync-deliverable-billing";
import { syncLineOperationalStatus } from "@/lib/billing/sync-line-operational-status";
import {
  invoicedRowAllowed,
  invoicedRowBlockMessage,
  isInvoicedOperationalRow,
  resolveLinkedInvoiceIds,
  type InvoiceValidationContext,
} from "@/lib/billing/invoice-validation-context";
import { devLog } from "@/lib/dev-log";

export type PostInvoiceLine = {
  id: string;
  campaign_line_id: string;
  assignment_deliverable_id: string;
  sequence_number: number;
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
    revenue_vat_percent: number | null;
    revenue_vat_exempt: boolean | null;
    campaign_line: {
      id: string;
      document_number: string;
      name: string;
      billing_status: string;
      invoice_id: string | null;
      campaign_header_id: string;
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

function postInvoiceBeforeVat(post: PostInvoiceLine): number {
  if (post.remaining_amount > 0) return post.remaining_amount;
  if (post.revenue_before_vat > 0) return post.revenue_before_vat;
  return post.billable_amount;
}

function postInvoiceLinePayload(
  invoiceId: string,
  headerId: string,
  post: PostInvoiceLine,
  sortOrder: number,
  defaultVatRate: number
) {
  const deliverable = post.assignment_deliverable;
  const line = deliverable?.campaign_line;
  if (!deliverable || !line) {
    throw new Error("Post billing context missing.");
  }

  const beforeVat = postInvoiceBeforeVat(post);
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
    "id, campaign_line_id, assignment_deliverable_id, sequence_number, billable_amount, invoiced_amount, remaining_amount, revenue_before_vat, billing_status, locked_at, invoice_line_item_id";
  const postSelectFallback =
    "id, campaign_line_id, assignment_deliverable_id, sequence_number, revenue_before_vat, billing_status, locked_at, invoice_line_item_id";

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
      "id, document_number, name, billing_status, invoice_id, campaign_header_id, revenue_vat_percent, revenue_vat_exempt"
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
        revenue_vat_percent: number | null;
        revenue_vat_exempt: boolean | null;
      };
      return [line.id, line] as const;
    })
  );

  const { data: deliverables, error: deliverableError } = await supabase
    .from("assignment_deliverables")
    .select("id, platform, deliverable_type, revenue_vat_percent, revenue_vat_exempt")
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
        revenue_vat_percent: Number(deliverable.revenue_vat_percent ?? 0),
        revenue_vat_exempt: Boolean(deliverable.revenue_vat_exempt),
        campaign_line: {
          id: line.id,
          document_number: line.document_number,
          name: line.name,
          billing_status: line.billing_status,
          invoice_id: line.invoice_id,
          campaign_header_id: line.campaign_header_id,
          revenue_vat_percent: Number(line.revenue_vat_percent ?? 0),
          revenue_vat_exempt: Boolean(line.revenue_vat_exempt),
        },
      },
    });
  }

  return { posts };
}

export function validatePostsForInvoice(
  posts: PostInvoiceLine[],
  validationCtx: InvoiceValidationContext = { mode: "new" }
): string | null {
  if (posts.length === 0) {
    return "No billable deliverables selected.";
  }

  for (const post of posts) {
    if (!post.assignment_deliverable?.campaign_line) {
      return "Selected post rows are missing billing context.";
    }
    if (!invoicedRowAllowed(post, validationCtx)) {
      return invoicedRowBlockMessage("post", validationCtx);
    }
    if (
      validationCtx.mode === "new" &&
      !isInvoicedOperationalRow(post) &&
      post.remaining_amount <= 0 &&
      postInvoiceBeforeVat(post) <= 0
    ) {
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
  options?: { defaultVatRate?: number; updateExistingOnTargetInvoice?: boolean }
): Promise<{ error?: string }> {
  const defaultVatRate = options?.defaultVatRate ?? 0;
  const updateExisting = options?.updateExistingOnTargetInvoice ?? false;
  const now = new Date().toISOString();
  let sortOrder = 0;
  const lineIds = new Set<string>();
  const deliverableIds = new Set<string>();

  for (const post of posts) {
    sortOrder += 1;
    const billable = postInvoiceBeforeVat(post);
    const payload = postInvoiceLinePayload(invoiceId, headerId, post, sortOrder, defaultVatRate);
    const reuseLineItem =
      updateExisting &&
      post.invoice_line_item_id &&
      post.linked_invoice_id === invoiceId;

    let lineItemId = post.invoice_line_item_id;

    if (reuseLineItem && lineItemId) {
      const { error: updateError } = await supabase
        .from("invoice_line_items")
        .update(payload)
        .eq("id", lineItemId);

      if (updateError) {
        return { error: updateError.message };
      }
    } else {
      const { data: item, error: itemError } = await supabase
        .from("invoice_line_items")
        .insert(payload)
        .select("id")
        .single();

      if (itemError || !item) {
        return { error: itemError?.message ?? "Invoice line item creation failed." };
      }

      lineItemId = item.id;
    }

    const { error: lockError } = await supabase
      .from("assignment_post_schedule")
      .update({
        invoiced_amount: billable,
        remaining_amount: 0,
        billing_status: "invoiced",
        invoice_line_item_id: lineItemId,
        invoiced_at: now,
        locked_at: now,
      })
      .eq("id", post.id);

    if (lockError) {
      return { error: lockError.message };
    }

    lineIds.add(post.campaign_line_id);
    deliverableIds.add(post.assignment_deliverable_id);

    if (process.env.NODE_ENV === "development") {
      devLog("[billing-sync] post locked on invoice", {
        postId: post.id,
        invoiceId,
        billable,
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
      linePatch.operational_status = "locked";
    } else if (partialLock) {
      linePatch.operational_status = "io_generated";
    }

    await supabase.from("campaign_lines").update(linePatch as never).eq("id", lineId);
    await syncLineBillingFromDeliverables(supabase, lineId, nextStatus);
    await syncLineOperationalStatus(supabase, lineId);
  }

  const totalsError = await recalculateInvoiceTotals(supabase, invoiceId);
  if (totalsError.error) {
    return totalsError;
  }

  return {};
}
