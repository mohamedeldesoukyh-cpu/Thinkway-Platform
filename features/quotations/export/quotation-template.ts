export type QuotationTemplateVariant =
  | "detailed"
  | "lump-sum"
  | "showcase"
  | "showcase-lump-sum";

export function resolveQuotationTemplate(
  raw: string | null | undefined
): QuotationTemplateVariant {
  if (raw === "lump-sum") return "lump-sum";
  if (raw === "showcase") return "showcase";
  if (raw === "showcase-lump-sum") return "showcase-lump-sum";
  return "detailed";
}

/** Showcase creator-deck layouts (with or without lump-sum pricing). */
export function isShowcaseTemplate(
  template: QuotationTemplateVariant
): boolean {
  return template === "showcase" || template === "showcase-lump-sum";
}

/** Document-level lump-sum commercial totals (no per-creator pricing). */
export function isLumpSumPricingTemplate(
  template: QuotationTemplateVariant
): boolean {
  return template === "lump-sum" || template === "showcase-lump-sum";
}

export const QUOTATION_TEMPLATE_OPTIONS: Array<{
  id: QuotationTemplateVariant;
  label: string;
  hint: string;
}> = [
  { id: "detailed", label: "Detailed", hint: "Line items" },
  { id: "lump-sum", label: "Lump sum", hint: "Summary" },
  { id: "showcase", label: "Showcase", hint: "Creator deck" },
  {
    id: "showcase-lump-sum",
    label: "Showcase Lump Sum",
    hint: "Deck + total",
  },
];

/** Append `template` query param when not the default detailed variant. */
export function appendQuotationTemplateParam(
  params: URLSearchParams,
  template: QuotationTemplateVariant
): void {
  if (template === "detailed") {
    params.delete("template");
  } else {
    params.set("template", template);
  }
}

/** Bust browser/CDN caches when quotation header fields (e.g. status) change. */
export function appendQuotationExportRevision(
  params: URLSearchParams,
  revision: string | null | undefined
): void {
  const trimmed = revision?.trim();
  if (trimmed) {
    params.set("v", trimmed);
  } else {
    params.delete("v");
  }
}
