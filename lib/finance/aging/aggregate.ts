import { roundMoney } from "@/lib/analytics/aggregations/round";
import type { AgedInvoiceInput } from "@/lib/collections/aging";
import {
  AGING_BUCKET_LABELS,
  AGING_BUCKET_ORDER,
  type AgingBucket,
  type AgingBucketRow,
  type AgingSummary,
} from "@/lib/collections/aging/types";
import {
  computeFinanceAgingBucket,
  computeFinanceAgingDays,
  invoiceOutstanding,
} from "@/lib/finance/aging/compute-bucket";
import type { AgingBasis } from "@/lib/finance/aging/types";

export type FinanceAgedInvoiceRow = AgedInvoiceInput & {
  outstanding: number;
  aging_bucket: AgingBucket;
  days_aged: number;
  aging_basis: AgingBasis;
};

export type ClientAgingSummaryRow = {
  client_id: string;
  client_name: string;
  currency: string;
  total_outstanding: number;
  buckets: Record<AgingBucket, number>;
  invoice_count: number;
};

export type ClientAgingDetailRow = ClientAgingSummaryRow & {
  invoices: FinanceAgedInvoiceRow[];
};

function emptyBucketAmounts(): Record<AgingBucket, number> {
  return {
    current: 0,
    "1_30": 0,
    "31_60": 0,
    "61_90": 0,
    "90_plus": 0,
  };
}

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

export function ageInvoicesWithBasis(
  invoices: AgedInvoiceInput[],
  basis: AgingBasis,
  asOf = new Date()
): FinanceAgedInvoiceRow[] {
  return invoices.map((inv) => {
    const outstanding = invoiceOutstanding(inv.total, inv.amount_paid);
    const days_aged = outstanding > 0 ? computeFinanceAgingDays(inv, basis, asOf) : 0;
    return {
      ...inv,
      outstanding,
      aging_bucket: computeFinanceAgingBucket(inv, outstanding, basis, asOf),
      days_aged,
      aging_basis: basis,
    };
  });
}

export function buildFinanceAgingSummary(invoices: FinanceAgedInvoiceRow[]): AgingSummary {
  const buckets = emptyBuckets();
  let total_outstanding = 0;
  let overdue_amount = 0;
  let current_amount = 0;
  let invoice_count = 0;

  for (const inv of invoices) {
    if (inv.outstanding <= 0) continue;
    invoice_count += 1;
    total_outstanding = roundMoney(total_outstanding + inv.outstanding);
    const row = buckets.get(inv.aging_bucket)!;
    row.count += 1;
    row.amount = roundMoney(row.amount + inv.outstanding);
    if (inv.aging_bucket === "current") {
      current_amount = roundMoney(current_amount + inv.outstanding);
    } else {
      overdue_amount = roundMoney(overdue_amount + inv.outstanding);
    }
  }

  return {
    buckets: AGING_BUCKET_ORDER.map((b) => buckets.get(b)!),
    total_outstanding,
    overdue_amount,
    current_amount,
    invoice_count,
  };
}

function groupKey(clientId: string, currency: string): string {
  return `${clientId}::${currency}`;
}

export function buildClientAgingSummaryRows(
  invoices: FinanceAgedInvoiceRow[]
): ClientAgingSummaryRow[] {
  const groups = new Map<string, ClientAgingSummaryRow>();

  for (const inv of invoices) {
    if (inv.outstanding <= 0) continue;
    const key = groupKey(inv.client_id, inv.currency);
    let row = groups.get(key);
    if (!row) {
      row = {
        client_id: inv.client_id,
        client_name: inv.client_name ?? inv.client_id,
        currency: inv.currency,
        total_outstanding: 0,
        buckets: emptyBucketAmounts(),
        invoice_count: 0,
      };
      groups.set(key, row);
    }
    row.total_outstanding = roundMoney(row.total_outstanding + inv.outstanding);
    row.buckets[inv.aging_bucket] = roundMoney(
      row.buckets[inv.aging_bucket] + inv.outstanding
    );
    row.invoice_count += 1;
  }

  return [...groups.values()].sort((a, b) => b.total_outstanding - a.total_outstanding);
}

export function buildClientAgingDetailRows(
  invoices: FinanceAgedInvoiceRow[]
): ClientAgingDetailRow[] {
  const groups = new Map<string, ClientAgingDetailRow>();

  for (const inv of invoices) {
    if (inv.outstanding <= 0) continue;
    const key = groupKey(inv.client_id, inv.currency);
    let row = groups.get(key);
    if (!row) {
      row = {
        client_id: inv.client_id,
        client_name: inv.client_name ?? inv.client_id,
        currency: inv.currency,
        total_outstanding: 0,
        buckets: emptyBucketAmounts(),
        invoice_count: 0,
        invoices: [],
      };
      groups.set(key, row);
    }
    row.total_outstanding = roundMoney(row.total_outstanding + inv.outstanding);
    row.buckets[inv.aging_bucket] = roundMoney(
      row.buckets[inv.aging_bucket] + inv.outstanding
    );
    row.invoice_count += 1;
    row.invoices.push(inv);
  }

  for (const row of groups.values()) {
    row.invoices.sort((a, b) => b.outstanding - a.outstanding);
  }

  return [...groups.values()].sort((a, b) => b.total_outstanding - a.total_outstanding);
}
