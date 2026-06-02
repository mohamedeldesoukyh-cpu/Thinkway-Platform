import type { AgingBucket } from "@/lib/collections/aging/types";

export function invoiceOutstanding(total: number, amountPaid: number): number {
  return Math.max(0, Number(total) - Number(amountPaid));
}

export function daysPastDue(dueDate: string | null, asOf = new Date()): number {
  if (!dueDate) return 0;
  const due = new Date(`${dueDate}T00:00:00`);
  const today = new Date(asOf);
  today.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - due.getTime()) / 86400000);
}

/** Centralized AR aging bucket from due date and open balance. */
export function computeAgingBucket(
  dueDate: string | null,
  outstanding: number,
  asOf = new Date()
): AgingBucket {
  if (outstanding <= 0) return "current";
  const days = daysPastDue(dueDate, asOf);
  if (days <= 0) return "current";
  if (days <= 30) return "1_30";
  if (days <= 60) return "31_60";
  if (days <= 90) return "61_90";
  return "90_plus";
}

export function bucketSeverity(bucket: AgingBucket): "ok" | "warn" | "danger" {
  if (bucket === "current") return "ok";
  if (bucket === "1_30" || bucket === "31_60") return "warn";
  return "danger";
}
