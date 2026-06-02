import type { BudgetVersionStatus } from "@/lib/planning/types/budget";

export function budgetVersionIsReadOnly(status: BudgetVersionStatus): boolean {
  return status === "approved" || status === "locked" || status === "archived";
}

export function budgetVersionAllowsLineWrite(status: BudgetVersionStatus): boolean {
  return status === "draft" || status === "submitted";
}

export const BUDGET_STATUS_LABELS: Record<BudgetVersionStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
  locked: "Locked",
  archived: "Archived",
};
