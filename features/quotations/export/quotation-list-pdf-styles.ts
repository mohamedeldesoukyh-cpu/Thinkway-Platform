/** Chromium prints these translucent gradients as PDF ShadingType 1, which
 * PDF.js renders as a magenta error layer. A uniform translucent navy overlay
 * keeps the portrait wall, navy background and selectable foreground text. */
export function applyQuotationListPdfStyles(html: string): string {
  return html.replace("</head>", `<style data-quotation-pdf-backgrounds>
.page--cov .veil,.page--end .veil--end{background:rgba(5,4,67,.96)}
</style></head>`);
}
