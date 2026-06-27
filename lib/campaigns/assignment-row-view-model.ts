import { labelForBillingStatus } from "@/lib/domains/billing/constants";
import type {
  AssignmentDeliverableBillingStatus,
  CampaignLineBillingStatus,
} from "@/lib/domains/campaign/types";
import { LINE_OPERATIONAL_STATUS_LABELS } from "@/lib/campaigns/constants/operational-status";
import type { AssignmentHierarchyGroup } from "@/lib/domains/campaign/assignment-hierarchy-types";
import type { CampaignLineOperationalStatus } from "@/lib/domains/campaign/operational-utils";
import { buildAssignmentDisplayName } from "@/lib/campaigns/assignment-line-naming";
import { coalesceAssignmentRollups } from "@/lib/campaigns/assignment-rollups";
import { effectiveLineOperationalStatusForUi } from "@/lib/campaigns/effective-operational-status";
import {
  enrichRegenerationEligibilityInput,
  isAssignmentInvoiceSelectable,
} from "@/lib/billing/regeneration-eligibility";
import { effectiveAssignmentBillingStatusForUi } from "@/lib/campaigns/assignment-display-status";
import type { AssignmentHierarchyBillingContext } from "@/lib/domains/campaign/assignment-hierarchy-types";
import { buildScopedLineSnapshotFromHierarchy } from "@/lib/operations/io-coverage-scope";
import {
  hasExistingIoCoverage,
  requiresIoRevision,
} from "@/lib/operations/io-coverage";
import { getRemainingRevenue } from "@/lib/billing/partial-invoice-lifecycle";
import { isLineVendorIoGenerateEligible } from "@/lib/io/vendor-io-generate-eligibility";
import { isLineUngenerateIoEligible } from "@/lib/io/vendor-io-ungenerate-eligibility";
import { safeSummarizePostingDates } from "@/lib/campaigns/safe-assignment-dates";
import { platformShortLabel } from "@/lib/campaigns/hierarchy-utils";

export type AssignmentLineMeta = {
  vioEligible: boolean;
  invoiceEligible: boolean;
  reviseVioEligible: boolean;
  ungenerateIoEligible: boolean;
  rowSelectable: boolean;
  remaining: number;
};

export type AssignmentRowViewModel = {
  lineId: string;
  group: AssignmentHierarchyGroup;
  meta: AssignmentLineMeta;
  operationalStatus: CampaignLineOperationalStatus;
  childBillingStatus: AssignmentDeliverableBillingStatus;
  lineBillingStatus: CampaignLineBillingStatus;
  displayName: string;
  platformSummary: string;
  platforms: string[];
  postingSummary: string;
  opsStatusLabel: string;
  billingStatusLabel: string;
  rollups: ReturnType<typeof coalesceAssignmentRollups>;
};

function finiteNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function deriveChildBillingStatus(
  lineBillingStatus: string
): AssignmentDeliverableBillingStatus {
  if (["invoiced", "paid", "closed"].includes(lineBillingStatus)) return "invoiced";
  if (lineBillingStatus === "partially_invoiced") return "partially_invoiced";
  if (lineBillingStatus === "partially_paid") return "partially_collected";
  if (["moved_to_billing", "approved"].includes(lineBillingStatus)) {
    return "ready_to_invoice";
  }
  return "draft";
}

function collectPlatforms(group: AssignmentHierarchyGroup): string[] {
  try {
    const deliverables = Array.isArray(group.deliverables) ? group.deliverables : [];
    return [...new Set(deliverables.map((d) => d.platform).filter(Boolean))];
  } catch {
    return [];
  }
}

function summarizePlatforms(group: AssignmentHierarchyGroup): string {
  try {
    const platforms = collectPlatforms(group);
    if (platforms.length === 0) return group.line.platform_summary ?? "—";
    return platforms.map(platformShortLabel).join(", ");
  } catch {
    return group.line.platform_summary ?? "—";
  }
}

function collectLiveDates(group: AssignmentHierarchyGroup): Array<string | null | undefined> {
  const deliverables = Array.isArray(group.deliverables) ? group.deliverables : [];
  return deliverables.flatMap((d) => {
    const posts = Array.isArray(d.posts) ? d.posts : [];
    if (posts.length > 0) {
      return posts.map((p) => p.live_date);
    }
    return [d.live_date];
  });
}

