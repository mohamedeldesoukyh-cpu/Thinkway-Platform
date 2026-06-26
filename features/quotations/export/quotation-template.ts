export type QuotationTemplateVariant = "detailed" | "lump-sum";

export function resolveQuotationTemplate(
  raw: string | null | undefined
): QuotationTemplateVariant {
  return raw === "lump-sum" ? "lump-sum" : "detailed";
}

export const QUOTATION_TEMPLATE_OPTIONS: Array<{
  id: QuotationTemplateVariant;
  label: string;
  hint: string;
}> = [
  { id: "detailed", label: "Detailed", hint: "Line items" },
  { id: "lump-sum", label: "Lump sum", hint: "Summary" },
];
