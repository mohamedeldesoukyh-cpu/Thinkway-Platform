"use client";

import dynamic from "next/dynamic";
import { Component, type ErrorInfo, type ReactNode } from "react";

import {
  AssignmentGridCell,
  AssignmentGridRow,
} from "@/features/campaigns/components/assignment-hierarchy/assignment-grid-cell";
import type { AssignmentGridColumnId } from "@/features/campaigns/components/assignment-hierarchy/assignment-grid-column-layout";
import type { AssignmentDeliverableHierarchyRow } from "@/features/campaigns/types/assignment-hierarchy";
import type { CampaignLineWorkspace } from "@/features/campaigns/types";
import { resolveAssignmentLineCurrency } from "@/lib/campaigns/assignment-line-currency";

const AssignmentDeliverableRows = dynamic(
  () =>
    import("@/features/campaigns/components/assignment-hierarchy/assignment-deliverable-rows").then(
      (m) => m.AssignmentDeliverableRows
    ),
  {
    ssr: false,
    loading: () => (
      <div className="tw-ad px-6 py-3 text-xs text-muted-foreground">Loading deliverables…</div>
    ),
  }
);

type SafeDeliverableBoundaryProps = {
  lineId: string;
  gridCols: string;
  trackCount: number;
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
        <AssignmentGridRow cols={this.props.gridCols} className="tw-r tw-ad">
          <div
            className="px-4 py-2 text-xs text-destructive"
            style={{ gridColumn: `1 / span ${this.props.trackCount}` }}
          >
            Deliverables for this assignment could not render ({this.state.error.message}).
          </div>
        </AssignmentGridRow>
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
  gridCols: string;
  parentTrackIds: readonly AssignmentGridColumnId[];
  selectedIds: Set<string>;
  onToggleDeliverable: (id: string) => void;
  showSelection: boolean;
  showExpandColumn: boolean;
  leadingParentColumnIds?: readonly string[];
  fallbackLeadingWidths?: readonly number[];
  fallbackChildTableWidthPx?: number;
};

export function AssignmentSafeDeliverableRows({
  campaignId,
  line,
  deliverables,
  currency: currencyProp,
  gridCols,
  parentTrackIds,
  selectedIds,
  onToggleDeliverable,
  showSelection,
  showExpandColumn,
  leadingParentColumnIds,
}: AssignmentSafeDeliverableRowsProps) {
  const currency = resolveAssignmentLineCurrency(line) || currencyProp;
  if (deliverables.length === 0) {
    return (
      <AssignmentGridRow cols={gridCols} className="tw-r tw-ad tw-adf">
        {parentTrackIds.map((id, index) => (
          <AssignmentGridCell key={id} columnId={id}>
            {index === 0 ? (
              <span className="text-xs text-muted-foreground">
                No deliverable breakdown for this assignment.
              </span>
            ) : (
              <span />
            )}
          </AssignmentGridCell>
        ))}
      </AssignmentGridRow>
    );
  }

  return (
    <SafeDeliverableBoundary
      lineId={line.id}
      gridCols={gridCols}
      trackCount={parentTrackIds.length}
    >
      <AssignmentDeliverableRows
        campaignId={campaignId}
        line={line}
        deliverables={deliverables}
        currency={currency}
        selectedIds={selectedIds}
        onToggleDeliverable={onToggleDeliverable}
        showSelection={showSelection}
        parentColSpan={parentTrackIds.length}
        showExpandColumn={showExpandColumn}
        leadingParentColumnIds={leadingParentColumnIds}
        gridCols={gridCols}
        parentTrackIds={parentTrackIds}
      />
    </SafeDeliverableBoundary>
  );
}
