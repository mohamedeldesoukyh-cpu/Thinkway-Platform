import { roundOperationalAmount } from "@/features/campaigns/components/assignment-hierarchy/operational-amount";
import type { OperationalCommercialDraft } from "@/features/campaigns/components/assignment-hierarchy/use-operational-commercial-draft";

export type AssignmentPostMetaDraft = {
  platform: string;
  deliverable_type: string;
  live_date: string;
  revenue_vat_percent: number;
  workflow_status: string;
  billing_status: string;
  notes: string;
};

function amountEq(left: number, right: number): boolean {
  return roundOperationalAmount(left) === roundOperationalAmount(right);
}

function textEq(left: string | null | undefined, right: string | null | undefined): boolean {
  return (left ?? "").trim() === (right ?? "").trim();
}

export function isAssignmentPostDraftDirty(args: {
  commercial: OperationalCommercialDraft;
  baselineCommercial: OperationalCommercialDraft;
  meta: AssignmentPostMetaDraft;
  baselineMeta: AssignmentPostMetaDraft;
  includeCommercial: boolean;
}): boolean {
  const { meta, baselineMeta } = args;
  if (
    meta.platform !== baselineMeta.platform ||
    meta.deliverable_type !== baselineMeta.deliverable_type ||
    textEq(meta.live_date, baselineMeta.live_date) === false ||
    meta.workflow_status !== baselineMeta.workflow_status ||
    meta.billing_status !== baselineMeta.billing_status ||
    textEq(meta.notes, baselineMeta.notes) === false ||
    amountEq(meta.revenue_vat_percent, baselineMeta.revenue_vat_percent) === false
  ) {
    return true;
  }

  if (!args.includeCommercial) return false;

  const { commercial, baselineCommercial } = args;
  return (
    commercial.qty !== baselineCommercial.qty ||
    amountEq(commercial.revPerAd, baselineCommercial.revPerAd) === false ||
    amountEq(commercial.rev, baselineCommercial.rev) === false ||
    amountEq(commercial.costPerAd, baselineCommercial.costPerAd) === false ||
    amountEq(commercial.cost, baselineCommercial.cost) === false
  );
}
