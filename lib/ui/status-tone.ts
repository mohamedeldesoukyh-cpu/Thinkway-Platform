/**
 * Shared tinted "pill" tones for status badges across the system.
 * Matches the HTML design's `.tag-*` style (soft tinted background, no solid fill).
 */
export type StatusTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "accent";

export const STATUS_TONE_CLASS: Record<StatusTone, string> = {
  neutral: "border-muted-foreground/30 text-muted-foreground",
  info: "border-brand-blue/40 bg-brand-blue/10 text-brand-blue",
  success: "border-success/40 bg-success/10 text-success",
  warning: "border-warning/40 bg-warning/10 text-warning",
  danger: "border-destructive/40 bg-destructive/10 text-destructive",
  accent: "border-brand-purple/40 bg-brand-purple/10 text-brand-purple",
};
