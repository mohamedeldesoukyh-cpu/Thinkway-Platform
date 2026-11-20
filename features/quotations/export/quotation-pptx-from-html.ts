import { buildPptxFromPageImages } from "@/lib/export/pptx-page-images";
export { buildPptxFromPageImages, QUOTATION_A4_LANDSCAPE } from "@/lib/export/pptx-page-images";
/**
 * Quotation Showcase / Pitch PPTX — built from the same HTML pages as Preview + PDF.
 * One full-bleed slide image per `.cpage` / `.cover` so PPTX cannot drift from Preview.
 * Invisible hyperlink hotspots restore avatar + publication click-through.
 */
import type { QuotationDocument } from "@/features/quotations/export/quotation-document";
import { buildQuotationHtml } from "@/features/quotations/export/quotation-html";
import { QUOTATION_PDF_OPTIONS } from "@/features/quotations/export/quotation-pdf";
import {
  renderHtmlPagesToImages,
} from "@/lib/io/vendor-io-pdf";
import type { ThinkwayReportLogoSrcs } from "@/lib/reports/document/thinkway-report-logo";

export type BuildQuotationHtmlParityPptxOptions = {
  siteOrigin?: string;
  logoSrcs?: ThinkwayReportLogoSrcs;
  title?: string;
};

export type HtmlParityPptxResult =
  | { ok: true; buffer: Buffer; pageCount: number }
  | { ok: false; error: string };

/**
 * Showcase / Pitch / Showcase Lump Sum / Pitch Lump Sum PPTX —
 * pixel-parity with Preview (and PDF) via Chromium page screenshots.
 */
export async function buildQuotationHtmlParityPptxBuffer(
  doc: QuotationDocument,
  options?: BuildQuotationHtmlParityPptxOptions
): Promise<HtmlParityPptxResult> {
  const html = buildQuotationHtml(doc, {
    siteOrigin: options?.siteOrigin,
    logoSrcs: options?.logoSrcs,
    forPdf: true,
  });
  const shot = await renderHtmlPagesToImages(html, {
    ...QUOTATION_PDF_OPTIONS,
    pageSelector: ".cpage, .cover, .page",
    imageType: "jpeg",
    quality: 88,
    deviceScaleFactor: 1.5,
  });
  if (!shot.ok) {
    return { ok: false, error: shot.error };
  }
  if (!shot.pages.length) {
    return { ok: false, error: "No quotation pages found to render into PPTX" };
  }

  const title =
    options?.title ?? `${doc.serial} — ${doc.name} — Quotation Showcase`;
  const buffer = await buildPptxFromPageImages(shot.pages, title, { widescreen: doc.source === "shortlist" });
  return { ok: true, buffer, pageCount: shot.pages.length };
}
