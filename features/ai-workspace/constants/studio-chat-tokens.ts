/** Thinkway Intelligence Studio chat — maps to app/thinkway-design-tokens.css */
export const STUDIO_CHAT_REF_SCOPE = "studio-chat-ref";

export const STUDIO_CHAT_COLORS = {
  navy: "var(--navy)",
  ink: "var(--ink)",
  muted: "var(--text-3)",
  lavender: "var(--lavender)",
  blue: "var(--blue)",
  blueHover: "var(--blue-hover)",
  blue400: "var(--blue-400)",
  blue300: "var(--blue-300)",
  blueLight: "var(--blue-light)",
  blueText: "var(--blue-text)",
  green: "var(--green)",
  greenBg: "var(--green-bg)",
  greenText: "var(--green-text)",
  purpleBg: "var(--purple-bg)",
  purpleText: "var(--purple-text)",
  text2: "var(--text-2)",
  border: "var(--tw-border)",
  surface: "var(--surface)",
  white: "var(--white)",
} as const;

export const STUDIO_CHAT_BRAND_GRADIENT = "var(--tw-brand-gradient)";

/** Scoped class map — prefer sc-* CSS inside .studio-chat-ref */
export const STUDIO_CHAT_CLASSES = {
  root: STUDIO_CHAT_REF_SCOPE,
  shell: "sc-shell",
  sidebar: "sc-sidebar",
  sidebarCollapsed: "collapsed",
  main: "sc-main",
  chatHead: "sc-chat-head",
  chatColumn: "sc-chat-column",
  chatBody: "sc-chat-body",
  welcome: "sc-welcome",
  composerWrap: "sc-composer-wrap",
  composer: "sc-composer",
  composerFoot: "sc-composer-foot",
  convoItem: "sc-convo-item",
  convoItemActive: "active",
  newChatBtn: "sc-new-chat-btn",
  iconBtn: "sc-icon-btn",
  kbd: "sc-kbd",
} as const;
