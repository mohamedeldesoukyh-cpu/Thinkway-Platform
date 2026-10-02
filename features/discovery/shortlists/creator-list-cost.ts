/** Presentation-only value: never part of shortlist or quotation pricing. */
export type CreatorListCost = { amount: number | null; visible: boolean; currency: string };
export function readCreatorListCost(metadata: unknown): CreatorListCost {
  const value = metadata && typeof metadata === "object" ? (metadata as Record<string, unknown>).creator_list_cost : null;
  const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    amount: typeof row.amount === "number" && Number.isFinite(row.amount) && row.amount >= 0 ? row.amount : null,
    visible: row.visible === true,
    currency: typeof row.currency === "string" && /^[A-Z]{3}$/.test(row.currency) ? row.currency : "EGP",
  };
}
