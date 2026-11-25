import { QUOTATION_PDF_COVER_OVERLAY, QUOTATION_PDF_CLOSING_OVERLAY } from "./quotation-pdf-overlay-images";

/** PDF.js cannot render Chromium's translucent gradient shading. Rasterize
 * only the original veils, retaining the portrait visibility and live text. */
export function applyQuotationListPdfStyles(html: string): string {
  return html.replace("</head>", `<style data-quotation-pdf-backgrounds>
.page--cov .veil{background:url("${QUOTATION_PDF_COVER_OVERLAY}") center/100% 100% no-repeat}
.page--end .veil--end{background:url("${QUOTATION_PDF_CLOSING_OVERLAY}") center/100% 100% no-repeat}
</style></head>`);
}
