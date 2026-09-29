import {
  QUOTATION_TEMPLATE_OPTIONS,
  appendQuotationExportRevision,
  appendQuotationTemplateParam,
  isCreatorDeckTemplate as isQuotationCreatorDeckTemplate,
  isLumpSumPricingTemplate as isQuotationLumpSumPricingTemplate,
  isPitchTemplate as isQuotationPitchTemplate,
  isShowcaseTemplate as isQuotationShowcaseTemplate,
  resolveQuotationTemplate,
  type QuotationTemplateVariant,
} from "@/features/quotations/export/quotation-template";

/** Same template family as quotations (Preview / PDF / PPTX / Word). */
export type ShortlistTemplateVariant = QuotationTemplateVariant | "creator-list";

export function resolveShortlistTemplate(
  raw: string | null | undefined
): ShortlistTemplateVariant {
  // Pre-parity bookmarks used `summary` for the client roster (quotation lump-sum).
  if (raw === "summary") return "lump-sum";
  if (raw === "creator-list") return "creator-list";
  return resolveQuotationTemplate(raw);
}

/** Creator-deck layouts (showcase + pitch, including lump-sum variants). */
export function isCreatorDeckTemplate(
  template: ShortlistTemplateVariant
): boolean {
  return template === "creator-list" || isQuotationCreatorDeckTemplate(template);
}

export function isPitchTemplate(template: ShortlistTemplateVariant): boolean {
  return template !== "creator-list" && isQuotationPitchTemplate(template);
}

/** @deprecated Use isCreatorDeckTemplate — kept for showcase-only checks. */
export function isShowcaseTemplate(template: ShortlistTemplateVariant): boolean {
  return template !== "creator-list" && isQuotationShowcaseTemplate(template);
}

export function isLumpSumPricingTemplate(
  template: ShortlistTemplateVariant
): boolean {
  return template !== "creator-list" && isQuotationLumpSumPricingTemplate(template);
}

export const SHORTLIST_TEMPLATE_OPTIONS: Array<{ id: ShortlistTemplateVariant; label: string; hint: string }> = [
  ...QUOTATION_TEMPLATE_OPTIONS,
  { id: "creator-list", label: "Creator list", hint: "Portrait cards · HTML / PDF" },
];

/** Append `template` query param when not the default detailed variant. */
export function appendShortlistTemplateParam(
  params: URLSearchParams,
  template: ShortlistTemplateVariant
): void {
  if (template === "creator-list") params.set("template", template);
  else appendQuotationTemplateParam(params, template);
}

/**
 * Bust browser/CDN caches when shortlist data or the shared quotation layout changes.
 * Shortlist Preview/PDF/PPTX now render through quotation templates.
 */
export function appendShortlistExportRevision(
  params: URLSearchParams,
  revision: string | null | undefined
): void {
  appendQuotationExportRevision(params, revision);
}
