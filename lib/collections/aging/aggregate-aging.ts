import { roundMoney } from "@/lib/analytics/aggregations/round";
import {
  computeAgingBucket,
  invoiceOutstanding,
} from "@/lib/collections/aging/compute-bucket";
import {
  AGING_BUCKET_LABELS,
  AGING_BUCKET_ORDER,
  type AgedInvoiceInput,
  type AgingBucket,
  type AgingBucketRow,
  type AgingGroupBy,
  type AgingSummary,
} from "@/lib/collections/aging/types";
import { devLog } from "@/lib/platform/logger";

export type AgedInvoiceRow = AgedInvoiceInput & {
  outstanding: number;
  aging_bucket: AgingBucket;
  days_past_due: number;
};

function emptyBuckets(): Map<AgingBucket, AgingBucketRow> {
  const map = new Map<AgingBucket, AgingBucketRow>();
  for (const bucket of AGING_BUCKET_ORDER) {
    map.set(bucket, {
      bucket,
      label: AGING_BUCKET_LABELS[bucket],
      count: 0,
      amount: 0,
    });
  }
  return map;
}

export function ageInvoices(
  invoices: AgedInvoiceInput[],
  asOf = new Date()
): AgedInvoiceRow[] {
  return invoices.map((inv) => {
    const outstanding = invoiceOutstanding(inv.total, inv.amount_paid);
    const days_past_due = outstanding > 0 ? Math.max(0, daysFromDue(inv.due_date, asOf)) : 0;
    return {
      ...inv,
      outstanding,
      aging_bucket: computeAgingBucket(inv.due_date, outstanding, asOf),
      days_past_due,
    };
  });
}

function daysFromDue(dueDate: string | null, asOf: Date): number {
  if (!dueDate) return 0;
  const due = new Date(`${dueDate}T00:00:00`);
  const today = new Date(asOf);
  today.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - due.getTime()) / 86400000);
}

export function buildAgingSummary(invoices: AgedInvoiceInput[]): AgingSummary {
  const buckets = emptyBuckets();
  let total_outstanding = 0;
  let overdue_amount = 0;
  let current_amount = 0;
  let invoice_count = 0;

  for (const inv of invoices) {
    const outstanding = invoiceOutstanding(inv.total, inv.amount_paid);
    if (outstanding <= 0) continue;
    invoice_count += 1;
    total_outstanding = roundMoney(total_outstanding + outstanding);
    const bucket = computeAgingBucket(inv.due_date, outstanding);
    const row = buckets.get(bucket)!;
    row.count += 1;
    row.amount = roundMoney(row.amount + outstanding);
    if (bucket === "current") {
      current_amount = roundMoney(current_amount + outstanding);
    } else {
      overdue_amount = roundMoney(overdue_amount + outstanding);
    }
  }

  if (process.env.NODE_ENV === "development") {
    devLog("[aging-engine] summary", {
      invoices: invoice_count,
      total_outstanding,
    });
  }

  return {
    buckets: AGING_BUCKET_ORDER.map((b) => buckets.get(b)!),
    total_outstanding,
    overdue_amount,
    current_amount,
    invoice_count,
  };
}

export function groupAgingBy(
  invoices: AgedInvoiceInput[],
  groupBy: AgingGroupBy
): { key: string; label: string; summary: AgingSummary }[] {
  const groups = new Map<string, { label: string; items: AgedInvoiceInput[] }>();

  for (const inv of invoices) {
    let key: string;
    let label: string;
    switch (groupBy) {
      case "client":
        key = inv.client_id;
        label = inv.client_name ?? inv.client_id;
        break;
      case "campaign":
        key = inv.campaign_header_id ?? "unassigned";
        label = inv.campaign_name ?? "No campaign";
        break;
      case "currency":
        key = inv.currency;
        label = inv.currency;
        break;
      default:
        key = inv.id;
        label = inv.document_number ?? inv.id;
    }
    const existing = groups.get(key);
    if (existing) {
      existing.items.push(inv);
    } else {
      groups.set(key, { label, items: [inv] });
    }
  }

  return [...groups.entries()]
    .map(([key, { label, items }]) => ({
      key,
      label,
      summary: buildAgingSummary(items),
    }))
    .sort((a, b) => b.summary.total_outstanding - a.summary.total_outstanding);
}
