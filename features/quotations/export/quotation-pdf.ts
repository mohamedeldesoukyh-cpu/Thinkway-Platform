import type { HtmlToPdfOptions } from "@/lib/io/vendor-io-pdf";

/** Landscape A4 — matches quotation template (297×210mm ≈ 1123×794px at 96dpi). */
export const QUOTATION_PDF_OPTIONS: HtmlToPdfOptions = {
  width: "297mm",
  height: "210mm",
  printBackground: true,
  preferCSSPageSize: true,
  margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
  viewport: {
    width: 1123,
    height: 794,
    deviceScaleFactor: 1,
  },
};
