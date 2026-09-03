/** Live ad date display and lock rules for assignment child rows. */

import { formatDesignDateRaw } from "@/lib/design/format-design-date";

export function formatLiveAdMonth(liveDate: string | null | undefined): string {
  const formatted = formatDesignDateRaw(liveDate);
  if (!formatted) return "not set";
  const withDay = formatted.match(/^\d{2} ([A-Z][a-z]{2}) (\d{2})/);
  if (withDay) return `${withDay[1]} ${withDay[2]}`;
  return formatted;
}

export function isLiveAdDateLocked(
  liveDate: string | null | undefined,
  lockedAt: string | null | undefined
): boolean {
  return Boolean(liveDate?.trim()) && Boolean(lockedAt);
}

export function canEditLiveAdDate(
  liveDate: string | null | undefined,
  lockedAt: string | null | undefined
): boolean {
  return !isLiveAdDateLocked(liveDate, lockedAt);
}

const INVOICED_BILLING = new Set([
  "invoiced",
  "partially_invoiced",
  "partially_paid",
  "paid",
]);

/** Commercial fields locked — live ad date may still be open until a date is saved. */
export function isDeliverableCommercialLocked(input: {
  locked_at?: string | null;
  billing_status?: string | null;
  invoice_line_item_id?: string | null;
  regeneration_status?: string | null;
}): boolean {
  if (input.regeneration_status === "pending_regeneration") return false;
  if (input.invoice_line_item_id) return true;
  const billing = input.billing_status ?? "draft";
  if (INVOICED_BILLING.has(billing)) return true;
  return Boolean(input.locked_at);
}

/** Invoice lock applies only when a live ad date exists at lock time. */
export function shouldApplyLiveAdDateLockOnInvoice(
  liveDate: string | null | undefined
): boolean {
  return Boolean(liveDate?.trim());
}
