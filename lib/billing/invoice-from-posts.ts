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
import { devLog } from "@/lib/dev-log";

type PostInvoiceLine = {
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

export async function fetchPostsForInvoicing(
  supabase: SupabaseClient,
  campaignId: string,
  postIds: string[]
): Promise<{ posts: PostInvoiceLine[]; error?: string }> {
  if (postIds.length === 0) return { posts: [] };

  const lineEmbed =
    "campaign_line:campaign_lines!inner(id, document_number, name, billing_status, invoice_id, campaign_header_id, revenue_vat_percent, revenue_vat_exempt)";
  const deliverableEmbed = `assignment_deliverable:assignment_deliverables!inner(id, platform, deliverable_type, revenue_vat_percent, revenue_vat_exempt, ${lineEmbed})`;

  const selectWithBilling = `id, campaign_line_id, assignment_deliverable_id, sequence_number, billable_amount, invoiced_amount, remaining_amount, revenue_before_vat, billing_status, locked_at, invoice_line_item_id, ${deliverableEmbed}`;
  const selectFallback = `id, campaign_line_id, assignment_deliverable_id, sequence_number, revenue_before_vat, billing_status, locked_at, invoice_line_item_id, ${deliverableEmbed}`;

  let rawRows: unknown[] | null = null;
  let fetchError: { message: string } | null = null;

  const primary = await supabase
    .from("assignment_post_schedule")
    .select(selectWithBilling)
    .in("id", postIds)
    .order("sequence_number");

  if (primary.error && /column|does not exist/i.test(primary.error.message)) {
    const fallback = await supabase
      .from("assignment_post_schedule")
      .select(selectFallback)
      .in("id", postIds)
      .order("sequence_number");
    rawRows = fallback.data;
    fetchError = fallback.error;
  } else {
    rawRows = primary.data;
    fetchError = primary.error;
  }

  if (fetchError) {
    return { posts: [], error: fetchError.message };
  }

  const posts = (rawRows ?? [])
    .map((row) => normalizePostInvoiceRow(row))
    .filter((row): row is PostInvoiceLine => row !== null)
    .filter(
      (row) => row.assignment_deliverable?.campaign_line?.campaign_header_id === campaignId
    );

  return { posts };
}

function normalizePostInvoiceRow(row: unknown): PostInvoiceLine | null {
  if (!row || typeof row !== "object") return null;
  const record = row as Record<string, unknown>;
  const deliverableRaw = record.assignment_deliverable;
  const deliverableRecord = Array.isArray(deliverableRaw)
    ? deliverableRaw[0]
    : deliverableRaw;
  if (!deliverableRecord || typeof deliverableRecord !== "object") return null;

  const deliverable = deliverableRecord as Record<string, unknown>;
  const lineRaw = deliverable.campaign_line;
  const lineRecord = Array.isArray(lineRaw) ? lineRaw[0] : lineRaw;
  if (!lineRecord || typeof lineRecord !== "object") return null;

  const line = lineRecord as Record<string, unknown>;
  const revenueBeforeVat = Number(record.revenue_before_vat ?? 0);
  const billable = Number(record.billable_amount ?? revenueBeforeVat);
  const remaining = Number(
    record.remaining_amount ?? Math.max(0, billable - Number(record.invoiced_amount ?? 0))
  );

  return {
    id: String(record.id),
    campaign_line_id: String(record.campaign_line_id),
    assignment_deliverable_id: String(record.assignment_deliverable_id),
    sequence_number: Number(record.sequence_number ?? 1),
    billable_amount: billable,
    invoiced_amount: Number(record.invoiced_amount ?? 0),
    remaining_amount: remaining,
    revenue_before_vat: revenueBeforeVat,
    billing_status: String(record.billing_status ?? "ready_to_invoice"),
    locked_at: (record.locked_at as string | null) ?? null,
    invoice_line_item_id: (record.invoice_line_item_id as string | null) ?? null,
    assignment_deliverable: {
      id: String(deliverable.id),
      platform: String(deliverable.platform ?? ""),
      deliverable_type: String(deliverable.deliverable_type ?? ""),
      revenue_vat_percent: Number(deliverable.revenue_vat_percent ?? 0),
      revenue_vat_exempt: Boolean(deliverable.revenue_vat_exempt),
      campaign_line: {
        id: String(line.id),
        document_number: String(line.document_number ?? ""),
        name: String(line.name ?? ""),
        billing_status: String(line.billing_status ?? "moved_to_billing"),
        invoice_id: (line.invoice_id as string | null) ?? null,
        campaign_header_id: String(line.campaign_header_id ?? ""),
        revenue_vat_percent: Number(line.revenue_vat_percent ?? 0),
        revenue_vat_exempt: Boolean(line.revenue_vat_exempt),
      },
    },
  };
}

export function validatePostsForInvoice(posts: PostInvoiceLine[]): string | null {
  if (posts.length === 0) {
    return "No billable deliverables selected.";
  }

  for (const post of posts) {
    if (!post.assignment_deliverable?.campaign_line) {
      return "Selected post rows are missing billing context.";
    }
    if (post.locked_at || post.invoice_line_item_id) {
      return "Selected post rows include already invoiced items.";
    }
    if (post.remaining_amount <= 0 && postInvoiceBeforeVat(post) <= 0) {
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
  options?: { defaultVatRate?: number }
): Promise<{ error?: string }> {
  const defaultVatRate = options?.defaultVatRate ?? 0;
  const now = new Date().toISOString();
  let sortOrder = 0;
  const lineIds = new Set<string>();
  const deliverableIds = new Set<string>();

  for (const post of posts) {
    sortOrder += 1;
    const billable = postInvoiceBeforeVat(post);

    const { data: item, error: itemError } = await supabase
      .from("invoice_line_items")
      .insert(postInvoiceLinePayload(invoiceId, headerId, post, sortOrder, defaultVatRate))
      .select("id")
      .single();

    if (itemError || !item) {
      return { error: itemError?.message ?? "Invoice line item creation failed." };
    }

    const { error: lockError } = await supabase
      .from("assignment_post_schedule")
      .update({
        invoiced_amount: billable,
        remaining_amount: 0,
        billing_status: "invoiced",
        invoice_line_item_id: item.id,
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
