import type { AssignmentAudienceView } from "@/lib/campaigns/assignment-audience-view";

export type AssignmentsGridGates = {
  enableRowStyling: boolean;
  enablePills: boolean;
  usePreparedData: boolean;
  enableExpansion: boolean;
  enableDeliverableChildren: boolean;
  enableCheckboxes: boolean;
  enableFooter: boolean;
  enableEditActions: boolean;
  showInternalFinancials: boolean;
  showInternalBilling: boolean;
  showLineDocumentNumber: boolean;
};

const FULL_GATES: AssignmentsGridGates = {
  enableRowStyling: true,
  enablePills: true,
  usePreparedData: true,
  enableExpansion: true,
  enableDeliverableChildren: true,
  enableCheckboxes: true,
  enableFooter: true,
  enableEditActions: true,
  showInternalFinancials: true,
  showInternalBilling: true,
  showLineDocumentNumber: true,
};

const CLIENT_GATES: AssignmentsGridGates = {
  enableRowStyling: false,
  enablePills: true,
  usePreparedData: true,
  enableExpansion: false,
  enableDeliverableChildren: false,
  enableCheckboxes: false,
  enableFooter: false,
  enableEditActions: false,
  showInternalFinancials: false,
  showInternalBilling: false,
  showLineDocumentNumber: false,
};

/** Operational assignments grid — full internal or client-safe preview. */
export function resolveAssignmentsGridGates(
  audienceView: AssignmentAudienceView = "internal"
): AssignmentsGridGates {
  return audienceView === "client" ? CLIENT_GATES : FULL_GATES;
}
