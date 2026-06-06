import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  AssignmentBillingGroup,
  CampaignLineBillingStatus,
  DeliverableBillingRow,
} from "@/features/billing/types";
import {
  queryAssignmentDeliverables,
  resolveDeliverableVatExempt,
} from "@/lib/billing/assignment-deliverable-queries";
import { getAssignmentOpsStatus } from "@/lib/billing/assignment-lifecycle-state";
import { syncCampaignBillingState } from "@/lib/billing/billing-sync-engine";
import {
  buildCampaignQueueRow,
  filterCampaignsWithRemainingInvoiceable,
} from "@/lib/billing/campaign-billing-queue";
import type { CampaignBillingQueueRow } from "@/lib/billing/campaign-billing-queue";
import {
  deliverableDisplayLabel,
  rollupAssignmentBilling,
} from "@/lib/billing/deliverable-billing";
import {
  buildPostOperationalRow,
  type OperationalBillingRow,
} from "@/lib/billing/operational-billing-rows";
import {
  loadCampaignInvoiceLineRollups,
  reconcileCampaignRollupWithInvoiceLines,
} from "@/lib/billing/invoice-operational-aggregation";
import {
  applyOperationalInvoiceLinkage,
  loadOperationalInvoiceLinkage,
} from "@/lib/billing/operational-invoice-linkage";
import {
  buildOperationalBillingContext,
  normalizeOperationalBillingTree,
  resolvePostBillableAmount,
} from "@/lib/billing/operational-financial-sync";
import { devLog } from "@/lib/dev-log";
import { queryCampaignLinesWithDisplayOrder } from "@/lib/campaigns/line-ordering";
import {
  parseLineAssignment,
  platformLabel,
} from "@/features/campaigns/line-assignment";

type LineRow = {
  id: string;
  document_number: string;
  name: string;
  campaign_header_id: string;
  billing_status: CampaignLineBillingStatus;
  operational_status?: string | null;
  vendor_io_id?: string | null;
  currency_code: string;
  pricing_mode: string | null;
  revenue: number;
  revenue_vat_percent?: number | null;
  revenue_vat_exempt?: boolean | null;
  metadata: Record<string, unknown> | null;
  invoice_id: string | null;
  invoice: {
    id: string;
    document_number: string;
    regeneration_status: string | null;
  } | null;
  vendor_io?: { document_number: string } | null;
};

type PostRow = {
  id: string;
  assignment_deliverable_id: string;
  campaign_line_id: string;
  sequence_number: number;
  live_date: string | null;
  billing_status: string;
  revenue_before_vat: number;
  billable_amount?: number | null;
  invoiced_amount?: number | null;
  collected_amount?: number | null;
  remaining_amount?: number | null;
  invoice_line_item_id?: string | null;
  locked_at?: string | null;
};

const POST_BILLING_SELECT =
  "id, assignment_deliverable_id, campaign_line_id, sequence_number, live_date, billing_status, revenue_before_vat, billable_amount, invoiced_amount, collected_amount, remaining_amount, invoice_line_item_id, locked_at";

const POST_BILLING_FALLBACK =
  "id, assignment_deliverable_id, campaign_line_id, sequence_number, live_date, billing_status, revenue_before_vat";

function resolveDeliverableGroupFinancials(
  deliverable: DeliverableBillingRow,
  postChildren: OperationalBillingRow[],
  usePosts: boolean
): Pick<
  OperationalBillingRow,
  "billable_amount" | "invoiced_amount" | "collected_amount" | "remaining_amount"
> {
  if (!usePosts) {
    return {
      billable_amount: deliverable.billable_amount,
      invoiced_amount: deliverable.invoiced_amount,
      collected_amount: deliverable.collected_amount,
      remaining_amount: deliverable.remaining_amount,
    };
  }

  const postTotals = postChildren.reduce(
    (acc, post) => ({
      billable: acc.billable + post.billable_amount,
      invoiced: acc.invoiced + post.invoiced_amount,
      collected: acc.collected + post.collected_amount,
      remaining: acc.remaining + post.remaining_amount,
    }),
    { billable: 0, invoiced: 0, collected: 0, remaining: 0 }
  );

  const deliverableLocked =
    Boolean(deliverable.locked_at) ||
    Boolean(deliverable.invoice_line_item_id) ||
    deliverable.invoiced_amount > 0;

  if (deliverableLocked) {
    return {
      billable_amount: deliverable.billable_amount,
      invoiced_amount: Math.max(deliverable.invoiced_amount, postTotals.invoiced),
      collected_amount: Math.max(deliverable.collected_amount, postTotals.collected),
      remaining_amount: deliverable.remaining_amount,
    };
  }

  return {
    billable_amount: postTotals.billable,
    invoiced_amount: postTotals.invoiced,
    collected_amount: postTotals.collected,
    remaining_amount: postTotals.remaining,
  };
}

