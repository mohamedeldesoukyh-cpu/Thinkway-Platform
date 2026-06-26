import { cn } from "@/lib/utils";

import {
  STATUS_TONE_MAPS,
  type LegacyStatusTone,
  type SemanticStatusTone,
  type StatusToneDomain,
} from "./status-config";

export type StatusBadgeAppearance = "outline" | "pill" | "ghost" | "filled";

export const STATUS_PILL_BASE_CLASS =
  "inline-flex text-[10px] font-medium capitalize border";

const SEMANTIC_TONE_OUTLINE_CLASS: Record<SemanticStatusTone, string> = {
  neutral: "border-muted-foreground/30 text-muted-foreground",
  success: "border-success/40 bg-success/10 text-success",
  warning: "border-warning/40 bg-warning/10 text-warning",
  destructive: "border-destructive/40 bg-destructive/10 text-destructive",
  foreground: "border-foreground/20 bg-foreground/5 text-foreground",
};

const SEMANTIC_TONE_PILL_CLASS: Record<SemanticStatusTone, string> = {
  neutral: "bg-muted/50 text-muted-foreground border-transparent",
  success: "bg-success/15 text-success border-transparent",
  warning: "bg-warning/15 text-warning border-transparent",
  destructive: "bg-destructive/15 text-destructive border-transparent",
  foreground: "bg-foreground/10 text-foreground border-transparent",
};

const SEMANTIC_TONE_FILLED_CLASS: Record<SemanticStatusTone, string> = {
  neutral: "bg-muted text-muted-foreground border-transparent",
  success: "bg-success/10 text-success border-transparent",
  warning: "bg-warning/10 text-warning border-transparent",
  destructive: "bg-destructive/10 text-destructive border-transparent",
  foreground: "bg-foreground/10 text-foreground border-transparent",
};

const SEMANTIC_TONE_GHOST_CLASS: Record<SemanticStatusTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  destructive: "bg-destructive/10 text-destructive",
  foreground: "bg-foreground/15 text-foreground",
};

const APPEARANCE_CLASS_MAP: Record<
  StatusBadgeAppearance,
  Record<SemanticStatusTone, string>
> = {
  outline: SEMANTIC_TONE_OUTLINE_CLASS,
  pill: SEMANTIC_TONE_PILL_CLASS,
  filled: SEMANTIC_TONE_FILLED_CLASS,
  ghost: SEMANTIC_TONE_GHOST_CLASS,
};

/** Maps legacy status-tone values to semantic tokens. */
export function normalizeLegacyTone(tone: LegacyStatusTone): SemanticStatusTone {
  switch (tone) {
    case "info":
    case "accent":
      return "foreground";
    case "danger":
      return "destructive";
    default:
      return tone;
  }
}

export function resolveStatusTone(
  domain: StatusToneDomain,
  status: string,
  fallback: SemanticStatusTone = "neutral",
): SemanticStatusTone {
  const map = STATUS_TONE_MAPS[domain] as Record<string, SemanticStatusTone>;
  return map[status] ?? fallback;
}

export function resolveStatusBadgeClassName(
  tone: SemanticStatusTone | LegacyStatusTone,
  appearance: StatusBadgeAppearance = "outline",
  className?: string,
  options?: { baseClass?: string },
): string {
  const semanticTone = normalizeLegacyTone(tone as LegacyStatusTone);
  const toneClass = APPEARANCE_CLASS_MAP[appearance][semanticTone];
  return cn(options?.baseClass, toneClass, className);
}

export function buildToneClassMap<T extends string>(
  toneMap: Record<T, SemanticStatusTone>,
  appearance: StatusBadgeAppearance,
  baseClass?: string,
): Record<T, string> {
  return Object.fromEntries(
    Object.entries(toneMap).map(([key, tone]) => [
      key,
      resolveStatusBadgeClassName(tone as SemanticStatusTone, appearance, undefined, {
        baseClass,
      }),
    ]),
  ) as Record<T, string>;
}

export function normalizePortalStatusKey(value: string | null | undefined): string {
  return String(value ?? "pending").toLowerCase();
}

export function formatPortalStatusLabel(normalized: string): string {
  if (normalized.length === 0) return "Pending";
  return normalized
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
