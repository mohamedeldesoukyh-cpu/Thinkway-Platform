import { z } from "zod";

import { parseCompactCount } from "@/lib/social/parse-compact-count";

/**
 * Accept raw numbers, numeric strings, and compact social counts (1.1K / 2M).
 * Empty / invalid → null so Zod never receives NaN.
 */
export function coerceOptionalMetricNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? value : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (!/\d/.test(trimmed)) return null;
    return parseCompactCount(trimmed);
  }
  return null;
}

export const optionalMetricNumberSchema = z.preprocess(
  coerceOptionalMetricNumber,
  z.number().min(0).nullable()
);
