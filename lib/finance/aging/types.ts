import type { AgingBucket } from "@/lib/collections/aging/types";

export type { AgingBucket };

/** Invoice-date aging (days since issue) vs due-date overdue aging (days past due). */
export type AgingBasis = "invoice_date" | "due_date";

export type AgingReportMode = "client" | "overdue";

export function agingBasisForMode(mode: AgingReportMode): AgingBasis {
  return mode === "client" ? "invoice_date" : "due_date";
}

export const AGING_BASIS_LABELS: Record<AgingBasis, string> = {
  invoice_date: "Invoice date",
  due_date: "Due date (days past due)",
};
