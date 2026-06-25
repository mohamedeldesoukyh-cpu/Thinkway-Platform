import { DEFAULT_GP_TARGET_PCT } from "@/features/quotations/constants";

export type GpHealthTone = "success" | "warning" | "danger" | "neutral";

export type GpHealthInput = {
  gpValueEgp: number;
  gpPct: number;
  targetPct?: number;
  dangerThresholdPct?: number;
};

/** GP health bands: >= target success, 15–target warning, <15 danger; negative GP is always danger. */
export function resolveGpHealthTone(input: GpHealthInput): GpHealthTone {
  const target = input.targetPct ?? DEFAULT_GP_TARGET_PCT;
  const danger = input.dangerThresholdPct ?? 15;
  if (input.gpValueEgp < 0) return "danger";
  if (input.gpPct >= target) return "success";
  if (input.gpPct >= danger) return "warning";
  return "danger";
}

export const GP_HEALTH_TEXT_CLASS: Record<GpHealthTone, string> = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
  neutral: "text-muted-foreground",
};

export const GP_HEALTH_BG_CLASS: Record<GpHealthTone, string> = {
  success: "bg-success/10 text-success border-success/30",
  warning: "bg-warning/10 text-warning border-warning/30",
  danger: "bg-destructive/10 text-destructive border-destructive/30",
  neutral: "bg-muted text-muted-foreground border-border",
};

export function gpHealthTextClass(input: GpHealthInput): string {
  return GP_HEALTH_TEXT_CLASS[resolveGpHealthTone(input)];
}

export function gpHealthBgClass(input: GpHealthInput): string {
  return GP_HEALTH_BG_CLASS[resolveGpHealthTone(input)];
}

/** Inline CSS color for PDF/HTML exports — uses document semantic variables. */
export function gpHealthExportColor(input: GpHealthInput): string {
  const tone = resolveGpHealthTone(input);
  if (tone === "success") return "var(--success)";
  if (tone === "warning") return "var(--warning)";
  if (tone === "danger") return "var(--destructive)";
  return "var(--muted)";
}
