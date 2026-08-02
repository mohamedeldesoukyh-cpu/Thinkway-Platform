/**
 * Canonical Change Impact severity taxonomy (product labels).
 * Storage codes remain: critical | high | medium | low | info
 * (DB check constraint — no redesign; labels are the product SSOT for UI/AI/Reporting/Mobile).
 */

import type { ChangeImpactSeverity } from "@/lib/change-impact/types";

/** Product-facing severity — exactly one level per impact. */
export type ChangeImpactSeverityLabel =
  | "Critical"
  | "Major"
  | "Moderate"
  | "Minor"
  | "Informational";

export const CHANGE_IMPACT_SEVERITY_LABEL: Record<
  ChangeImpactSeverity,
  ChangeImpactSeverityLabel
> = {
  critical: "Critical",
  high: "Major",
  medium: "Moderate",
  low: "Minor",
  info: "Informational",
};

export function formatChangeImpactSeverity(
  severity: ChangeImpactSeverity
): ChangeImpactSeverityLabel {
  return CHANGE_IMPACT_SEVERITY_LABEL[severity];
}
