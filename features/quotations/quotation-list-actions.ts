import type { QuotationListRow } from "./types";

export type QuotationListActionKey = "archive";

export type QuotationListActionDef = {
  key: QuotationListActionKey;
  label: string;
  show: (row: Pick<QuotationListRow, "is_archived" | "status">) => boolean;
  destructive?: boolean;
};

export const QUOTATION_LIST_ACTIONS: QuotationListActionDef[] = [
  {
    key: "archive",
    label: "Archive",
    show: (row) => !row.is_archived && row.status !== "archived",
    destructive: true,
  },
];

export function actionsForQuotationRow(
  row: Pick<QuotationListRow, "is_archived" | "status">,
  defs: QuotationListActionDef[] = QUOTATION_LIST_ACTIONS
): QuotationListActionDef[] {
  return defs.filter((action) => action.show(row));
}

export function resolveBulkQuotationActions(
  rows: Array<Pick<QuotationListRow, "is_archived" | "status">>,
  defs: QuotationListActionDef[] = QUOTATION_LIST_ACTIONS
): QuotationListActionDef[] {
  if (rows.length === 0) return [];
  return defs.filter((action) => rows.every((row) => action.show(row)));
}
