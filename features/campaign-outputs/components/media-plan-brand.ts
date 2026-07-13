/**
 * Thinkway Brand Kit (v1.0 · 2026) tokens for Media Plan surfaces.
 * Electric blue signal · deep navy anchor · lavender canvas.
 */
export const MEDIA_PLAN_BRAND = {
  electricBlue: "#0057FF",
  deepNavy: "#060810",
  blue400: "#1A6FFF",
  blue300: "#3D8BFF",
  lavender: "#E8EFFE",
  ink: "#0B0F1A",
  muted: "#6B7280",
  white: "#FFFFFF",
  gradient: "linear-gradient(145deg, #0040CC 0%, #0057FF 35%, #1A6FFF 65%, #0048DD 100%)",
  gradientAccent: "linear-gradient(145deg, #0040CC, #0057FF, #1A6FFF, #0048DD)",
} as const;

/** Distinct ad-type markers — brand blues first, then studio accent complements. */
export const MEDIA_PLAN_AD_TYPE_COLORS = [
  MEDIA_PLAN_BRAND.electricBlue,
  MEDIA_PLAN_BRAND.blue400,
  MEDIA_PLAN_BRAND.blue300,
  "#0040CC",
  "#0048DD",
  "#7C3AED",
  "#0C9D57",
  "#D97706",
  "#D6336C",
  MEDIA_PLAN_BRAND.deepNavy,
] as const;

export const MEDIA_PLAN_DAY_TYPE_COLORS = {
  content: MEDIA_PLAN_BRAND.electricBlue,
  stories: MEDIA_PLAN_BRAND.blue400,
  boost: "#D97706",
  monitoring: MEDIA_PLAN_BRAND.muted,
} as const;
