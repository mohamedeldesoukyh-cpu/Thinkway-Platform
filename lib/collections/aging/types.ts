export type AgingBucket = "current" | "1_30" | "31_60" | "61_90" | "90_plus";

export const AGING_BUCKET_ORDER: AgingBucket[] = [
  "current",
  "1_30",
  "31_60",
  "61_90",
  "90_plus",
];

export const AGING_BUCKET_LABELS: Record<AgingBucket, string> = {
  current: "Current",
  "1_30": "1–30 days",
  "31_60": "31–60 days",
  "61_90": "61–90 days",
  "90_plus": "90+ days",
};

export type AgingGroupBy = "invoice" | "client" | "campaign" | "currency";

export type AgedInvoiceInput = {
  id: string;
  document_number?: string;
  client_id: string;
  client_name?: string;
  campaign_header_id?: string | null;
  campaign_name?: string | null;
  currency: string;
  due_date: string | null;
  issue_date?: string | null;
  total: number;
  amount_paid: number;
  collection_status?: string;
};

export type AgingBucketRow = {
  bucket: AgingBucket;
  label: string;
  count: number;
  amount: number;
};

export type AgingSummary = {
  buckets: AgingBucketRow[];
  total_outstanding: number;
  overdue_amount: number;
  current_amount: number;
  invoice_count: number;
};
