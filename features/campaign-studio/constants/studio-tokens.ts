/** Thinkway Campaign Studio visual tokens — UI-only, not commercial logic. */
export const STUDIO_PRIMARY = "#1D9E75";
export const STUDIO_PRIMARY_HOVER = "#178f69";
export const STUDIO_SHELL_GRADIENT_END = "#fafbff";

/** Shared Tailwind class bundles for consistent Studio chrome. */
export const STUDIO_CLASSES = {
  label: "text-[10px] font-bold tracking-wide uppercase",
  meta: "text-[11px] text-muted-foreground",
  body: "text-sm leading-relaxed",
  primaryText: "text-brand-product",
  primaryBg: "bg-brand-product/10",
  primaryBgSubtle: "bg-brand-product/5",
  primaryBorder: "border-brand-product/30",
  primaryBorderStrong: "border-brand-product/50",
  primaryBtn: "bg-brand-product text-white hover:bg-brand-product/90",
  focusRing:
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-product focus-visible:ring-offset-2",
  focusRingInset:
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-product focus-visible:ring-offset-1",
  card: "rounded-xl border border-border/60 bg-background/90 shadow-sm",
  sectionEnter:
    "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-300",
} as const;
