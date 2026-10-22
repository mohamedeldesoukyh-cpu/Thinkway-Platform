/** Alternative creator selections for one client presentation, not extra quotation lines. */
export type ProposalOption = { itemIds: string[]; recommended: boolean };
export function parseProposalOptions(raw: string | null | undefined): ProposalOption[] {
  if (!raw) return [];
  if (raw.length > 60000) throw new Error("Proposal options are too large.");
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value) || value.length > 12) throw new Error("Use up to 12 proposal options.");
  return value.map(option => {
    if (!option || !Array.isArray(option.itemIds) || !option.itemIds.length || option.itemIds.length > 500 || option.itemIds.some((id: unknown) => typeof id !== "string" || !/^[a-zA-Z0-9-]{1,80}$/.test(id))) throw new Error("Each proposal option needs valid quotation lines.");
    return { itemIds: [...new Set<string>(option.itemIds)], recommended: option.recommended === true };
  });
}
export function appendProposalOptions(params: URLSearchParams, options?: ProposalOption[]) {
  if (options?.length) params.set("proposals", JSON.stringify(options));
}
