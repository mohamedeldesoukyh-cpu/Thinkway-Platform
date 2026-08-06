import { METADATA_USAGE_PERIOD_KEY } from "@/lib/campaigns/constants";

/** Read per-Assignment usage period from line metadata (CIO commercial notes). */
export function readAssignmentUsagePeriod(
  metadata: Record<string, unknown> | null | undefined
): string | null {
  const value = metadata?.[METADATA_USAGE_PERIOD_KEY];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export function writeAssignmentUsagePeriod(
  metadata: Record<string, unknown> | null | undefined,
  usagePeriod: string | null | undefined
): Record<string, unknown> {
  const next = { ...(metadata ?? {}) };
  const trimmed = usagePeriod?.trim() ?? "";
  if (trimmed) {
    next[METADATA_USAGE_PERIOD_KEY] = trimmed;
  } else {
    delete next[METADATA_USAGE_PERIOD_KEY];
  }
  return next;
}
