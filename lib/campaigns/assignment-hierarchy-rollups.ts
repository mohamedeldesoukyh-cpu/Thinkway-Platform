import { rollupLineClientCommercial } from "@/lib/assignments/client-billing-commercial";
import { formatMarginPercent } from "@/lib/domains/billing/types";
import type {
  AssignmentDeliverableHierarchyRow,
  AssignmentHierarchyRollups,
  AssignmentPostOperationalRow,
} from "@/lib/domains/campaign/assignment-hierarchy-types";
import type { CampaignLineWorkspace } from "@/lib/domains/campaign/workspace-types";
import type { AssignmentPricingMode } from "@/lib/domains/commercial/types";
import { rollupAssignmentBilling } from "@/lib/billing/deliverable-billing";

function resolveAssignmentPricingMode(line: CampaignLineWorkspace): AssignmentPricingMode {
  return line.assignment?.pricing_mode ?? "package";
}

function lineCommercialInput(line: CampaignLineWorkspace) {
  return {
    revenueBeforeVat: Number(line.revenue_before_vat ?? line.revenue) || 0,
    usageRightsAmount: Number(line.usage_rights_amount ?? 0),
    usageRightsCost: Number(line.usage_rights_cost ?? 0),
    agencyFeePercent: Number(line.agency_fee_percent ?? 0),
    agencyFeeAmount: Number(line.agency_fee_amount ?? 0),
    costBeforeVat: Number(line.cost_before_vat ?? line.cost) || 0,
  };
}

function billingRollupFromDeliverables(
  deliverables: AssignmentDeliverableHierarchyRow[]
): Pick<
  AssignmentHierarchyRollups,
  "invoiced_value" | "remaining_value" | "collected_value"
> {
  const billingRollup = rollupAssignmentBilling(
    deliverables.map((d) => ({
      id: d.id,
      campaign_line_id: d.campaign_line_id,
      sort_order: 0,
      platform: d.platform,
      deliverable_type: d.deliverable_type,
      quantity: d.quantity,
      live_date: d.live_date,
      billable_amount: d.revenue_before_vat,
      invoiced_amount: d.invoiced_amount,
      collected_amount: 0,
      disputed_amount: 0,
      remaining_amount: d.remaining_amount,
      billing_status: d.billing_status,
      invoice_line_item_id: null,
      locked_at: null,
      revenue_before_vat: d.revenue_before_vat,
      revenue_vat_percent: 0,
      revenue_vat_exempt: false,
      label: d.label,
    }))
  );

  return {
    invoiced_value: billingRollup.invoiced_value,
    remaining_value: billingRollup.remaining_value,
    collected_value: billingRollup.collected_value,
  };
}

function shouldUseLineCommercialRollup(
  line: CampaignLineWorkspace,
  deliverables: AssignmentDeliverableHierarchyRow[]
): boolean {
  const pricingMode = resolveAssignmentPricingMode(line);
  if (pricingMode === "package") return true;

  const lineCost = Number(line.cost_before_vat ?? line.cost) || 0;
  if (lineCost <= 0.01) return false;

  const deliverableCost = deliverables.reduce((sum, row) => sum + row.cost_before_vat, 0);
  return deliverableCost < lineCost * 0.9;
}

function applyDistributedCommercialToPosts(
  posts: AssignmentPostOperationalRow[],
  unitRevenue: number,
  unitCost: number
): AssignmentPostOperationalRow[] {
  if (posts.length === 0) return posts;
  return posts.map((post) => ({
    ...post,
    revenue_per_post: unitRevenue,
    cost_per_post: unitCost,
  }));
}

/**
 * Package types keep their own Cost/Ad and Rev/Ad. Extra posts of the same type
 * inherit that type's unit rates for publication/invoice internals only.
 */
export function alignPackageLineCommercialToDeliverables(
  deliverables: AssignmentDeliverableHierarchyRow[],
  line: CampaignLineWorkspace
): AssignmentDeliverableHierarchyRow[] {
  if (deliverables.length === 0) return deliverables;
  if (resolveAssignmentPricingMode(line) !== "package") return deliverables;

  return deliverables.map((row) => ({
    ...row,
    posts: applyDistributedCommercialToPosts(
      row.posts,
      row.unit_revenue,
      row.unit_cost
    ),
  }));
}

export function buildAssignmentHierarchyRollups(
  deliverables: AssignmentDeliverableHierarchyRow[],
  line: CampaignLineWorkspace
): AssignmentHierarchyRollups {
  if (deliverables.length === 0) {
    const commercial = rollupLineClientCommercial(lineCommercialInput(line));
    const revenue = commercial.revenueBeforeVat;
    return {
      deliverable_count: 0,
      revenue,
      cost: commercial.cost,
      gp: commercial.gp,
      margin_percent: commercial.marginPercent,
      invoiced_value: 0,
      remaining_value: revenue,
      collected_value: 0,
    };
  }

  let revenue = deliverables.reduce((sum, row) => sum + row.revenue_before_vat, 0);
  if (revenue <= 0.01) {
    revenue = Number(line.revenue_before_vat ?? line.revenue) || 0;
  }

  const billing = billingRollupFromDeliverables(deliverables);

  if (shouldUseLineCommercialRollup(line, deliverables)) {
    const commercial = rollupLineClientCommercial(lineCommercialInput(line));
    const pricingMode = resolveAssignmentPricingMode(line);
    return {
      deliverable_count: deliverables.length,
      revenue: pricingMode === "package" ? commercial.revenueBeforeVat : revenue,
      cost: commercial.cost,
      gp: commercial.gp,
      margin_percent: commercial.marginPercent,
      ...billing,
    };
  }

  const usageRights = deliverables.reduce((sum, row) => sum + (row.usage_rights_amount ?? 0), 0);
  const usageRightsCost = deliverables.reduce((sum, row) => sum + (row.usage_rights_cost ?? 0), 0);
  const agencyFees = deliverables.reduce((sum, row) => sum + (row.agency_fee_amount ?? 0), 0);
  const billingBase = revenue + usageRights + agencyFees;
  const cost = deliverables.reduce((sum, row) => sum + row.cost_before_vat, 0);
  const gp = billingBase - cost - usageRightsCost;

  return {
    deliverable_count: deliverables.length,
    revenue,
    cost,
    gp,
    margin_percent: formatMarginPercent(billingBase, gp),
    ...billing,
  };
}
