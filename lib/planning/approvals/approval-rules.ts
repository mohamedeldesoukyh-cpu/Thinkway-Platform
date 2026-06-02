import type { BudgetVersionStatus } from "@/lib/planning/types/budget";

const ALLOWED_TRANSITIONS: Record<BudgetVersionStatus, BudgetVersionStatus[]> = {
  draft: ["submitted", "archived"],
  submitted: ["approved", "draft", "archived"],
  approved: ["locked", "archived"],
  locked: ["archived"],
  archived: [],
};

export function canTransitionBudgetStatus(
  from: BudgetVersionStatus,
  to: BudgetVersionStatus
): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Audit-ready action labels for planning workflow. */
export const PLANNING_AUDIT_ACTIONS = {
  version_created: "version_created",
  version_submitted: "version_submitted",
  version_approved: "version_approved",
  version_locked: "version_locked",
  version_archived: "version_archived",
  line_updated: "line_updated",
  forecast_updated: "forecast_updated",
} as const;
