"use client";

import { Component, useEffect, type ErrorInfo, type ReactNode } from "react";

import { AssignmentsJsonFallback } from "@/features/campaigns/components/tabs/assignments-json-fallback";
import { AssignmentsRender } from "@/features/campaigns/components/tabs/assignments-render";
import type {
  AssignmentBillingGroup,
  CampaignOperationalBillingDetail,
} from "@/features/billing/types";
import type { AssignmentHierarchy } from "@/features/campaigns/types/assignment-hierarchy";
import type { CampaignPoSummary, CampaignWorkspace } from "@/features/campaigns/types";
import {
  assignmentsRenderStageSourceLabel,
  getAssignmentsRenderStage,
  type AssignmentsRenderStage,
  type AssignmentsRenderStageSource,
} from "@/lib/campaigns/assignments-render-stage";
import { logAssignmentsStage } from "@/lib/campaigns/assignments-render-log";

type AssignmentsTabBoundaryProps = {
  hierarchy: AssignmentHierarchy;
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
        <AssignmentsJsonFallback
          hierarchy={this.props.hierarchy}
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
  renderStage?: AssignmentsRenderStage;
  renderStageSource?: AssignmentsRenderStageSource;
  requestedRenderStage?: AssignmentsRenderStage;
  showRenderStageBanner?: boolean;
};

export function CampaignAssignmentsTab({
  renderStage: renderStageProp,
  renderStageSource,
  requestedRenderStage,
  showRenderStageBanner = false,
  ...props
}: CampaignAssignmentsTabProps) {
  const stage = renderStageProp ?? getAssignmentsRenderStage();

  useEffect(() => {
    logAssignmentsStage("tab entry", {
      campaignId: props.workspace.id,
      stage,
      requestedStage: requestedRenderStage,
      stageSource: renderStageSource ?? "client",
      showBanner: showRenderStageBanner,
      groups: props.assignmentHierarchy.groups?.length ?? 0,
    });
  }, [
    props.workspace.id,
    stage,
    requestedRenderStage,
    renderStageSource,
    showRenderStageBanner,
    props.assignmentHierarchy.groups?.length,
  ]);

  return (
    <AssignmentsTabBoundary hierarchy={props.assignmentHierarchy}>
      <AssignmentsRender
        {...props}
        renderStage={stage}
        renderStageSource={renderStageSource}
        requestedRenderStage={requestedRenderStage}
        showRenderStageBanner={showRenderStageBanner}
      />
    </AssignmentsTabBoundary>
  );
}

/** @deprecated Use CampaignAssignmentsTab */
export const CampaignLinesTab = CampaignAssignmentsTab;
