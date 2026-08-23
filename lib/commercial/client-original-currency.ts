export const SHOW_ORIGINAL_CURRENCY_DEFAULT = false;
export const SHOW_ORIGINAL_CURRENCY_LABEL = "Show original currency";
export const SHOW_ORIGINAL_CURRENCY_META_KEY = "showOriginalCurrency";

export function asMetadataRecord(metadata: unknown): Record<string, unknown> {
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    return { ...(metadata as Record<string, unknown>) };
  }
  return {};
}

export function readShowOriginalCurrency(metadata: unknown): boolean {
  return asMetadataRecord(metadata)[SHOW_ORIGINAL_CURRENCY_META_KEY] === true;
}

export function metadataWithShowOriginalCurrency(
  metadata: unknown,
  value: boolean
): Record<string, unknown> {
  const next = asMetadataRecord(metadata);
  if (value) {
    next[SHOW_ORIGINAL_CURRENCY_META_KEY] = true;
  } else {
    delete next[SHOW_ORIGINAL_CURRENCY_META_KEY];
  }
  return next;
}
