import type { QuotationDetail, QuotationItemRow } from "@/lib/domains/commercial/quotation-detail-types";
import { shouldIncludeItemInLiveTotals } from "@/lib/quotations/quotation-collapse-package";

const BLOCKED_QUOTATION_STATUSES = new Set(["cancelled", "archived", "rejected"]);

export function quotationItemsForClient(items: QuotationItemRow[]): QuotationItemRow[] {
  return items.filter(
    (item) =>
      (item.option_number == null || item.option_number === 1) &&
      shouldIncludeItemInLiveTotals(item, items)
  );
}

export function shortlistReviewBlockers(input: {
  header: { status: string; is_archived: boolean; name: string };
  clientLabel: string | null;
  brandName: string | null;
  items: Array<{ id: string; item_status?: string | null }>;
  selectedItemIds?: string[];
}): string[] {
  const blockers: string[] = [];
  if (input.header.is_archived) blockers.push("Archived shortlists cannot be sent to the client.");
  if (input.header.status === "cancelled") blockers.push("Cancelled shortlists cannot be sent to the client.");
  const eligible = input.items.filter((item) => item.item_status !== "cancelled");
  if (eligible.length === 0) blockers.push("Select at least one creator to send to the client.");
  if (input.selectedItemIds?.length) {
    const known = new Set(eligible.map((item) => item.id));
    const missing = input.selectedItemIds.filter((id) => !known.has(id));
    if (missing.length > 0) blockers.push("One or more selected creators are no longer on this shortlist.");
    if (input.selectedItemIds.filter((id) => known.has(id)).length === 0) {
      blockers.push("Select at least one creator to send to the client.");
    }
  }
  if (!input.clientLabel && !input.brandName && !input.header.name.trim()) {
    blockers.push("Add a client, brand, or shortlist name before sending to the client.");
  }
  return blockers;
}

export function quotationReviewBlockers(
  detail: Pick<
    QuotationDetail,
    "status" | "is_archived" | "is_expired" | "items" | "client_name" | "brand_name" | "name"
  >
): string[] {
  const blockers: string[] = [];
  if (detail.is_archived || detail.status === "archived") {
    blockers.push("Archived quotations cannot be sent to the client.");
  }
  if (BLOCKED_QUOTATION_STATUSES.has(detail.status)) {
    blockers.push("This quotation is not current. Use a live quotation.");
  }
  if (detail.is_expired) {
    blockers.push("This quotation has expired. Refresh validity before sending to the client.");
  }
  const items = quotationItemsForClient(detail.items);
  if (items.length === 0) {
    blockers.push("Add client-facing quotation items before sending to the client.");
  }
  if (!detail.client_name && !detail.brand_name && !detail.name.trim()) {
    blockers.push("Add client or brand information before sending to the client.");
  }
  return [...new Set(blockers)];
}
