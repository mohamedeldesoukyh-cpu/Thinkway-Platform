export type AssignmentAudienceView = "internal" | "client";

export const ASSIGNMENT_AUDIENCE_VIEW_LABELS: Record<AssignmentAudienceView, string> = {
  internal: "Internal view",
  client: "Client view",
};

/** Parent grid column count — keep in sync with AssignmentSafeGrid header cells per view. */
export function assignmentParentColSpan(view: AssignmentAudienceView): number {
  return view === "client" ? 10 : 18;
}

export function isAssignmentAudienceView(value: string): value is AssignmentAudienceView {
  return value === "internal" || value === "client";
}
