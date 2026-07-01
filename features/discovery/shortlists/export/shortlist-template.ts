export type ShortlistTemplateVariant = "summary" | "detailed";

export function resolveShortlistTemplate(
  raw: string | null | undefined
): ShortlistTemplateVariant {
  return raw === "detailed" ? "detailed" : "summary";
}

export const SHORTLIST_TEMPLATE_OPTIONS: Array<{
  id: ShortlistTemplateVariant;
  label: string;
  hint: string;
}> = [
  { id: "summary", label: "Summary", hint: "Client roster" },
  { id: "detailed", label: "Detailed", hint: "Full metrics" },
];
