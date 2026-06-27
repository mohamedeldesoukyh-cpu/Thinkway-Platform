import type { ShortlistStatus } from "@/types/database";

export type ShortlistListActionKey =
  | "submit_for_review"
  | "approve"
  | "return_to_draft"
  | "reopen"
  | "cancel"
  | "archive";

export type ShortlistListActionDef = {
  key: ShortlistListActionKey;
  label: string;
  show: (status: ShortlistStatus) => boolean;
  destructive?: boolean;
};

export const SHORTLIST_LIST_ACTIONS: ShortlistListActionDef[] = [
  {
    key: "submit_for_review",
    label: "Submit for review",
    show: (status) => status === "draft",
  },
  {
    key: "approve",
    label: "Approve",
    show: (status) => status === "under_review",
  },
  {
    key: "return_to_draft",
    label: "Return to draft",
    show: (status) => status === "under_review",
  },
  {
    key: "reopen",
    label: "Reopen",
    show: (status) => status === "cancelled",
  },
  {
    key: "cancel",
    label: "Cancel",
    show: (status) =>
      status === "draft" || status === "under_review" || status === "approved",
    destructive: true,
  },
  {
    key: "archive",
    label: "Archive",
    show: (status) => status !== "archived",
    destructive: true,
  },
];

export function actionsForShortlistStatus(
  status: ShortlistStatus,
  defs: ShortlistListActionDef[] = SHORTLIST_LIST_ACTIONS
): ShortlistListActionDef[] {
  return defs.filter((action) => action.show(status));
}

/** Bulk actions apply only when every selected row satisfies the action predicate. */
export function resolveBulkShortlistActions(
  statuses: ShortlistStatus[],
  defs: ShortlistListActionDef[] = SHORTLIST_LIST_ACTIONS
): ShortlistListActionDef[] {
  if (statuses.length === 0) return [];
  return defs.filter((action) => statuses.every((status) => action.show(status)));
}
