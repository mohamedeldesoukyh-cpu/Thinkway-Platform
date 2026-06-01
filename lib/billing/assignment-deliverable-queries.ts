import type { PostgrestError } from "@supabase/supabase-js";

/** Columns shared by all assignment_deliverables billing reads. */
export const ASSIGNMENT_DELIVERABLE_BILLING_CORE_SELECT = [
  "id",
  "campaign_line_id",
  "sort_order",
  "platform",
  "deliverable_type",
  "quantity",
  "live_date",
  "billable_amount",
  "invoiced_amount",
  "collected_amount",
  "disputed_amount",
  "remaining_amount",
  "billing_status",
  "invoice_line_item_id",
  "locked_at",
  "revenue_before_vat",
  "revenue_vat_percent",
].join(", ");

export const ASSIGNMENT_DELIVERABLE_VAT_EXEMPT_COLUMNS =
  "revenue_vat_exempt, cost_vat_exempt";

export function assignmentDeliverableBillingSelect(includeVatExempt: boolean): string {
  if (includeVatExempt) {
    return `${ASSIGNMENT_DELIVERABLE_BILLING_CORE_SELECT}, ${ASSIGNMENT_DELIVERABLE_VAT_EXEMPT_COLUMNS}`;
  }
  return ASSIGNMENT_DELIVERABLE_BILLING_CORE_SELECT;
}

export function isAssignmentDeliverableColumnMissing(
  error: PostgrestError | null,
  column: string
): boolean {
  if (!error?.message) return false;
  return new RegExp(`${column}|column.*does not exist`, "i").test(error.message);
}

export type AssignmentDeliverableQueryResult<T> = {
  data: T[];
  includesVatExempt: boolean;
  error?: string;
};

/**
 * Reads assignment_deliverables with optional VAT-exempt columns.
 * Falls back when revenue_vat_exempt / cost_vat_exempt are not yet migrated.
 */
export async function queryAssignmentDeliverables<T>(
  run: (select: string, includeVatExempt: boolean) => Promise<{
    data: T[] | null;
    error: PostgrestError | null;
  }>
): Promise<AssignmentDeliverableQueryResult<T>> {
  const primary = await run(assignmentDeliverableBillingSelect(true), true);
  if (!primary.error) {
    return {
      data: primary.data ?? [],
      includesVatExempt: true,
    };
  }

  if (isAssignmentDeliverableColumnMissing(primary.error, "revenue_vat_exempt")) {
    const fallback = await run(assignmentDeliverableBillingSelect(false), false);
    if (fallback.error) {
      return { data: [], includesVatExempt: false, error: fallback.error.message };
    }
    return {
      data: fallback.data ?? [],
      includesVatExempt: false,
    };
  }

  return {
    data: [],
    includesVatExempt: true,
    error: primary.error.message,
  };
}

export function resolveDeliverableVatExempt(
  row: { revenue_vat_exempt?: boolean | null },
  includesVatExempt: boolean
): boolean {
  if (!includesVatExempt) return false;
  return row.revenue_vat_exempt ?? false;
}
