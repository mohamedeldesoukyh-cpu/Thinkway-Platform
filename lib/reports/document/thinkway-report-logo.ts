/**
 * Canonical Thinkway logo for HTML/PDF/Word report exports.
 * Uses full-logo PNGs from the Media Plan reference (tw-logo-dark.png / tw-logo-light.png).
 */
export const THINKWAY_LOGO = {
  navy: "#060810",
  blue: "#0057FF",
} as const;

export const THINKWAY_LOGO_PUBLIC_PATHS = {
  /** Full logo for dark backgrounds (cover, closing). */
  dark: "/tw-logo-dark.png",
  /** Full logo for light backgrounds (page headers). */
  light: "/tw-logo-light.png",
} as const;

export type ThinkwayReportLogoVariant = "header" | "cover" | "closing";

export type ThinkwayReportLogoTheme = "dark" | "light";

export type ThinkwayReportLogoSrcs = {
  logoDarkSrc?: string;
  logoLightSrc?: string;
};

export type ThinkwayReportLogoOptions = ThinkwayReportLogoSrcs & {
  variant?: ThinkwayReportLogoVariant;
  theme?: ThinkwayReportLogoTheme;
  /** When no image src is available, show CSS text fallback. */
  showText?: boolean;
  className?: string;
};

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function resolveThinkwayReportLogoSrcs(
  srcs?: ThinkwayReportLogoSrcs
): Required<ThinkwayReportLogoSrcs> {
  return {
    logoDarkSrc:
      srcs?.logoDarkSrc === ""
        ? ""
        : srcs?.logoDarkSrc?.trim() || THINKWAY_LOGO_PUBLIC_PATHS.dark,
    logoLightSrc:
      srcs?.logoLightSrc === ""
        ? ""
        : srcs?.logoLightSrc?.trim() || THINKWAY_LOGO_PUBLIC_PATHS.light,
  };
}

function renderCssLogoText(): string {
  return `<div class="thinkway-report-logo-text">THINK<span>WAY</span></div>`;
}

export function renderThinkwayReportLogoHtml(
  options: ThinkwayReportLogoOptions = {}
): string {
  const variant = options.variant ?? "header";
  const theme = options.theme ?? "dark";
  const showText = options.showText ?? true;
  const extra = options.className?.trim() ?? "";
  const { logoDarkSrc, logoLightSrc } = resolveThinkwayReportLogoSrcs(options);
  const src = theme === "light" ? logoLightSrc : logoDarkSrc;

  const classes = [
    "thinkway-report-logo",
    `thinkway-report-logo--${variant}`,
    `thinkway-report-logo--${theme}`,
    extra,
  ]
    .filter(Boolean)
    .join(" ");

  const content = src
    ? `<img class="thinkway-report-logo-img" src="${escapeAttr(src)}" alt="Thinkway" />`
    : showText
      ? renderCssLogoText()
      : "";

  return `<div class="${classes}">${content}</div>`;
}

/** CSS for reference-aligned full-logo images and text fallback. */
export const THINKWAY_REPORT_LOGO_STYLES = `
  .thinkway-report-logo {
    display: inline-flex;
    align-items: center;
  }

  .thinkway-report-logo-img {
    flex-shrink: 0;
    object-fit: contain;
    display: block;
    width: auto;
  }

  .thinkway-report-logo--header .thinkway-report-logo-img {
    height: 22px;
  }

  .thinkway-report-logo--cover .thinkway-report-logo-img {
    height: 30px;
  }

  .thinkway-report-logo--closing .thinkway-report-logo-img {
    height: 34px;
  }

  .thinkway-report-logo--closing {
    margin-bottom: 36px;
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

  .thinkway-report-logo--header .thinkway-report-logo-text {
    font-size: 16px;
  }

  .thinkway-report-logo--cover .thinkway-report-logo-text,
  .thinkway-report-logo--closing .thinkway-report-logo-text {
    font-size: 22px;
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
export function applyThinkwayLogoToDocumentHtml(
  html: string,
  logoSrcs?: ThinkwayReportLogoSrcs
): string {
  let result = html;

  if (!result.includes("thinkway-report-logo")) {
    result = result.replace("</style>", `${THINKWAY_REPORT_LOGO_STYLES}</style>`);
  }

  result = result
    .replace(
      LOGO_TEXT_PATTERN,
      renderThinkwayReportLogoHtml({ variant: "header", theme: "light", ...logoSrcs })
    )
    .replace(
      COVER_BRAND_PATTERN,
      renderThinkwayReportLogoHtml({ variant: "cover", theme: "dark", ...logoSrcs })
    )
    .replace(
      CLOSING_BRAND_PATTERN,
      renderThinkwayReportLogoHtml({ variant: "closing", theme: "dark", ...logoSrcs })
    )
    .replace(
      CLOSING_LOGO_PATTERN,
      renderThinkwayReportLogoHtml({ variant: "closing", theme: "dark", ...logoSrcs })
    );

  return result;
}
