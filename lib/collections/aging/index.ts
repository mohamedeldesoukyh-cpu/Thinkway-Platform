export type {
  AgingBucket,
  AgingBucketRow,
  AgingGroupBy,
  AgingSummary,
  AgedInvoiceInput,
} from "@/lib/collections/aging/types";

export {
  AGING_BUCKET_LABELS,
  AGING_BUCKET_ORDER,
} from "@/lib/collections/aging/types";

export {
  computeAgingBucket,
  daysPastDue,
  invoiceOutstanding,
  bucketSeverity,
} from "@/lib/collections/aging/compute-bucket";

export {
  ageInvoices,
  buildAgingSummary,
  groupAgingBy,
  type AgedInvoiceRow,
} from "@/lib/collections/aging/aggregate-aging";
