import { formatMarginPercent } from "@/lib/domains/billing/types";
import type {
  AssignmentDeliverableHierarchyRow,
  AssignmentHierarchy,
  AssignmentHierarchyGroup,
  AssignmentHierarchyRollups,
  AssignmentPostOperationalRow,
} from "@/lib/domains/campaign/assignment-hierarchy-types";
import type { CampaignLineBillingStatus } from "@/lib/domains/campaign/types";
import type { CampaignLineWorkspace } from "@/lib/domains/campaign/workspace-types";
import { coalesceAssignmentRollups } from "@/lib/campaigns/assignment-rollups";
import { effectiveLineOperationalStatusForUi } from "@/lib/campaigns/effective-operational-status";
import { normalizeOperationalStatus } from "@/lib/campaigns/operational-status-utils";

export type SanitizedAssignmentHierarchy = AssignmentHierarchy & {
  skipped_line_ids: string[];
  sanitize_warnings: string[];
};

function finiteNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function sanitizePost(
  post: Partial<AssignmentPostOperationalRow> | null | undefined,
  index: number
): AssignmentPostOperationalRow | null {
  if (!post?.id) return null;
  try {
    return {
      id: String(post.id),
      assignment_deliverable_id: String(post.assignment_deliverable_id ?? ""),
      sequence_number: finiteNumber(post.sequence_number, index + 1),
      label: String(post.label ?? `#${index + 1}`),
      platform: String(post.platform ?? "other"),
      deliverable_type: String(post.deliverable_type ?? "other"),
      deliverable_type_label: String(post.deliverable_type_label ?? "Other"),
      live_date: post.live_date ?? null,
      workflow_status: String(post.workflow_status ?? "draft"),
      notes: post.notes ?? null,
      revenue_per_post: finiteNumber(post.revenue_per_post),
      cost_per_post: finiteNumber(post.cost_per_post),
      revenue_vat_percent: finiteNumber(post.revenue_vat_percent),
      revenue_vat_amount: finiteNumber(post.revenue_vat_amount),
      cost_vat_amount: finiteNumber(post.cost_vat_amount),
      billing_status: (post.billing_status ?? "draft") as AssignmentPostOperationalRow["billing_status"],
      collection_status: post.collection_status ?? null,
      invoice_id: post.invoice_id ?? null,
      invoice_document_number: post.invoice_document_number ?? null,
      payout_status: post.payout_status ?? null,
      is_locked: Boolean(post.is_locked),
    };
  } catch (error) {
    console.error("[assignment-hierarchy] sanitize post failed", {
      postId: post?.id,
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

function sanitizeDeliverable(
  row: Partial<AssignmentDeliverableHierarchyRow> | null | undefined
): AssignmentDeliverableHierarchyRow | null {
  if (!row?.id || !row.campaign_line_id) return null;
  try {
    const rawPosts = Array.isArray(row.posts) ? row.posts : [];
    const seenPostIds = new Set<string>();
    const posts = rawPosts
      .map((p, i) => sanitizePost(p, i))
      .filter((p): p is AssignmentPostOperationalRow => {
        if (p == null) return false;
        if (seenPostIds.has(p.id)) {
          console.warn("[assignment-hierarchy] duplicate post id skipped", {
            deliverableId: row.id,
            postId: p.id,
          });
          return false;
        }
        seenPostIds.add(p.id);
        return true;
      });

    const revenue = finiteNumber(row.revenue_before_vat);
    const cost = finiteNumber(row.cost_before_vat);

    return {
      id: String(row.id),
      campaign_line_id: String(row.campaign_line_id),
      sort_order: finiteNumber(row.sort_order),
      label: String(row.label ?? "Deliverable"),
      platform: String(row.platform ?? "other"),
      deliverable_type: String(row.deliverable_type ?? "other"),
      deliverable_type_label: String(row.deliverable_type_label ?? "Other"),
      quantity: Math.max(1, finiteNumber(row.quantity, 1)),
      unit_cost: finiteNumber(row.unit_cost),
      unit_revenue: finiteNumber(row.unit_revenue),
      live_date: row.live_date ?? null,
      notes: row.notes ?? null,
      revenue_before_vat: revenue,
      usage_rights_amount: finiteNumber(
        (row as { usage_rights_amount?: number }).usage_rights_amount
      ),
      usage_rights_cost: finiteNumber(
        (row as { usage_rights_cost?: number }).usage_rights_cost
      ),
      agency_fee_percent: finiteNumber(
        (row as { agency_fee_percent?: number }).agency_fee_percent
      ),
      agency_fee_amount: finiteNumber(
        (row as { agency_fee_amount?: number }).agency_fee_amount
      ),
      cost_before_vat: cost,
      revenue_vat_percent: finiteNumber(row.revenue_vat_percent),
      revenue_vat_amount: finiteNumber(row.revenue_vat_amount),
      revenue_after_vat: finiteNumber(row.revenue_after_vat, revenue),
      cost_vat_amount: finiteNumber(row.cost_vat_amount),
      billing_status: (row.billing_status ?? "draft") as AssignmentDeliverableHierarchyRow["billing_status"],
      collection_status: row.collection_status ?? null,
      invoice_id: row.invoice_id ?? null,
      invoice_document_number: row.invoice_document_number ?? null,
      payout_status: row.payout_status ?? null,
      workflow_status: String(row.workflow_status ?? "draft"),
      posts,
      remaining_amount: finiteNumber(row.remaining_amount),
      invoiced_amount: finiteNumber(row.invoiced_amount),
      invoice_eligible: Boolean(row.invoice_eligible),
      is_synthetic: Boolean(row.is_synthetic),
      is_locked: Boolean(row.is_locked),
      locked_at: (row as { locked_at?: string | null }).locked_at ?? null,
      live_ad_date_locked: Boolean(
        (row as { live_ad_date_locked?: boolean }).live_ad_date_locked
      ),
    };
  } catch (error) {
    console.error("[assignment-hierarchy] sanitize deliverable failed", {
      deliverableId: row?.id,
      lineId: row?.campaign_line_id,
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

function sanitizeRollups(
  line: CampaignLineWorkspace,
  rollups: AssignmentHierarchyRollups | null | undefined,
  deliverables: AssignmentDeliverableHierarchyRow[]
): AssignmentHierarchyRollups {
  try {
    const base = coalesceAssignmentRollups(line, rollups);
    const margin = finiteNumber(base.margin_percent, formatMarginPercent(base.revenue, base.gp));
    return {
      ...base,
      deliverable_count: Math.max(
        0,
        finiteNumber(base.deliverable_count, deliverables.length || 1)
      ),
      revenue: finiteNumber(base.revenue),
      cost: finiteNumber(base.cost),
      gp: finiteNumber(base.gp),
      margin_percent: Number.isFinite(margin) ? margin : 0,
      invoiced_value: finiteNumber(base.invoiced_value),
      remaining_value: finiteNumber(base.remaining_value),
      collected_value: finiteNumber(base.collected_value),
    };
  } catch (error) {
    console.error("[assignment-hierarchy] sanitize rollups failed", {
      lineId: line.id,
      message: error instanceof Error ? error.message : String(error),
    });
    return coalesceAssignmentRollups(line, null);
  }
}

function resolveEffectiveLineInvoiceId(
  line: Partial<CampaignLineWorkspace>,
  deliverables: AssignmentDeliverableHierarchyRow[]
): string | null {
  if (line.invoice_id) return line.invoice_id;
  const invoiceIds = new Set(
    deliverables.map((d) => d.invoice_id).filter((id): id is string => Boolean(id))
  );
  return invoiceIds.size === 1 ? ([...invoiceIds][0] ?? null) : null;
}

function deriveLineBillingFromDeliverables(
  billing: CampaignLineBillingStatus,
  deliverables: AssignmentDeliverableHierarchyRow[]
): CampaignLineBillingStatus {
  if (deliverables.length === 0) return billing;

  const statuses = deliverables.map((d) => d.billing_status);
  const allInvoiced = statuses.every(
    (status) => status === "invoiced" || status === "collected"
  );
  const allLinkedToInvoice = deliverables.every((d) => Boolean(d.invoice_id));
  const anyInvoiced = statuses.some((status) =>
    ["invoiced", "partially_invoiced", "collected", "partially_collected"].includes(status)
  );
  const anyLinkedToInvoice = deliverables.some((d) => Boolean(d.invoice_id));

  if (allInvoiced && allLinkedToInvoice && billing === "moved_to_billing") {
    return "invoiced";
  }
  if (anyInvoiced && anyLinkedToInvoice && !allInvoiced) {
    if (billing === "moved_to_billing" || billing === "approved") {
      return "partially_invoiced";
    }
  }
  return billing;
}

function normalizeLineBillingForHierarchy(
  line: Partial<CampaignLineWorkspace>,
  deliverables: AssignmentDeliverableHierarchyRow[] = []
): CampaignLineWorkspace["billing_status"] {
  const billing = deriveLineBillingFromDeliverables(
    (line.billing_status ?? "draft") as CampaignLineBillingStatus,
    deliverables
  );
  const effectiveInvoiceId = resolveEffectiveLineInvoiceId(line, deliverables);
  const uiOps = effectiveLineOperationalStatusForUi({
    operational_status: line.operational_status,
    vendor_io_id: line.vendor_io_id,
    billing_status: billing,
    invoice_id: effectiveInvoiceId,
  });
  if (
    !effectiveInvoiceId &&
    (uiOps === "io_generated" || uiOps === "io_revised" || uiOps === "partially_invoiced") &&
    ["invoiced", "paid"].includes(billing)
  ) {
    return "moved_to_billing";
  }
  if (
    line.vendor_io_id &&
    !effectiveInvoiceId &&
    (billing === "draft" || billing === "approved")
  ) {
    return "moved_to_billing";
  }
  if (!line.vendor_io_id && billing === "moved_to_billing") {
    return "approved";
  }
  return billing;
}

function sanitizeLine(
  line: Partial<CampaignLineWorkspace> | null | undefined,
  deliverables: AssignmentDeliverableHierarchyRow[] = []
): CampaignLineWorkspace | null {
  if (!line?.id) return null;
  try {
    const effectiveInvoiceId = resolveEffectiveLineInvoiceId(line, deliverables);
    const uiOps = effectiveLineOperationalStatusForUi({
      operational_status: line.operational_status,
      vendor_io_id: line.vendor_io_id,
      billing_status: line.billing_status,
      invoice_id: effectiveInvoiceId,
    });
    let operational_status = normalizeOperationalStatus(line.operational_status);
    if (
      operational_status === "moved_to_billing" &&
      line.vendor_io_id &&
      !line.invoice_id
    ) {
      operational_status = "io_generated";
    }
    if (operational_status === "reopened" && line.vendor_io_id && !line.invoice_id) {
      operational_status = "io_generated";
    }
    if (uiOps === "io_generated" && operational_status === "reopened") {
      operational_status = "io_generated";
    }
    if (operational_status === "invoiced") {
      operational_status = "locked";
    }
    if (operational_status === "reopened" && line.vendor_io_id) {
      operational_status = "io_revised";
    }

    return {
      ...line,
      id: String(line.id),
      name: String(line.name ?? "Assignment"),
      document_number: line.document_number ?? null,
      operational_status,
      billing_status: normalizeLineBillingForHierarchy(line, deliverables),
      revenue: finiteNumber(line.revenue),
      cost: finiteNumber(line.cost),
      gp: finiteNumber(line.gp),
      margin_percent: finiteNumber(line.margin_percent),
      revenue_before_vat: finiteNumber(line.revenue_before_vat, finiteNumber(line.revenue)),
      usage_rights_amount: finiteNumber(line.usage_rights_amount),
      usage_rights_cost: finiteNumber(line.usage_rights_cost),
      agency_fee_percent: finiteNumber(line.agency_fee_percent),
      agency_fee_amount: finiteNumber(line.agency_fee_amount),
      cost_before_vat: finiteNumber(line.cost_before_vat, finiteNumber(line.cost)),
      cost_received: finiteNumber(line.cost_received),
      cost_received_currency: line.cost_received_currency ?? null,
      currency_code: line.currency_code ?? null,
      active_vendor_io_id: line.active_vendor_io_id ?? null,
      deliverable_count: Math.max(0, finiteNumber(line.deliverable_count, 1)),
      influencer_name: line.influencer_name ?? null,
      influencer_id: line.influencer_id ?? null,
      campaign_influencer_id: line.campaign_influencer_id ?? null,
      vendor_io_id: line.vendor_io_id ?? null,
      vendor_io_document_number: line.vendor_io_document_number ?? null,
      invoice_id: effectiveInvoiceId,
      vendor_payment_status: line.vendor_payment_status ?? null,
      creator_platform_accounts: Array.isArray(line.creator_platform_accounts)
        ? line.creator_platform_accounts
        : [],
      assignment: line.assignment ?? null,
    } as CampaignLineWorkspace;
  } catch (error) {
    console.error("[assignment-hierarchy] sanitize line failed", {
      lineId: line?.id,
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export function sanitizeAssignmentHierarchyGroup(
  group: Partial<AssignmentHierarchyGroup> | null | undefined,
  context: { campaignId?: string } = {}
): AssignmentHierarchyGroup | null {
  const lineId = group?.line?.id;
  try {
    const rawDeliverables = Array.isArray(group?.deliverables) ? group.deliverables : [];
    const seenDeliverableIds = new Set<string>();
    const deliverables = rawDeliverables
      .map((d) => sanitizeDeliverable(d))
      .filter((d): d is AssignmentDeliverableHierarchyRow => {
        if (d == null) return false;
        if (seenDeliverableIds.has(d.id)) {
          console.warn("[assignment-hierarchy] duplicate deliverable id skipped", {
            lineId,
            deliverableId: d.id,
          });
          return false;
        }
        seenDeliverableIds.add(d.id);
        return true;
      });

    const line = sanitizeLine(group?.line, deliverables);
    if (!line) {
      console.error("[assignment-hierarchy] skipping group — missing line", {
        campaignId: context.campaignId,
        lineId,
      });
      return null;
    }

    const rollups = sanitizeRollups(line, group?.rollups, deliverables);

    return { line, deliverables, rollups };
  } catch (error) {
    console.error("[assignment-hierarchy] sanitize group failed — skipping row", {
      campaignId: context.campaignId,
      lineId,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return null;
  }
}

export function sanitizeAssignmentHierarchy(
  hierarchy: AssignmentHierarchy,
  context: { campaignId?: string } = {}
): SanitizedAssignmentHierarchy {
  const skipped_line_ids: string[] = [];
  const sanitize_warnings: string[] = [];
  const groups: AssignmentHierarchyGroup[] = [];

  const rawGroups = Array.isArray(hierarchy.groups) ? hierarchy.groups : [];

  for (const raw of rawGroups) {
    const lineId = raw?.line?.id;
    try {
      const sanitized = sanitizeAssignmentHierarchyGroup(raw, context);
      if (sanitized) {
        groups.push(sanitized);
      } else if (lineId) {
        skipped_line_ids.push(String(lineId));
        sanitize_warnings.push(`Skipped assignment line ${lineId} (sanitize returned null).`);
      }
    } catch (error) {
      const id = lineId ?? "unknown";
      skipped_line_ids.push(String(id));
      sanitize_warnings.push(
        `Skipped assignment line ${id}: ${error instanceof Error ? error.message : String(error)}`
      );
      console.error("[assignment-hierarchy] sanitize group threw — skipping row", {
        campaignId: context.campaignId,
        lineId: id,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    groups,
    currency_code: hierarchy.currency_code ?? "USD",
    billing_context: hierarchy.billing_context,
    load_error: hierarchy.load_error ?? null,
    skipped_line_ids,
    sanitize_warnings,
  };
}