function postLabel(platform: string, deliverableType: string, sequence: number): string {
  const typeLabel = deliverableType.replace(/_/g, " ");
  const pLabel = platform.charAt(0).toUpperCase() + platform.slice(1);
  return `${pLabel} ${typeLabel} #${sequence}`;
}

export async function loadCampaignOperationalBilling(
  supabase: SupabaseClient,
  campaignId: string
): Promise<{
  groups: AssignmentBillingGroup[];
  operational_rows: OperationalBillingRow[];
  error?: string;
}> {
  const lineSelectWithSort =
    "id, document_number, name, campaign_header_id, billing_status, operational_status, vendor_io_id, currency_code, pricing_mode, revenue, revenue_vat_percent, revenue_vat_exempt, metadata, invoice_id, sort_order, invoice:invoices(id, document_number, regeneration_status), vendor_io:vendor_ios(document_number)";
  const lineSelectFallback =
    "id, document_number, name, campaign_header_id, billing_status, operational_status, vendor_io_id, currency_code, pricing_mode, revenue, revenue_vat_percent, revenue_vat_exempt, metadata, invoice_id, invoice:invoices(id, document_number, regeneration_status), vendor_io:vendor_ios(document_number)";

  const { data: lines, error: linesError } =
    await queryCampaignLinesWithDisplayOrder<LineRow>(async (orderColumn, includeSortOrderColumn) => {
      const result = await supabase
        .from("campaign_lines")
        .select(includeSortOrderColumn ? lineSelectWithSort : lineSelectFallback)
        .eq("campaign_header_id", campaignId)
        .order(orderColumn, { ascending: true });
      return { data: (result.data ?? null) as LineRow[] | null, error: result.error };
    });

  if (linesError) {
    return { groups: [], operational_rows: [], error: linesError };
  }

  const lineIds = lines.map((l) => l.id);
  if (lineIds.length === 0) {
    return { groups: [], operational_rows: [] };
  }

  const {
    data: deliverableRows,
    error: deliverableError,
    includesVatExempt,
  } = await queryAssignmentDeliverables<
    Omit<DeliverableBillingRow, "label"> & { revenue_vat_exempt?: boolean | null }
  >(async (select) => {
    const result = await supabase
      .from("assignment_deliverables")
      .select(select)
      .in("campaign_line_id", lineIds)
      .order("sort_order");
    return {
      data: (result.data ?? null) as Array<
        Omit<DeliverableBillingRow, "label"> & { revenue_vat_exempt?: boolean | null }
      > | null,
      error: result.error,
    };
  });

  if (deliverableError) {
    return { groups: [], operational_rows: [], error: deliverableError };
  }

  const deliverableIds = (deliverableRows ?? []).map((d) => d.id);
  const postsByDeliverable = new Map<string, PostRow[]>();

  if (deliverableIds.length > 0) {
    const postResult = await supabase
      .from("assignment_post_schedule")
      .select(POST_BILLING_SELECT)
      .in("assignment_deliverable_id", deliverableIds)
      .order("sequence_number");

    if (postResult.error && /column|does not exist/i.test(postResult.error.message)) {
      const fallback = await supabase
        .from("assignment_post_schedule")
        .select(POST_BILLING_FALLBACK)
        .in("assignment_deliverable_id", deliverableIds)
        .order("sequence_number");
      if (!fallback.error) {
        for (const row of (fallback.data ?? []) as PostRow[]) {
          const list = postsByDeliverable.get(row.assignment_deliverable_id) ?? [];
          list.push(row);
          postsByDeliverable.set(row.assignment_deliverable_id, list);
        }
      }
    } else if (!postResult.error) {
      for (const row of (postResult.data ?? []) as PostRow[]) {
        const list = postsByDeliverable.get(row.assignment_deliverable_id) ?? [];
        list.push(row);
        postsByDeliverable.set(row.assignment_deliverable_id, list);
      }
    }
  }

  const deliverablesByLine = new Map<string, DeliverableBillingRow[]>();
  for (const row of deliverableRows ?? []) {
    const typed = row as unknown as Omit<DeliverableBillingRow, "label">;
    const mapped: DeliverableBillingRow = {
      ...typed,
      billable_amount: Number(typed.billable_amount),
      invoiced_amount: Number(typed.invoiced_amount),
      collected_amount: Number(typed.collected_amount),
      disputed_amount: Number(typed.disputed_amount),
      remaining_amount: Number(typed.remaining_amount),
      revenue_before_vat: Number(typed.revenue_before_vat),
      revenue_vat_percent: Number(typed.revenue_vat_percent ?? 0),
      revenue_vat_exempt: resolveDeliverableVatExempt(typed, includesVatExempt),
      label: deliverableDisplayLabel(typed),
    };
    const list = deliverablesByLine.get(typed.campaign_line_id) ?? [];
    list.push(mapped);
    deliverablesByLine.set(typed.campaign_line_id, list);
  }

  const groups: AssignmentBillingGroup[] = [];
  const operational_rows: OperationalBillingRow[] = [];

  for (const line of lines) {
    const assignment = parseLineAssignment(line.metadata);
    const deliverables = deliverablesByLine.get(line.id) ?? [];
    const rollups = rollupAssignmentBilling(deliverables);
    const title =
      assignment?.influencer_name != null
        ? `${assignment.influencer_name} — ${assignment.pricing_mode === "package" ? "Package" : "Per deliverable"}`
        : line.name;

    groups.push({
      line_id: line.id,
      document_number: line.document_number,
      name: line.name,
      influencer_name: assignment?.influencer_name ?? null,
      platform_summary: assignment
        ? assignment.platforms.map((p) => platformLabel(p.platform)).join(", ")
        : null,
      billing_status: line.billing_status,
      currency_code: line.currency_code,
      pricing_mode: line.pricing_mode ?? assignment?.pricing_mode ?? "package",
      deliverables,
      ...rollups,
      revenue_locked: false,
      cost_locked: false,
      vendor_assignment_locked: false,
      invoice_id: line.invoice_id,
      invoice_document_number: line.invoice?.document_number ?? null,
      po_over_consumed: false,
      po_amount: 0,
      po_consumed: 0,
    });

    const deliverableChildren: OperationalBillingRow[] = [];
    const assignmentPricingMode =
      (line.pricing_mode ?? assignment?.pricing_mode ?? "package") as
        | "package"
        | "per_deliverable";
    const assignmentOps = getAssignmentOpsStatus({
      billing_status: line.billing_status,
      operational_status: line.operational_status,
      vendor_io_id: line.vendor_io_id,
      billable_amount: rollups.total_value,
      invoiced_amount: rollups.invoiced_value,
      remaining_amount: rollups.remaining_value,
    });
    const assignmentInvoiceable = ["io_generated", "partially_invoiced", "io_revised"].includes(
      assignmentOps
    );

    for (const deliverable of deliverables) {
      const posts = postsByDeliverable.get(deliverable.id) ?? [];
      const postChildren: OperationalBillingRow[] = posts.map((post) => {
        const fallbackPerPost =
          posts.length > 0 && deliverable.billable_amount > 0
            ? deliverable.billable_amount / posts.length
            : 0;
        const enrichedPost = {
          ...post,
          billable_amount: resolvePostBillableAmount({
            billable_amount: post.billable_amount,
            revenue_before_vat: post.revenue_before_vat,
            fallback: fallbackPerPost,
          }),
        };
        const postRow = buildPostOperationalRow(
          enrichedPost,
          {
            platform: deliverable.platform,
            deliverable_type: deliverable.deliverable_type,
            billing_status: deliverable.billing_status,
            revenue_vat_percent: deliverable.revenue_vat_percent,
            revenue_vat_exempt: deliverable.revenue_vat_exempt,
          },
          {
            campaign_header_id: campaignId,
            billing_status: line.billing_status,
            invoice_id: line.invoice_id,
            invoice_document_number: line.invoice?.document_number ?? null,
            revenue_vat_percent: Number(line.revenue_vat_percent ?? 0),
            revenue_vat_exempt: Boolean(line.revenue_vat_exempt),
            operational_status: line.operational_status ?? "draft",
            vendor_io_id: line.vendor_io_id ?? null,
            vendor_io_document_number:
              (line as { vendor_io?: { document_number?: string } | null }).vendor_io
                ?.document_number ?? null,
          },
          postLabel(deliverable.platform, deliverable.deliverable_type, post.sequence_number)
        );
        return {
          ...postRow,
          line_pricing_mode: assignmentPricingMode,
          linked_invoice_id: line.invoice_id,
          invoice_regeneration_status: line.invoice?.regeneration_status ?? null,
        };
      });

      const postBillableTotal = postChildren.reduce((sum, post) => sum + post.billable_amount, 0);
      const usePosts = postChildren.length > 0 && postBillableTotal > 0;
      const groupFinancials = resolveDeliverableGroupFinancials(
        deliverable,
        postChildren,
        usePosts
      );

      deliverableChildren.push({
        id: deliverable.id,
        kind: "deliverable_group",
        line_pricing_mode: assignmentPricingMode,
        campaign_header_id: campaignId,
        campaign_line_id: line.id,
        assignment_deliverable_id: deliverable.id,
        parent_id: line.id,
        label: deliverable.label,
        document_number: null,
        influencer_name: assignment?.influencer_name ?? null,
        platform: deliverable.platform,
        deliverable_type: deliverable.deliverable_type,
        billable_amount: groupFinancials.billable_amount,
        invoiced_amount: groupFinancials.invoiced_amount,
        collected_amount: groupFinancials.collected_amount,
        remaining_amount: groupFinancials.remaining_amount,
        billing_status: deliverable.billing_status,
        line_billing_status: line.billing_status,
        invoice_id: line.invoice_id,
        linked_invoice_id: line.invoice_id,
        invoice_regeneration_status: line.invoice?.regeneration_status ?? null,
        invoice_document_number: line.invoice?.document_number ?? null,
        invoice_line_item_id: deliverable.invoice_line_item_id,
        locked_at: deliverable.locked_at,
        is_locked: Boolean(deliverable.locked_at),
        is_invoice_eligible:
          assignmentInvoiceable &&
          Boolean(line.vendor_io_id) &&
          groupFinancials.remaining_amount > 0 &&
          !deliverable.locked_at,
        operational_status: line.operational_status ?? "draft",
        vendor_io_id: line.vendor_io_id ?? null,
        vendor_io_document_number:
          (line as { vendor_io?: { document_number?: string } | null }).vendor_io
            ?.document_number ?? null,
        is_achieved: ["ready_to_invoice", "partially_invoiced", "invoiced"].includes(
          deliverable.billing_status
        ),
        is_legacy_synthetic: false,
        revenue_before_vat: deliverable.revenue_before_vat,
        revenue_vat_percent: deliverable.revenue_vat_percent,
        revenue_vat_exempt: deliverable.revenue_vat_exempt,
        line_revenue_vat_percent: Number(line.revenue_vat_percent ?? 0),
        line_revenue_vat_exempt: Boolean(line.revenue_vat_exempt),
        children: postChildren,
      });
    }

    const lineVatPercent = Number(line.revenue_vat_percent ?? 0);
    const lineVatExempt = Boolean(line.revenue_vat_exempt);

    operational_rows.push({
      id: line.id,
      kind: "assignment",
      campaign_header_id: campaignId,
      campaign_line_id: line.id,
      assignment_deliverable_id: null,
      parent_id: null,
      label: title,
      document_number: line.document_number,
      influencer_name: assignment?.influencer_name ?? null,
      platform: null,
      deliverable_type: null,
      billable_amount:
        deliverableChildren.reduce((s, d) => s + d.billable_amount, 0) || Number(line.revenue),
      invoiced_amount: deliverableChildren.reduce((s, d) => s + d.invoiced_amount, 0),
      collected_amount: deliverableChildren.reduce((s, d) => s + d.collected_amount, 0),
      remaining_amount: deliverableChildren.reduce((s, d) => s + d.remaining_amount, 0),
      billing_status: line.billing_status,
      line_billing_status: line.billing_status,
      invoice_id: line.invoice_id,
      linked_invoice_id: line.invoice_id,
      invoice_regeneration_status: line.invoice?.regeneration_status ?? null,
      invoice_document_number: line.invoice?.document_number ?? null,
      invoice_line_item_id: null,
      locked_at: null,
      is_locked: false,
      is_invoice_eligible:
        assignmentInvoiceable &&
        Boolean(line.vendor_io_id) &&
        deliverableChildren.some((d) => d.is_invoice_eligible),
      operational_status: line.operational_status ?? "draft",
      vendor_io_id: line.vendor_io_id ?? null,
      vendor_io_document_number:
        (line as { vendor_io?: { document_number?: string } | null }).vendor_io
          ?.document_number ?? null,
      is_achieved: ["approved", "moved_to_billing", "partially_invoiced", "invoiced"].includes(
        line.billing_status
      ),
      is_legacy_synthetic: deliverables.length === 0,
      pricing_mode: assignmentPricingMode,
      revenue_before_vat: Number(line.revenue ?? 0),
      revenue_vat_percent: lineVatPercent,
      revenue_vat_exempt: lineVatExempt,
      line_revenue_vat_percent: lineVatPercent,
      line_revenue_vat_exempt: lineVatExempt,
      children: deliverableChildren,
    });
  }

  const billingContext = buildOperationalBillingContext(lines, groups);
  const normalized_rows = normalizeOperationalBillingTree(operational_rows, billingContext);
  const invoiceLinks = await loadOperationalInvoiceLinkage(supabase, campaignId);
  const linked_rows = applyOperationalInvoiceLinkage(normalized_rows, invoiceLinks);

  if (process.env.NODE_ENV === "development") {
    devLog("[operational-billing-query] loaded", {
      campaignId,
      assignments: linked_rows.length,
      deliverables: deliverableIds.length,
      posts: [...postsByDeliverable.values()].flat().length,
      invoiceLinks: invoiceLinks.length,
    });
  }

  return { groups, operational_rows: linked_rows };
}

