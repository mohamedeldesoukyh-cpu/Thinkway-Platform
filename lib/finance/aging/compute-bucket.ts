import type { AgingBucket } from "@/lib/collections/aging/types";
import { daysPastDue, invoiceOutstanding } from "@/lib/collections/aging/compute-bucket";

import type { AgingBasis } from "@/lib/finance/aging/types";

export { invoiceOutstanding };

export function daysSinceDate(referenceDate: string | null, asOf = new Date()): number {
  if (!referenceDate) return 0;
  const ref = new Date(`${referenceDate}T00:00:00`);
  const today = new Date(asOf);
  today.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - ref.getTime()) / 86400000);
}

/** Shared bucket thresholds for both invoice-date and due-date aging. */
export function computeBucketFromDays(days: number, outstanding: number): AgingBucket {
  if (outstanding <= 0) return "current";
  if (days <= 0) return "current";
  if (days <= 30) return "1_30";
  if (days <= 60) return "31_60";
  if (days <= 90) return "61_90";
  return "90_plus";
}

export function computeFinanceAgingDays(
  invoice: { issue_date?: string | null; due_date: string | null },
  basis: AgingBasis,
  asOf = new Date()
): number {
  if (basis === "invoice_date") {
    return daysSinceDate(invoice.issue_date ?? invoice.due_date, asOf);
  }
  return daysPastDue(invoice.due_date, asOf);
}

export function computeFinanceAgingBucket(
  invoice: { issue_date?: string | null; due_date: string | null },
  outstanding: number,
  basis: AgingBasis,
  asOf = new Date()
): AgingBucket {
  if (outstanding <= 0) return "current";
  const days = computeFinanceAgingDays(invoice, basis, asOf);
  return computeBucketFromDays(days, outstanding);
}
