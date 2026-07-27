import type { HtmlToPdfOptions } from "@/lib/io/vendor-io-pdf";
import {
  SHORTLIST_PAGINATION_READY_ATTR,
  SHORTLIST_PAGINATION_READY_VALUE,
} from "@/features/discovery/shortlists/templates/shortlist-pagination-engine";

/** Landscape A4 — prints engine-paginated pages (297×210mm ≈ 1123×794px at 96dpi). */
export const SHORTLIST_PDF_OPTIONS: HtmlToPdfOptions = {
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
  waitForDocumentAttribute: {
    name: SHORTLIST_PAGINATION_READY_ATTR,
    value: SHORTLIST_PAGINATION_READY_VALUE,
    timeoutMs: 45_000,
  },
};
