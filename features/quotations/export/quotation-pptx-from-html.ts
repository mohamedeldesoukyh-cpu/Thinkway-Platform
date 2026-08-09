/**
 * Quotation Showcase / Pitch PPTX — built from the same HTML pages as Preview + PDF.
 * One full-bleed slide image per `.cpage` / `.cover` so PPTX cannot drift from Preview.
 */
import type { QuotationDocument } from "@/features/quotations/export/quotation-document";
import { buildQuotationHtml } from "@/features/quotations/export/quotation-html";
import { QUOTATION_PDF_OPTIONS } from "@/features/quotations/export/quotation-pdf";
import {
  renderHtmlPagesToImages,
  type HtmlPageImage,
} from "@/lib/io/vendor-io-pdf";
import type { ThinkwayReportLogoSrcs } from "@/lib/reports/document/thinkway-report-logo";

/** A4 landscape inches — matches quotation HTML `@page { size:297mm 210mm }` and PDF. */
export const QUOTATION_A4_LANDSCAPE = {
  name: "QUOTATION_A4_LANDSCAPE",
  widthIn: 297 / 25.4,
  heightIn: 210 / 25.4,
} as const;

export type BuildQuotationHtmlParityPptxOptions = {
  siteOrigin?: string;
  logoSrcs?: ThinkwayReportLogoSrcs;
  title?: string;
};

export type HtmlParityPptxResult =
  | { ok: true; buffer: Buffer; pageCount: number }
  | { ok: false; error: string };

async function buildPptxFromPageImages(
  pages: HtmlPageImage[],
  title: string
): Promise<Buffer> {
  const PptxGenJS = (await import("pptxgenjs")).default;
  const pptx = new PptxGenJS();
  pptx.defineLayout({
    name: QUOTATION_A4_LANDSCAPE.name,
    width: QUOTATION_A4_LANDSCAPE.widthIn,
    height: QUOTATION_A4_LANDSCAPE.heightIn,
  });
  pptx.layout = QUOTATION_A4_LANDSCAPE.name;
  pptx.author = "Thinkway Platform";
  pptx.company = "Thinkway";
  pptx.title = title;

  for (const page of pages) {
    const slide = pptx.addSlide();
    slide.addImage({
      data: `image/${page.contentType};base64,${page.buffer.toString("base64")}`,
      x: 0,
      y: 0,
      w: QUOTATION_A4_LANDSCAPE.widthIn,
      h: QUOTATION_A4_LANDSCAPE.heightIn,
    });
  }

  return (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
}

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
  const buffer = await buildPptxFromPageImages(shot.pages, title);
  return { ok: true, buffer, pageCount: shot.pages.length };
}
