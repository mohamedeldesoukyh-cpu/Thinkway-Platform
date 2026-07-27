/** Shared Showcase / shortlist paper — A4 landscape (matches quotation canvas). */
export const SHORTLIST_PAGE = {
  widthMm: 297,
  heightMm: 210,
  widthPx: 1123,
  heightPx: 794,
  footerHeightPx: 48,
  /** Horizontal + vertical pad used when measuring content height. */
  padPaddingCss: "36px 48px 20px",
  coverPadPaddingCss: "44px 52px 20px",
} as const;

export const SHORTLIST_PAGE_CSS_VARS = `
  --sl-page-w:297mm;
  --sl-page-h:210mm;
  --sl-page-w-px:${SHORTLIST_PAGE.widthPx}px;
  --sl-page-h-px:${SHORTLIST_PAGE.heightPx}px;
  --sl-footer-h:${SHORTLIST_PAGE.footerHeightPx}px;
`.trim();
