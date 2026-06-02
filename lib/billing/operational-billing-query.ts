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
import { buildCampaignQueueRow } from "@/lib/billing/campaign-billing-queue";
import type { CampaignBillingQueueRow } from "@/lib/billing/campaign-billing-queue";
import {
  deliverableDisplayLabel,
  rollupAssignmentBilling,
} from "@/lib/billing/deliverable-billing";
import {
  buildPostOperationalRow,
  type OperationalBillingRow,
} from "@/lib/billing/operational-billing-rows";
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
  currency_code: string;
  pricing_mode: string | null;
  revenue: number;
  metadata: Record<string, unknown> | null;
  invoice_id: string | null;
  invoice: { document_number: string } | null;
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
    "id, document_number, name, campaign_header_id, billing_status, currency_code, pricing_mode, revenue, metadata, invoice_id, sort_order, invoice:invoices(document_number)";
  const lineSelectFallback =
    "id, document_number, name, campaign_header_id, billing_status, currency_code, pricing_mode, revenue, metadata, invoice_id, invoice:invoices(document_number)";

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
    return { groups: [], operational_rows: [], error: linesError.message };
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

    for (const deliverable of deliverables) {
      const posts = postsByDeliverable.get(deliverable.id) ?? [];
      const postChildren: OperationalBillingRow[] = posts.map((post) =>
        buildPostOperationalRow(
          post,
          {
            platform: deliverable.platform,
            deliverable_type: deliverable.deliverable_type,
            billing_status: deliverable.billing_status,
          },
          {
            campaign_header_id: campaignId,
            billing_status: line.billing_status,
            invoice_id: line.invoice_id,
            invoice_document_number: line.invoice?.document_number ?? null,
          },
          postLabel(deliverable.platform, deliverable.deliverable_type, post.sequence_number)
        )
      );

      const usePosts = postChildren.length > 0;
      const groupBillable = usePosts
        ? postChildren.reduce((s, p) => s + p.billable_amount, 0)
        : deliverable.billable_amount;
      const groupInvoiced = usePosts
        ? postChildren.reduce((s, p) => s + p.invoiced_amount, 0)
        : deliverable.invoiced_amount;
      const groupRemaining = usePosts
        ? postChildren.reduce((s, p) => s + p.remaining_amount, 0)
        : deliverable.remaining_amount;

      deliverableChildren.push({
        id: deliverable.id,
        kind: "deliverable_group",
        campaign_header_id: campaignId,
        campaign_line_id: line.id,
        assignment_deliverable_id: deliverable.id,
        parent_id: line.id,
        label: deliverable.label,
        document_number: null,
        influencer_name: assignment?.influencer_name ?? null,
        platform: deliverable.platform,
        deliverable_type: deliverable.deliverable_type,
        billable_amount: groupBillable,
        invoiced_amount: groupInvoiced,
        collected_amount: usePosts
          ? postChildren.reduce((s, p) => s + p.collected_amount, 0)
          : deliverable.collected_amount,
        remaining_amount: groupRemaining,
        billing_status: deliverable.billing_status,
        line_billing_status: line.billing_status,
        invoice_id: line.invoice_id,
        invoice_document_number: line.invoice?.document_number ?? null,
        invoice_line_item_id: deliverable.invoice_line_item_id,
        locked_at: deliverable.locked_at,
        is_locked: Boolean(deliverable.locked_at),
        is_invoice_eligible: groupRemaining > 0 && !deliverable.locked_at,
        is_achieved: ["ready_to_invoice", "partially_invoiced", "invoiced"].includes(
          deliverable.billing_status
        ),
        is_legacy_synthetic: false,
        children: postChildren,
      });
    }

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
      invoice_document_number: line.invoice?.document_number ?? null,
      invoice_line_item_id: null,
      locked_at: null,
      is_locked: false,
      is_invoice_eligible: deliverableChildren.some((d) => d.is_invoice_eligible),
      is_achieved: ["approved", "moved_to_billing", "partially_invoiced", "invoiced"].includes(
        line.billing_status
      ),
      is_legacy_synthetic: deliverables.length === 0,
      children: deliverableChildren,
    });
  }

  if (process.env.NODE_ENV === "development") {
    console.debug("[operational-billing-query] loaded", {
      campaignId,
      assignments: operational_rows.length,
      deliverables: deliverableIds.length,
      posts: [...postsByDeliverable.values()].flat().length,
    });
  }

  return { groups, operational_rows };
}

export async function loadBillingCampaignQueue(
  supabase: SupabaseClient
): Promise<{ campaigns: CampaignBillingQueueRow[]; error?: string }> {
  const { data: headers, error: headerError } = await supabase
    .from("campaign_headers")
    .select(
      `
      id, document_number, name, currency_code,
      client:clients(id, name, legal_name),
      brand:brands(name)
    `
    )
    .neq("status", "archived")
    .order("updated_at", { ascending: false })
    .limit(100);

  if (headerError) {
    return { campaigns: [], error: headerError.message };
  }

  const campaigns: CampaignBillingQueueRow[] = [];

  for (const header of headers ?? []) {
    const row = header as unknown as {
      id: string;
      document_number: string;
      name: string;
      currency_code: string;
      client: { id: string; name: string; legal_name: string | null } | null;
      brand: { name: string } | null;
    };

    const { operational_rows, groups, error } = await loadCampaignOperationalBilling(
      supabase,
      row.id
    );

    if (error) continue;

    const legacyRevenue = groups.reduce((s, g) => s + g.total_value, 0);
    const legacyInvoiced = groups.reduce((s, g) => s + g.invoiced_value, 0);

    campaigns.push(
      buildCampaignQueueRow({
        campaign_header_id: row.id,
        campaign_document_number: row.document_number,
        campaign_name: row.name,
        client_id: row.client?.id ?? "",
        client_name: row.client?.name ?? "",
        brand_name: row.brand?.name ?? null,
        legal_entity_name: row.client?.legal_name ?? null,
        currency_code: row.currency_code,
        operational_rows,
        legacy_line_revenue: legacyRevenue,
        legacy_invoiced: legacyInvoiced,
      })
    );
  }

  return { campaigns };
}
