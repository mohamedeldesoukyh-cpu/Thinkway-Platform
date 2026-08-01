/**
 * Campaign business states for Business Process Navigation.
 * Presentation-only — does not change workflow engines or DB enums.
 */

export type BusinessState =
  | "draft"
  | "ready"
  | "waiting"
  | "in_progress"
  | "needs_attention"
  | "blocked"
  | "completed"
  | "closed";

export type StageEnforcement = "none" | "soft" | "hard";

export function businessStateLabel(state: BusinessState): string {
  switch (state) {
    case "draft":
      return "Draft";
    case "ready":
      return "Ready";
    case "waiting":
      return "Waiting";
    case "in_progress":
      return "In Progress";
    case "needs_attention":
      return "Needs Attention";
    case "blocked":
      return "Blocked";
    case "completed":
      return "Completed";
    case "closed":
      return "Closed";
    default:
      return state;
  }
}

export function waitingStateLabel(party: string): string {
  if (!party || party === "None") return "Waiting";
  return `Waiting ${party}`;
}
