/** Campaign / IO cancellation display — serial retained, never deleted. */
export type CancellationMark = "active" | "cancelled" | "void";

export const CANCELLED_DISPLAY_CLASS =
  "font-bold uppercase text-destructive tracking-wide";

export function isCancelledMark(status: string): boolean {
  return status === "cancelled";
}

export function campaignCancellationBlockedReason(input: {
  has_posted_invoice: boolean;
  has_active_collections: boolean;
}): string | null {
  if (input.has_posted_invoice) {
    return "Campaign cannot be cancelled while a posted invoice exists.";
  }
  if (input.has_active_collections) {
    return "Campaign cannot be cancelled while active collections exist.";
  }
  return null;
}