export function deriveAssignmentLineMeta(
  group: AssignmentHierarchyGroup,
  billingContext?: AssignmentHierarchyBillingContext | null
): AssignmentLineMeta {
  const line = group.line;

  const vioEligible = isLineVendorIoGenerateEligible({
    vendor_io_id: line.vendor_io_id,
    active_vendor_io_id: line.active_vendor_io_id,
    invoice_id: line.invoice_id,
    billing_status: line.billing_status,
    operational_status: line.operational_status,
    influencer_id: line.influencer_id,
    campaign_influencer_id: line.campaign_influencer_id,
  });

  const pricingMode = line.assignment?.pricing_mode ?? "package";
  const hasDeliverableBreakdown = (group.deliverables?.length ?? 0) > 0;
  const remaining = getRemainingRevenue({
    remaining_amount: group.rollups?.remaining_value,
    billable_amount: group.rollups?.revenue ?? line.revenue_before_vat ?? line.revenue,
    invoiced_amount: group.rollups?.invoiced_value,
  });

  const invoiceEligible =
    pricingMode === "per_deliverable" && hasDeliverableBreakdown
      ? false
      : isAssignmentInvoiceSelectable(
          enrichRegenerationEligibilityInput(
            {
              operational_status: line.operational_status,
              vendor_io_id: line.vendor_io_id,
              active_vendor_io_id: line.active_vendor_io_id,
              vendor_io_document_number: line.vendor_io_document_number,
              billing_status: line.billing_status,
              invoice_id: line.invoice_id,
              remaining_amount: remaining,
              billable_amount: group.rollups?.revenue ?? line.revenue_before_vat ?? line.revenue,
              invoiced_amount: group.rollups?.invoiced_value,
            },
            billingContext
          )
        );

  const currentIoSnapshot = buildScopedLineSnapshotFromHierarchy(group, {
    mode: "regenerate",
  });
  const ioBaseline = buildScopedLineSnapshotFromHierarchy(group, {
    mode: "regenerate",
  });

  const reviseVioEligible =
    remaining <= 0 &&
    hasExistingIoCoverage(currentIoSnapshot) &&
    requiresIoRevision(ioBaseline, currentIoSnapshot);
  const ungenerateIoEligible = isLineUngenerateIoEligible({
    vendor_io_id: line.active_vendor_io_id ?? line.vendor_io_id,
    operational_status: line.operational_status ?? "draft",
    invoice_id: line.invoice_id ?? null,
    billing_status: line.billing_status,
  });

  return {
    vioEligible,
    invoiceEligible,
    reviseVioEligible,
    ungenerateIoEligible,
    rowSelectable:
      vioEligible || invoiceEligible || reviseVioEligible || ungenerateIoEligible,
    remaining,
  };
}

export function buildAssignmentRowViewModel(
  group: AssignmentHierarchyGroup,
  billingContext?: AssignmentHierarchyBillingContext | null
): AssignmentRowViewModel {
  const line = group.line;
  const rollups = coalesceAssignmentRollups(line, group.rollups);
  const lineBillingStatus = effectiveAssignmentBillingStatusForUi(line, rollups);
  const operationalStatus = effectiveLineOperationalStatusForUi({
    operational_status: line.operational_status,
    vendor_io_id: line.vendor_io_id,
    billing_status: lineBillingStatus,
    invoice_id: line.invoice_id,
    revenue_locked: line.revenue_locked,
    vendor_assignment_locked: line.vendor_assignment_locked,
    remaining_amount: rollups.remaining_value,
    billable_amount: rollups.revenue,
    invoiced_amount: rollups.invoiced_value,
  });
  const childBillingStatus = deriveChildBillingStatus(lineBillingStatus);
  const deliverables = Array.isArray(group.deliverables) ? group.deliverables : [];

  const displayName =
    buildAssignmentDisplayName(line.influencer_name ?? line.name.split(" — ")[0] ?? line.name, [
      ...deliverables.map((d) => ({
        platform: d.platform,
        deliverable_type: d.deliverable_type,
        posts_count: Array.isArray(d.posts) ? d.posts.length : 0,
      })),
    ]) || line.name;

  return {
    lineId: line.id,
    group,
    meta: deriveAssignmentLineMeta(group, billingContext),
    operationalStatus,
    childBillingStatus,
    displayName,
    platformSummary: summarizePlatforms(group),
    platforms: collectPlatforms(group),
    postingSummary: safeSummarizePostingDates(collectLiveDates(group)),
    opsStatusLabel: LINE_OPERATIONAL_STATUS_LABELS[operationalStatus] ?? operationalStatus,
    lineBillingStatus,
    billingStatusLabel: labelForBillingStatus(lineBillingStatus),
    rollups,
  };
}

export function tryBuildAssignmentRowViewModel(
  group: AssignmentHierarchyGroup,
  context: { campaignId?: string; billingContext?: AssignmentHierarchyBillingContext | null } = {}
): AssignmentRowViewModel | null {
  const lineId = group?.line?.id;
  try {
    return buildAssignmentRowViewModel(group, context.billingContext);
  } catch (error) {
    console.error("[assignment-hierarchy] row view-model failed — skip render", {
      campaignId: context.campaignId,
      lineId,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return null;
  }
}
