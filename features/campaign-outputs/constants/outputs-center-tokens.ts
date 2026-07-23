/** Campaign Outputs Center — maps to app/thinkway-design-tokens.css */
export const OUTPUTS_REF_SCOPE = "outputs-center-ref";

export const OUTPUTS_SECTION_NAV_HEIGHT = 52;
export const OUTPUTS_GROUP_LABEL_HEIGHT = 38;
export const OUTPUTS_GROUP_LABEL_GAP = 14;
export const OUTPUTS_GROUP_LABEL_STEP =
  OUTPUTS_GROUP_LABEL_HEIGHT + OUTPUTS_GROUP_LABEL_GAP;

export const OUTPUTS_COLORS = {
  canvas: "var(--lavender)",
  border: "var(--tw-border)",
  surface: "var(--surface)",
  ink: "var(--ink)",
  text2: "var(--text-2)",
  muted: "var(--text-3)",
  blue: "var(--blue)",
  blueLight: "var(--blue-light)",
  blueText: "var(--blue-text)",
  green: "var(--green)",
  greenBg: "var(--green-bg)",
  greenText: "var(--green-text)",
  amber: "var(--amber)",
  amberBg: "var(--amber-bg)",
  amberText: "var(--amber-text)",
  purple: "var(--purple)",
  purpleBg: "var(--purple-bg)",
  purpleText: "var(--purple-text)",
} as const;

export const OUTPUTS_BRAND_GRADIENT = "var(--tw-brand-gradient)";

export const OUTPUTS_SECTION_COLORS: Record<string, string> = {
  strategy: "var(--blue)",
  planning: "var(--blue-400)",
  client: "var(--purple)",
  internal: "var(--ink)",
};

/** Legacy Tailwind class map — prefer oc-* CSS classes inside .outputs-center-ref. */
export const OUTPUTS_CLASSES = {
  canvas: OUTPUTS_REF_SCOPE,
  content: "oc-content",
  cardGrid: "oc-card-grid",
  ocard: "oc-ocard",
  ocardTop: "oc-ocard-top",
  ocardActions: "oc-ocard-actions",
  centerHead: "oc-center-head",
  settingsStack: "oc-settings-stack",
  settingRow: "oc-setting-row",
  settingIco: "oc-setting-ico",
  alertBanner: "oc-alert-banner",
  sectionNav: "oc-section-nav",
  groupLabel: "oc-group-label",
  snavPill: "oc-snav-pill",
  snavPillActive: "active",
  aicon: "oc-aicon",
  aiconPrimary: "primary",
  aiconGhost: "ghost-sm",
  fullBtn: "oc-full-btn",
  fullBtnSoon: "soon",
  cornerBadge: "oc-corner-badge",
  metaGrid: "oc-meta-grid",
  metaItem: "oc-meta-item",
  stag: "oc-stag",
  upnextGrid: "oc-upnext-grid",
  upnextCard: "oc-upnext-card",
} as const;
