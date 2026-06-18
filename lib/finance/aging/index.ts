export type {
  AgingBasis,
  AgingReportMode,
} from "@/lib/finance/aging/types";

export {
  AGING_BASIS_LABELS,
  agingBasisForMode,
} from "@/lib/finance/aging/types";

export {
  computeBucketFromDays,
  computeFinanceAgingBucket,
  computeFinanceAgingDays,
  daysSinceDate,
  invoiceOutstanding,
} from "@/lib/finance/aging/compute-bucket";

export {
  ageInvoicesWithBasis,
  buildClientAgingDetailRows,
  buildClientAgingSummaryRows,
  buildFinanceAgingSummary,
  type ClientAgingDetailRow,
  type ClientAgingSummaryRow,
  type FinanceAgedInvoiceRow,
} from "@/lib/finance/aging/aggregate";