export async function loadBillingCampaignQueue(
  supabase: SupabaseClient
): Promise<{ campaigns: CampaignBillingQueueRow[]; error?: string }> {
  const headerSelectWithBrand = `
    id, document_number, name, currency_code, status,
    client:clients(id, name, legal_name),
    brand:brands(name)
  `;
  const headerSelectFallback = `
    id, document_number, name, currency_code, status,
    client:clients(id, name, legal_name)
  `;

  const primaryHeaders = await supabase
    .from("campaign_headers")
    .select(headerSelectWithBrand)
    .not("status", "eq", "cancelled")
    .order("updated_at", { ascending: false })
    .limit(100);

  let headerError = primaryHeaders.error;
  let headerData: unknown[] | null = primaryHeaders.data;

  if (headerError) {
    if (process.env.NODE_ENV === "development") {
      console.debug("[billing-queue] header query with brand failed, retrying", {
        error: headerError.message,
      });
    }
    const fallbackHeaders = await supabase
      .from("campaign_headers")
      .select(headerSelectFallback)
      .not("status", "eq", "cancelled")
      .order("updated_at", { ascending: false })
      .limit(100);
    headerError = fallbackHeaders.error;
    headerData = fallbackHeaders.data;
  }

  if (headerError) {
    if (process.env.NODE_ENV === "development") {
      console.debug("[billing-queue] header query failed", {
        error: headerError.message,
      });
    }
    return { campaigns: [], error: headerError.message };
  }

  type HeaderRow = {
    id: string;
    document_number: string;
    name: string;
    currency_code: string;
    client: { id: string; name: string; legal_name: string | null } | null;
    brand?: { name: string } | null;
  };

  const headers = (headerData ?? []) as unknown as HeaderRow[];
  const headerIds = headers.map((h) => h.id);

  if (headerIds.length === 0) {
    if (process.env.NODE_ENV === "development") {
      console.debug("[billing-queue] no campaign headers returned");
    }
    return { campaigns: [] };
  }

  const { data: lineRows } = await supabase
    .from("campaign_lines")
    .select("id, campaign_header_id, billing_status, revenue, invoice_id")
    .in("campaign_header_id", headerIds);

  const linesByCampaign = new Map<
    string,
    Array<{ id: string; billing_status: string; revenue: number; invoice_id: string | null }>
  >();
  for (const line of lineRows ?? []) {
    const list = linesByCampaign.get(line.campaign_header_id) ?? [];
    list.push({
      id: line.id,
      billing_status: line.billing_status,
      revenue: Number(line.revenue),
      invoice_id: line.invoice_id,
    });
    linesByCampaign.set(line.campaign_header_id, list);
  }

  const campaigns: CampaignBillingQueueRow[] = [];
  const operationalRowsByCampaign = new Map<string, OperationalBillingRow[]>();
  const seenCampaignIds = new Set<string>();
  let operationalErrors = 0;

  for (const header of headers) {
    if (seenCampaignIds.has(header.id)) continue;
    seenCampaignIds.add(header.id);

    const campaignLines = linesByCampaign.get(header.id) ?? [];
    const { operational_rows, groups, error } = await loadCampaignOperationalBilling(
      supabase,
      header.id
    );

    if (error) {
      operationalErrors += 1;
      if (process.env.NODE_ENV === "development") {
        console.debug("[billing-queue] operational load failed — using legacy rollup", {
          campaignId: header.id,
          campaignName: header.name,
          error,
          lineCount: campaignLines.length,
        });
      }
    }

    const legacyRevenue = error
      ? campaignLines.reduce((s, line) => s + line.revenue, 0)
      : groups.reduce((s, g) => s + g.total_value, 0);
    const legacyInvoiced = error
      ? campaignLines.reduce((s, line) => {
          if (line.invoice_id) return s + line.revenue;
          if (
            ["invoiced", "partially_invoiced", "partially_paid", "paid", "closed"].includes(
              line.billing_status
            )
          ) {
            return s + line.revenue;
          }
          return s;
        }, 0)
      : groups.reduce((s, g) => s + g.invoiced_value, 0);

    if (!error) {
      operationalRowsByCampaign.set(header.id, operational_rows);
    }

    campaigns.push(
      buildCampaignQueueRow({
        campaign_header_id: header.id,
        campaign_document_number: header.document_number,
        campaign_name: header.name,
        client_id: header.client?.id ?? "",
        client_name: header.client?.name ?? "",
        brand_name: header.brand?.name ?? null,
        legal_entity_name: header.client?.legal_name ?? null,
        currency_code: header.currency_code,
        operational_rows: error ? [] : operational_rows,
        legacy_line_revenue: legacyRevenue,
        legacy_invoiced: legacyInvoiced,
      })
    );
  }

  const lineRollups = await loadCampaignInvoiceLineRollups(
    supabase,
    campaigns.map((row) => row.campaign_header_id)
  );

  const syncedCampaigns = campaigns.map((row) => {
    const ops = operationalRowsByCampaign.get(row.campaign_header_id) ?? [];
    const synced = syncCampaignBillingState(ops, row);
    const lineRollup = lineRollups.get(row.campaign_header_id);

    let already_invoiced = synced.already_invoiced;
    let remaining_to_invoice = synced.remaining_to_invoice;
    let billing_status = synced.billing_status;

    if (lineRollup && lineRollup.invoiced_subtotal > 0) {
      const reconciled = reconcileCampaignRollupWithInvoiceLines({
        total_campaign_amount: row.total_campaign_amount,
        achieved_revenue: row.achieved_revenue,
        already_invoiced: row.already_invoiced,
        remaining_to_invoice: row.remaining_to_invoice,
        unachieved_revenue: row.unachieved_revenue,
        invoice_line_invoiced: lineRollup.invoiced_subtotal,
      });

      already_invoiced = Math.max(reconciled.already_invoiced, synced.already_invoiced);
      remaining_to_invoice =
        synced.remaining_to_invoice > 0
          ? synced.remaining_to_invoice
          : reconciled.remaining_to_invoice;
      billing_status =
        reconciled.already_invoiced >= row.achieved_revenue && row.achieved_revenue > 0
          ? ("invoiced" as CampaignLineBillingStatus)
          : reconciled.already_invoiced > 0 || synced.progress.state === "partial"
            ? ("partially_invoiced" as CampaignLineBillingStatus)
            : synced.billing_status;
    }

    return {
      ...row,
      already_invoiced,
      remaining_to_invoice,
      billing_status,
    };
  });

  const queueCampaigns = filterCampaignsWithRemainingInvoiceable(
    syncedCampaigns,
    operationalRowsByCampaign
  );

  if (process.env.NODE_ENV === "development") {
    devLog("[billing-queue] load complete", {
      headerCount: headers.length,
      queueCount: queueCampaigns.length,
      operationalErrors,
      skippedDuplicates: headers.length - syncedCampaigns.length,
      campaignsWithLineItems: lineRollups.size,
    });
  }

  return { campaigns: queueCampaigns };
}
