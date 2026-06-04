"use client";

import dynamic from "next/dynamic";
import { Component, type ErrorInfo, type ReactNode } from "react";

import type { AssignmentDeliverableHierarchyRow } from "@/features/campaigns/types/assignment-hierarchy";
import type { CampaignLineWorkspace } from "@/features/campaigns/types";

const PARENT_COL_SPAN = 13;

const AssignmentDeliverableRows = dynamic(
  () =>
    import("@/features/campaigns/components/assignment-hierarchy/assignment-deliverable-rows").then(
      (m) => m.AssignmentDeliverableRows
    ),
  {
    ssr: false,
    loading: () => (
      <tr className="bg-muted/10">
        <td colSpan={PARENT_COL_SPAN} className="px-4 py-3 text-xs text-muted-foreground">
          Loading deliverables…
        </td>
      </tr>
    ),
  }
);

type SafeDeliverableBoundaryProps = {
  lineId: string;
  parentColSpan: number;
  children: ReactNode;
};

type SafeDeliverableBoundaryState = { error: Error | null };

class SafeDeliverableBoundary extends Component<
  SafeDeliverableBoundaryProps,
  SafeDeliverableBoundaryState
> {
  state: SafeDeliverableBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): SafeDeliverableBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[Assignments] deliverable rows failed", {
      lineId: this.props.lineId,
      message: error.message,
      componentStack: info.componentStack,
    });
  }

  render() {
    if (this.state.error) {
      return (
        <tr className="bg-destructive/5">
          <td colSpan={this.props.parentColSpan} className="px-4 py-2 text-xs text-destructive">
            Deliverables for this assignment could not render ({this.state.error.message}).
          </td>
        </tr>
      );
    }
    return this.props.children;
  }
}

type AssignmentSafeDeliverableRowsProps = {
  campaignId: string;
  line: CampaignLineWorkspace;
  deliverables: AssignmentDeliverableHierarchyRow[];
  currency: string;
  parentColSpan: number;
};

export function AssignmentSafeDeliverableRows({
  campaignId,
  line,
  deliverables,
  currency,
  parentColSpan,
}: AssignmentSafeDeliverableRowsProps) {
  if (deliverables.length === 0) {
    return (
      <tr className="bg-muted/10">
        <td colSpan={parentColSpan} className="px-6 py-2 text-xs text-muted-foreground">
          No deliverable breakdown for this assignment.
        </td>
      </tr>
    );
  }

  return (
    <SafeDeliverableBoundary lineId={line.id} parentColSpan={parentColSpan}>
      <AssignmentDeliverableRows
        campaignId={campaignId}
        line={line}
        deliverables={deliverables}
        currency={currency}
        selectedIds={new Set()}
        onToggleDeliverable={() => {}}
        showSelection={false}
        parentColSpan={parentColSpan}
      />
    </SafeDeliverableBoundary>
  );
}
