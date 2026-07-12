/** Thinkway Campaign Studio visual tokens — reference presentation palette. */
export const STUDIO_COLORS = {
  blue: "#0057FF",
  blue300: "#3D8BFF",
  navy: "#060810",
  ink: "#0B0F1A",
  muted: "#6B7280",
  lavender: "#EEF2FC",
  green: "#0C9D57",
  purple: "#7C3AED",
  amber: "#D97706",
  pink: "#D6336C",
  line: "rgba(11,15,26,0.08)",
} as const;

export const STUDIO_PRIMARY = STUDIO_COLORS.blue;
export const STUDIO_PRIMARY_HOVER = "#0040CC";
export const STUDIO_SHELL_GRADIENT_END = STUDIO_COLORS.lavender;

/** Shared Tailwind class bundles for consistent Studio chrome. */
export const STUDIO_CLASSES = {
  label: "text-[10px] font-extrabold tracking-[0.6px] uppercase",
  labelSm: "text-[10.5px] font-extrabold tracking-[0.5px] uppercase",
  meta: "text-[11.5px] text-[#6B7280] dark:text-muted-foreground",
  body: "text-[13.5px] leading-relaxed",
  bodySm: "text-[12.5px] leading-relaxed font-semibold",
  primaryText: "text-[#0057FF] dark:text-[#3D8BFF]",
  primaryBg: "bg-[#0057FF]/10",
  primaryBgSubtle: "bg-[#0057FF]/5",
  primaryBorder: "border-[#0B0F1A]/8 dark:border-border",
  primaryBorderStrong: "border-[#0057FF]/30",
  primaryBtn: "bg-[#0057FF] text-white hover:bg-[#0040CC]",
  focusRing:
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0057FF] focus-visible:ring-offset-2",
  focusRingInset:
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0057FF] focus-visible:ring-offset-1",
  card: "rounded-[18px] border border-[#0B0F1A]/8 bg-white shadow-[0_1px_2px_rgba(6,8,16,0.05)] dark:border-border dark:bg-background",
  shell:
    "flex h-[min(900px,85vh)] min-h-0 items-stretch overflow-hidden rounded-[22px] border border-[#0B0F1A]/6 bg-[#EEF2FC] shadow-[0_10px_26px_rgba(0,87,255,0.08),0_2px_6px_rgba(6,8,16,0.05)] dark:border-border dark:bg-background",
  /** Chat embed: grows with section content; scroll is owned by the AI chat thread. */
  shellChat:
    "studio-shell-chat flex w-full min-w-0 flex-row items-start overflow-visible rounded-none border border-[#0B0F1A]/6 border-t-0 bg-[#EEF2FC] shadow-[0_10px_26px_rgba(0,87,255,0.08),0_2px_6px_rgba(6,8,16,0.05)] dark:border-border dark:bg-background",
  scrollCanvas:
    "min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-color:rgba(11,15,26,0.12)_transparent] [scrollbar-width:thin]",
  /** Chat embed: no nested scroll — content flows naturally inside the chat thread. */
  scrollCanvasChat: "flex min-w-0 w-full flex-col overflow-visible",
  mainColumn: "flex min-h-0 min-w-0 flex-1 flex-col self-stretch overflow-hidden",
  /** Chat embed: avoid min-h-0 / overflow-hidden so sticky chrome works against the chat scrollport. */
  mainColumnChat: "flex min-w-0 flex-1 flex-col overflow-visible",
  sectionEnter:
    "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-300",
  scrollTarget: "scroll-mt-[var(--studio-chrome-height,3.25rem)]",
  scrollTargetChat:
    "scroll-mt-[var(--studio-scroll-offset,calc(var(--studio-sticky-top,var(--ai-topbar-measured-height,var(--ai-topbar-height,3.25rem)))+var(--studio-chrome-height,3.25rem)))]",
  canvas: "mx-auto min-w-0 max-w-[1180px] space-y-4 px-4 py-[26px] pb-24 sm:px-8 sm:pb-[100px]",
  canvasChat:
    "studio-chat-scaled mx-auto min-w-0 w-full max-w-none space-y-4 px-4 py-4 pb-6 sm:px-6 sm:py-5",
  sidebarChatInner: "studio-chat-scaled min-h-0",
  statusPill:
    "shrink-0 rounded-full bg-[#0C9D57]/10 px-2.5 py-1 text-[10.5px] font-extrabold tracking-[0.4px] text-[#0C9D57] uppercase",
  cardDesc: "text-[11.5px] text-[#6B7280] dark:text-muted-foreground",
  statGrid: "grid grid-cols-2 gap-3 sm:grid-cols-4",
  statBox:
    "rounded-2xl border border-[#0B0F1A]/8 bg-gradient-to-br from-[#F5F8FF] to-[#EEF2FC] px-[18px] py-4 border-t-[3px] border-t-[#0057FF] dark:border-border dark:from-muted/30 dark:to-muted/10",
  detailGrid: "mt-3.5 grid grid-cols-1 gap-x-6 sm:grid-cols-2",
  detailItem: "border-b border-[#0B0F1A]/8 py-2.5 dark:border-border",
  reasonGrid: "grid grid-cols-1 gap-2.5 sm:grid-cols-2",
  reasonCard:
    "rounded-xl border border-[#EEF1F8] bg-[#FAFBFF] px-4 py-3.5 dark:border-border dark:bg-muted/20",
  conceptGrid: "grid grid-cols-1 gap-3 sm:grid-cols-3",
  conceptCard:
    "rounded-[14px] border border-[#EEF1F8] bg-[#FAFBFF] p-4 dark:border-border dark:bg-muted/20",
  weekGrid: "grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3",
  weekCard:
    "rounded-xl border border-[#EEF1F8] bg-[#FAFBFF] px-[15px] py-[13px] dark:border-border dark:bg-muted/20",
  benchGrid: "grid grid-cols-1 gap-2.5 sm:grid-cols-2",
  benchCard: "rounded-xl border border-[#0B0F1A]/8 px-[15px] py-[13px] dark:border-border",
  quadGrid: "grid grid-cols-1 gap-2.5 sm:grid-cols-2",
  quadCard: "rounded-xl border border-[#0B0F1A]/8 px-[15px] py-[13px] dark:border-border",
  psGrid: "grid grid-cols-2 gap-2.5 sm:grid-cols-4",
  psBox:
    "rounded-xl border border-[#0B0F1A]/8 bg-[#F5F8FF] px-3.5 py-3 dark:border-border dark:bg-muted/20",
  budgetHero:
    "mb-3.5 flex flex-wrap items-center justify-between gap-2.5 rounded-2xl bg-gradient-to-br from-[#0040CC] via-[#0057FF] to-[#7C3AED] px-[26px] py-[22px] text-white",
  budgetRow:
    "flex flex-wrap items-center gap-3 border-b border-[#0B0F1A]/8 py-2.5 last:border-b-0 dark:border-border",
  rationaleBox:
    "mt-2.5 rounded-[10px] border border-[#0C9D57]/18 bg-[#0C9D57]/6 px-3.5 py-2.5 text-xs font-semibold text-[#0C9D57]",
  execBox:
    "rounded-xl border border-[#0C9D57]/18 bg-[#0C9D57]/6 px-[18px] py-4",
  creatorCard:
    "rounded-[14px] border border-[#0B0F1A]/8 p-4 dark:border-border",
  funnelStep:
    "inline-flex items-center gap-1.5 rounded-full border border-[#0C9D57]/20 bg-[#0C9D57]/8 px-3 py-1.5 text-[11.5px] font-bold text-[#0C9D57]",
  funnelResult:
    "mt-3 rounded-xl border border-[#0C9D57]/20 bg-[#0C9D57]/8 px-4 py-3 text-[13.5px] font-bold text-[#0C9D57]",
  mixRow: "mb-2.5 flex items-center gap-3",
  mixBar: "h-2 flex-1 overflow-hidden rounded-lg bg-[#EEF1F8] dark:bg-muted",
  scoreWrap:
    "mb-3.5 flex flex-wrap items-center gap-4 rounded-[14px] border border-[#0B0F1A]/8 bg-gradient-to-br from-[#F5F8FF] to-[#EEF2FC] px-5 py-4 dark:border-border dark:from-muted/30 dark:to-muted/10",
  riskCard: "rounded-xl border border-[#0B0F1A]/8 p-4 dark:border-border",
  oppCard: "mb-2 rounded-xl border border-[#0B0F1A]/8 p-[13px] last:mb-0 dark:border-border",
  showMore:
    "mt-1.5 rounded-xl border border-dashed border-[#0B0F1A]/8 py-3 text-center text-[12.5px] font-bold text-[#6B7280] dark:border-border",
  actBtn:
    "inline-flex items-center gap-1.5 rounded-lg border border-[#0B0F1A]/8 bg-white px-3 py-1.5 text-[11px] font-bold text-[#0B0F1A] transition-colors hover:bg-[#F5F8FF] dark:border-border dark:bg-background dark:text-foreground",
  actBtnApprove:
    "inline-flex items-center gap-1.5 rounded-lg border-0 bg-[#0C9D57] px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-[#0a8a4c]",
  pillTier: "rounded-full bg-[#DDEBFF] px-2 py-0.5 text-[10px] font-extrabold text-[#0057FF]",
  pillFit: "rounded-full bg-[#0C9D57]/10 px-2 py-0.5 text-[10px] font-extrabold text-[#0C9D57]",
  pillAi: "rounded-full bg-[#7C3AED]/10 px-2 py-0.5 text-[10px] font-extrabold text-[#7C3AED]",
  fitTag:
    "rounded-full border border-[#0B0F1A]/8 bg-[#F5F8FF] px-2 py-0.5 text-[9.5px] font-bold text-[#6B7280] dark:border-border",
  tag: "rounded-full bg-[#EEF1F8] px-2 py-0.5 text-[9.5px] font-bold text-[#6B7280] dark:bg-muted",
  minuteItem: "flex gap-3 border-b border-[#0B0F1A]/8 py-3 last:border-b-0 dark:border-border",
  minuteIco:
    "flex size-[26px] shrink-0 items-center justify-center rounded-lg bg-[#7C3AED]/10 text-[#7C3AED]",
  ptable:
    "w-full min-w-[480px] border-collapse text-[12.5px]",
  ptableTh:
    "border-b-2 border-[#0B0F1A] pb-2 pr-2.5 text-left text-[9.5px] font-extrabold tracking-[0.4px] text-[#6B7280] uppercase dark:border-foreground",
  ptableTd: "border-b border-[#0B0F1A]/8 py-2.5 pr-2.5 dark:border-border",
  specialistPill:
    "inline-flex min-w-0 items-center gap-2 rounded-full border border-[#0B0F1A]/8 bg-white px-[13px] py-2 text-[12.5px] font-bold shadow-[0_1px_2px_rgba(6,8,16,0.05)] dark:border-border dark:bg-background",
  specialistPillWorking:
    "inline-flex min-w-0 items-center gap-2 rounded-full border border-violet-300/60 bg-violet-50/80 px-[13px] py-2 text-[12.5px] font-bold shadow-[0_1px_2px_rgba(6,8,16,0.05)] dark:border-violet-800 dark:bg-violet-950/30",
  topChrome:
    "sticky top-0 z-40 flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[#0B0F1A]/8 bg-white/90 px-4 py-2 backdrop-blur-[14px] sm:gap-2.5 sm:px-8 dark:border-border dark:bg-background/90",
  topChromeChat:
    "sticky top-[var(--studio-sticky-top-inset)] z-50 flex w-full shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[#0B0F1A]/8 bg-white/90 px-4 py-2 backdrop-blur-[14px] sm:px-6 dark:border-border dark:bg-background/90",
  sidebarChat:
    "sticky top-[var(--studio-sticky-top-inset)] z-30 max-h-[var(--studio-sidebar-max-height)] shrink-0 self-start overflow-y-auto overscroll-contain",
} as const;

export const STUDIO_TIER_COLORS: Record<string, string> = {
  Celebrity: "#D97706",
  Mega: "#EA580C",
  Macro: "#0057FF",
  Micro: "#0C9D57",
  Mid: "#7C3AED",
  Nano: "#9AA3B2",
};

export const STUDIO_OBJECTIVE_BADGE: Record<string, string> = {
  Awareness: "bg-[#EDE4FF] text-[#7C3AED]",
  Engagement: "bg-[#D6F5E3] text-[#0C9D57]",
  "UGC volume": "bg-[#FEF3D6] text-[#D97706]",
  UGC: "bg-[#FEF3D6] text-[#D97706]",
};
