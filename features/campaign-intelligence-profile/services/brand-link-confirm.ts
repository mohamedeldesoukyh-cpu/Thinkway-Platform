export type BrandLinkConfirmIntent = "create" | "link" | "continue_without_brand";

export function brandLinkConfirmReady(input: {
  intent: BrandLinkConfirmIntent;
  selectedBrandId: string;
  linkProfileId?: string;
}): boolean {
  if (input.intent === "continue_without_brand") return true;
  if (!input.selectedBrandId.trim()) return false;
  if (input.intent === "link") return Boolean(input.linkProfileId?.trim());
  return true;
}
