export type QuotationTemplateVariant =
  | "detailed"
  | "lump-sum"
  | "showcase"
  | "showcase-lump-sum"
  | "pitch"
  | "pitch-lump-sum";

export function resolveQuotationTemplate(
  raw: string | null | undefined
): QuotationTemplateVariant {
  if (raw === "lump-sum") return "lump-sum";
  if (raw === "showcase") return "showcase";
  if (raw === "showcase-lump-sum") return "showcase-lump-sum";
  if (raw === "pitch") return "pitch";
  if (raw === "pitch-lump-sum") return "pitch-lump-sum";
  return "detailed";
}

/** Creator-deck layouts (showcase, lump-sum showcase, pitch). */
export function isCreatorDeckTemplate(
  template: QuotationTemplateVariant
): boolean {
  return (
    template === "showcase" ||
    template === "showcase-lump-sum" ||
    template === "pitch" ||
    template === "pitch-lump-sum"
  );
}

export function isPitchTemplate(template: QuotationTemplateVariant): boolean {
  return template === "pitch" || template === "pitch-lump-sum";
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
  return (
    template === "lump-sum" ||
    template === "showcase-lump-sum" ||
    template === "pitch-lump-sum"
  );
}

export const QUOTATION_TEMPLATE_OPTIONS: Array<{
  id: QuotationTemplateVariant;
  label: string;
  hint: string;
}> = [
  { id: "pitch", label: "Pitch presentation", hint: "Large avatars · deck" },
  {
    id: "pitch-lump-sum",
    label: "Pitch Lump Sum",
    hint: "Pitch deck · total",
  },
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

/**
 * Bump when quotation Preview/PDF/PPTX layout changes must invalidate downloads.
 * Preview HTML is always live; PDF/PPTX URLs previously only changed with
 * quotation `updated_at`, so browsers often reopened an older Downloads file.
 */
export const QUOTATION_EXPORT_LAYOUT_VERSION = "r2-shortlist-parity-20260818";

function deployExportStamp(): string {
  const deployment = process.env.NEXT_PUBLIC_VERCEL_DEPLOYMENT_ID?.trim();
  if (deployment) return deployment.slice(0, 10);
  const sha = process.env.NEXT_PUBLIC_GIT_SHA?.trim();
  if (sha) return sha.slice(0, 8);
  const built = process.env.NEXT_PUBLIC_BUILD_TIMESTAMP?.trim();
  if (built) return built.slice(0, 10);
  return "local";
}

/** Combine quotation data revision + layout/deploy stamp for cache busting. */
export function resolveQuotationExportRevision(
  dataRevision: string | null | undefined
): string {
  const data = dataRevision?.trim() || "0";
  return `${data}__${QUOTATION_EXPORT_LAYOUT_VERSION}__${deployExportStamp()}`;
}

/** Safe fragment for Content-Disposition filenames. */
export function quotationExportFilenameRevision(
  dataRevision: string | null | undefined
): string {
  return resolveQuotationExportRevision(dataRevision)
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

/** Bust browser/CDN caches when quotation data or export layout/deploy changes. */
export function appendQuotationExportRevision(
  params: URLSearchParams,
  revision: string | null | undefined
): void {
  params.set("v", resolveQuotationExportRevision(revision));
}
