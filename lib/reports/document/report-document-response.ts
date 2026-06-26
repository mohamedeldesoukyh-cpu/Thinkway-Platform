import { NextResponse } from "next/server";

import { createPdfDocumentResponse } from "@/lib/documents/pdf-response";
import { pdfUnavailableMessage, renderHtmlToPdf, type HtmlToPdfOptions } from "@/lib/io/vendor-io-pdf";

export type ReportDocumentFormat = "html" | "pdf" | "xlsx" | "pptx";

export function parseReportDocumentFormat(raw: string | null): ReportDocumentFormat | null {
  if (raw === "html" || raw === "pdf" || raw === "xlsx" || raw === "pptx") return raw;
  return null;
}

export function createHtmlDocumentResponse(
  html: string,
  baseName: string,
  download: boolean
): NextResponse {
  const disposition = download ? "attachment" : "inline";
  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `${disposition}; filename="${baseName}.html"`,
    },
  });
}

export function createXlsxDocumentResponse(
  buffer: Buffer,
  baseName: string,
  download: boolean
): NextResponse {
  const disposition = download ? "attachment" : "inline";
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `${disposition}; filename="${baseName}.xlsx"`,
    },
  });
}

export async function createPdfFromHtmlResponse(
  html: string,
  baseName: string,
  download: boolean,
  pdfOptions?: HtmlToPdfOptions
): Promise<NextResponse> {
  const pdfResult = await renderHtmlToPdf(html, pdfOptions);
  if (!pdfResult.ok) {
    return NextResponse.json(
      { error: pdfUnavailableMessage(pdfResult.error) },
      { status: 503 }
    );
  }
  return createPdfDocumentResponse(pdfResult.buffer, baseName, download);
}

export function createPptxDocumentResponse(
  buffer: Buffer,
  baseName: string,
  download: boolean
): NextResponse {
  const disposition = download ? "attachment" : "inline";
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `${disposition}; filename="${baseName}.pptx"`,
    },
  });
}

export function sanitizeFileNameSegment(value: string): string {
  return value
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 60);
}
