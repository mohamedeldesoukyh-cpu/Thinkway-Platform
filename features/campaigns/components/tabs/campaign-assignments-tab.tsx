"use client";

import { Component, useEffect, type ErrorInfo, type ReactNode } from "react";

import { AssignmentsTabErrorFallback } from "@/features/campaigns/components/tabs/assignments-tab-error-fallback";
import { AssignmentsRender } from "@/features/campaigns/components/tabs/assignments-render";
import type {
  AssignmentBillingGroup,
  CampaignOperationalBillingDetail,
} from "@/features/billing/types";
import type { AssignmentHierarchy } from "@/features/campaigns/types/assignment-hierarchy";
import type { CampaignPoSummary, CampaignWorkspace } from "@/features/campaigns/types";
import { assignmentHierarchyBoundaryKey } from "@/lib/campaigns/assignment-row-debug";
import { logAssignmentsStage } from "@/lib/campaigns/assignments-render-log";

type AssignmentsTabBoundaryProps = {
  children: ReactNode;
};

type AssignmentsTabBoundaryState = {
  error: Error | null;
};

class AssignmentsTabBoundary extends Component<
  AssignmentsTabBoundaryProps,
  AssignmentsTabBoundaryState
> {
  state: AssignmentsTabBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AssignmentsTabBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const digest =
      "digest" in error ? String((error as Error & { digest?: string }).digest) : undefined;
    console.error("[Assignments] tab boundary", {
      message: error.message,
      digest,
      componentStack: info.componentStack,
    });
  }

  render() {
    if (this.state.error) {
      return (
        <AssignmentsTabErrorFallback
          errorMessage={this.state.error.message}
          digest={
            "digest" in this.state.error
              ? String((this.state.error as Error & { digest?: string }).digest)
              : undefined
          }
        />
      );
    }
    return this.props.children;
  }
}

type CampaignAssignmentsTabProps = {
  workspace: CampaignWorkspace;
  po: CampaignPoSummary;
  currencyOptions: { value: string; label: string }[];
  assignmentHierarchy: AssignmentHierarchy;
  billingGroups: AssignmentBillingGroup[];
  operationalBilling: CampaignOperationalBillingDetail | null;
  /** Deep-link from Decision Center (?line=). */
  initialFocusLineId?: string | null;
};

export function CampaignAssignmentsTab(props: CampaignAssignmentsTabProps) {
  const hierarchyKey = assignmentHierarchyBoundaryKey(props.assignmentHierarchy);

  useEffect(() => {
    logAssignmentsStage("tab entry", {
      campaignId: props.workspace.id,
      groups: props.assignmentHierarchy.groups?.length ?? 0,
      lines: props.workspace.lines?.length ?? 0,
    });
  }, [props.workspace.id, props.assignmentHierarchy.groups?.length, props.workspace.lines?.length]);

  return (
    <AssignmentsTabBoundary key={hierarchyKey}>
      <AssignmentsRender {...props} />
    </AssignmentsTabBoundary>
  );
}

/** @deprecated Use CampaignAssignmentsTab */
export const CampaignLinesTab = CampaignAssignmentsTab;
