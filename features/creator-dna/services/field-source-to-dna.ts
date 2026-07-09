/**
 * Maps enrichment field_sources to Creator DNA DnaSource values.
 */

import type { FieldSource } from "@/lib/creator-enrichment/types";
import type { DnaSource } from "../types";

export function fieldSourceToDnaSource(source: FieldSource | undefined): DnaSource {
  switch (source) {
    case "manual":
    case "imported":
      return "manual";
    case "apify":
    case "actual":
    case "forecast":
      return "ipl";
    default:
      return "manual";
  }
}

export function resolveFieldDnaSource(
  field: string,
  fieldSources: Record<string, FieldSource> | null | undefined,
  fallback: DnaSource = "manual"
): DnaSource {
  const mapped = fieldSources?.[field];
  if (!mapped) return fallback;
  return fieldSourceToDnaSource(mapped);
}
