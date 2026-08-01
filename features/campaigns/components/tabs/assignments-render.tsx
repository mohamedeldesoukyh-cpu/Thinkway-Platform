"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";

import type {
  AssignmentBillingGroup,
  CampaignOperationalBillingDetail,
} from "@/features/billing/types";
import type { AssignmentHierarchy } from "@/features/campaigns/types/assignment-hierarchy";
import type { CampaignPoSummary, CampaignWorkspace } from "@/features/campaigns/types";
import { logAssignmentsStage } from "@/lib/campaigns/assignments-render-log";

const CampaignLinesTabInner = dynamic(
  () =>
    import("@/features/campaigns/components/tabs/campaign-lines-tab-inner").then(
      (m) => m.CampaignLinesTabInner
    ),
  { ssr: false }
);

type AssignmentsRenderProps = {
  workspace: CampaignWorkspace;
  po: CampaignPoSummary;
  currencyOptions: { value: string; label: string }[];
  assignmentHierarchy: AssignmentHierarchy;
  billingGroups: AssignmentBillingGroup[];
  operationalBilling: CampaignOperationalBillingDetail | null;
  initialFocusLineId?: string | null;
};

export function AssignmentsRender({
  workspace,
  po,
  currencyOptions,
  assignmentHierarchy,
  billingGroups,
  operationalBilling,
  initialFocusLineId = null,
}: AssignmentsRenderProps) {
  useEffect(() => {
    logAssignmentsStage("assignments render", {
      campaignId: workspace.id,
      groups: assignmentHierarchy.groups?.length ?? 0,
    });
  }, [workspace.id, assignmentHierarchy.groups?.length]);

  return (
    <CampaignLinesTabInner
      workspace={workspace}
      po={po}
      currencyOptions={currencyOptions}
      assignmentHierarchy={assignmentHierarchy}
      billingGroups={billingGroups}
      operationalBilling={operationalBilling}
      initialFocusLineId={initialFocusLineId}
    />
  );
}
