export type ShortlistTemplateVariant = "summary" | "detailed" | "showcase";

export function resolveShortlistTemplate(
  raw: string | null | undefined
): ShortlistTemplateVariant {
  if (raw === "detailed") return "detailed";
  if (raw === "showcase") return "showcase";
  return "summary";
}

export function isShowcaseTemplate(template: ShortlistTemplateVariant): boolean {
  return template === "showcase";
}

export const SHORTLIST_TEMPLATE_OPTIONS: Array<{
  id: ShortlistTemplateVariant;
  label: string;
  hint: string;
}> = [
  { id: "showcase", label: "Showcase", hint: "Creator deck" },
  { id: "summary", label: "Summary", hint: "Client roster" },
  { id: "detailed", label: "Detailed", hint: "Full metrics" },
];

/** Append `template` query param when not the default summary variant. */
export function appendShortlistTemplateParam(
  params: URLSearchParams,
  template: ShortlistTemplateVariant
): void {
  if (template === "summary") {
    params.delete("template");
  } else {
    params.set("template", template);
  }
}

/** Bust browser/CDN caches when shortlist header fields change. */
export function appendShortlistExportRevision(
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
