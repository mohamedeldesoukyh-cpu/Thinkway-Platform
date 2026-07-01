/**
 * Canonical Thinkway logo for HTML/PDF/Word report exports.
 * Mirrors components/brand/thinkway-logo.tsx + app/globals.css (.login-v2-logo-*).
 */
export const THINKWAY_LOGO = {
  navy: "#060810",
  blue: "#0057FF",
} as const;

export type ThinkwayReportLogoVariant = "header" | "cover" | "closing";

export type ThinkwayReportLogoTheme = "dark" | "light";

export type ThinkwayReportLogoOptions = {
  variant?: ThinkwayReportLogoVariant;
  theme?: ThinkwayReportLogoTheme;
  showText?: boolean;
  className?: string;
};

export function renderThinkwayReportLogoHtml(
  options: ThinkwayReportLogoOptions = {}
): string {
  const variant = options.variant ?? "header";
  const theme = options.theme ?? "dark";
  const showText = options.showText ?? true;
  const extra = options.className?.trim() ?? "";

  const classes = [
    "thinkway-report-logo",
    `thinkway-report-logo--${variant}`,
    `thinkway-report-logo--${theme}`,
    extra,
  ]
    .filter(Boolean)
    .join(" ");

  const mark = `<div class="thinkway-report-logo-mark" aria-hidden="true"></div>`;
  const text = showText
    ? `<div class="thinkway-report-logo-text">THINK<span>WAY</span></div>`
    : "";

  return `<div class="${classes}">${mark}${text}</div>`;
}

/** CSS for the icon mark + wordmark — safe for Puppeteer PDF and Word HTML export. */
export const THINKWAY_REPORT_LOGO_STYLES = `
  .thinkway-report-logo {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  .thinkway-report-logo-mark {
    position: relative;
    flex-shrink: 0;
    overflow: hidden;
    background: ${THINKWAY_LOGO.navy};
  }

  .thinkway-report-logo-mark::before {
    content: "";
    position: absolute;
    border-radius: 50%;
    background: #fff;
  }

  .thinkway-report-logo-mark::after {
    content: "";
    position: absolute;
    border-radius: 50%;
    background: ${THINKWAY_LOGO.blue};
  }

  .thinkway-report-logo-text {
    font-weight: 800;
    letter-spacing: -0.4px;
    line-height: 1;
    white-space: nowrap;
  }

  .thinkway-report-logo-text span {
    color: ${THINKWAY_LOGO.blue};
  }

  .thinkway-report-logo--header .thinkway-report-logo-mark {
    width: 28px;
    height: 28px;
    border-radius: 7px;
  }
  .thinkway-report-logo--header .thinkway-report-logo-mark::before {
    top: 6px;
    left: 6px;
    width: 8px;
    height: 8px;
  }
  .thinkway-report-logo--header .thinkway-report-logo-mark::after {
    right: 4px;
    bottom: 4px;
    width: 11px;
    height: 11px;
  }
  .thinkway-report-logo--header .thinkway-report-logo-text {
    font-size: 16px;
  }

  .thinkway-report-logo--cover .thinkway-report-logo-mark,
  .thinkway-report-logo--closing .thinkway-report-logo-mark {
    width: 36px;
    height: 36px;
    border-radius: 9px;
  }
  .thinkway-report-logo--cover .thinkway-report-logo-mark::before,
  .thinkway-report-logo--closing .thinkway-report-logo-mark::before {
    top: 7px;
    left: 7px;
    width: 10px;
    height: 10px;
  }
  .thinkway-report-logo--cover .thinkway-report-logo-mark::after,
  .thinkway-report-logo--closing .thinkway-report-logo-mark::after {
    right: 5px;
    bottom: 5px;
    width: 14px;
    height: 14px;
  }
  .thinkway-report-logo--cover .thinkway-report-logo-text,
  .thinkway-report-logo--closing .thinkway-report-logo-text {
    font-size: 22px;
  }
  .thinkway-report-logo--closing {
    margin-bottom: 32px;
  }

  .thinkway-report-logo--dark .thinkway-report-logo-text {
    color: #fff;
  }
  .thinkway-report-logo--light .thinkway-report-logo-text {
    color: ${THINKWAY_LOGO.navy};
  }
`;

const LOGO_TEXT_PATTERN =
  /<div class="logo-text">THINK<span>WAY<\/span><\/div>/g;

const COVER_BRAND_PATTERN =
  /<div class="cover-brand">THINK<span>WAY<\/span><\/div>/g;

const CLOSING_BRAND_PATTERN =
  /<div class="closing-brand">THINK<span>WAY<\/span><\/div>/g;

const CLOSING_LOGO_PATTERN =
  /<div class="closing-logo">THINK<span>WAY<\/span><\/div>/g;

/** Inject logo CSS + replace legacy text-only logo markup in static HTML templates. */
export function applyThinkwayLogoToDocumentHtml(html: string): string {
  let result = html;

  if (!result.includes("thinkway-report-logo")) {
    result = result.replace("</style>", `${THINKWAY_REPORT_LOGO_STYLES}</style>`);
  }

  result = result
    .replace(LOGO_TEXT_PATTERN, renderThinkwayReportLogoHtml({ variant: "header", theme: "dark" }))
    .replace(
      COVER_BRAND_PATTERN,
      renderThinkwayReportLogoHtml({ variant: "cover", theme: "dark" })
    )
    .replace(
      CLOSING_BRAND_PATTERN,
      renderThinkwayReportLogoHtml({ variant: "closing", theme: "dark" })
    )
    .replace(
      CLOSING_LOGO_PATTERN,
      renderThinkwayReportLogoHtml({ variant: "closing", theme: "dark" })
    );

  return result;
}
