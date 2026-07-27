import { NextResponse } from "next/server";

import { buildQuotationDocument } from "@/features/quotations/export/quotation-document";
import {
  embedQuotationDocumentAvatars,
  enrichQuotationDetailForExport,
  resolveQuotationExportSiteOrigin,
} from "@/features/quotations/export/quotation-export-avatars";
import {
  embedQuotationDocumentPublicationShots,
  loadQuotationCreatorPublicationShots,
} from "@/features/quotations/export/quotation-export-publications";
import { buildQuotationExcel } from "@/features/quotations/export/quotation-excel";
import { buildQuotationHtml } from "@/features/quotations/export/quotation-html";
import { QUOTATION_PDF_OPTIONS } from "@/features/quotations/export/quotation-pdf";
import {
  isCreatorDeckTemplate,
  resolveQuotationTemplate,
} from "@/features/quotations/export/quotation-template";
import { resolveThinkwayReportLogoSrcsForExport } from "@/lib/reports/document/thinkway-report-logo-embed";
import { getQuotationDetail } from "@/features/quotations/queries";
import { resolveRateToEgp } from "@/lib/commercial/fx-server";
import { pdfUnavailableMessage, renderHtmlToPdf } from "@/lib/io/vendor-io-pdf";
import { EMBEDDABLE_DOCUMENT_FRAME_HEADERS } from "@/lib/security/embeddable-document-headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Showcase embed + Chromium PDF can exceed 60s with many publication shots. */
export const maxDuration = 120;
export const dynamic = "force-dynamic";

const EXPORT_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  Pragma: "no-cache",
} as const;

function withExportCacheHeaders(
  headers: Record<string, string>,
  options?: { embeddable?: boolean }
): Record<string, string> {
  return {
    ...headers,
    ...EXPORT_CACHE_HEADERS,
    ...(options?.embeddable ? EMBEDDABLE_DOCUMENT_FRAME_HEADERS : {}),
  };
}

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") ?? "preview";
  const download = searchParams.get("download") === "1";
  const template = resolveQuotationTemplate(searchParams.get("template"));

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const detail = await getQuotationDetail(id);
    if (!detail) {
      return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
    }

    const enriched = await enrichQuotationDetailForExport(supabase, detail);
    const publicationShotsByCreatorKey =
      isCreatorDeckTemplate(template) && format !== "excel"
        ? await loadQuotationCreatorPublicationShots(supabase, enriched.items)
        : undefined;
    const displayFxRateToEgp = await resolveRateToEgp(supabase, enriched.currency || "EGP");
    let doc = buildQuotationDocument(enriched, {
      template,
      publicationShotsByCreatorKey,
      displayFxRateToEgp,
    });
    if (format !== "excel") {
      doc = await embedQuotationDocumentAvatars(doc);
      doc = await embedQuotationDocumentPublicationShots(doc);
    }
    const baseName = doc.serial;
    const disposition = download ? "attachment" : "inline";
    const templateSuffix = template === "detailed" ? "" : `-${template}`;
    const siteOrigin = resolveQuotationExportSiteOrigin(
      request.headers.get("x-forwarded-host") ?? request.headers.get("host"),
      request.headers.get("x-forwarded-proto")
    );

    if (format === "excel") {
      const buffer = await buildQuotationExcel(enriched);
      return new NextResponse(buffer as unknown as BodyInit, {
        headers: withExportCacheHeaders({
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${baseName}.xlsx"`,
        }),
      });
    }

    const logoSrcs = format === "pdf" ? resolveThinkwayReportLogoSrcsForExport() : undefined;
    const html = buildQuotationHtml(doc, { siteOrigin, logoSrcs });

    if (format === "word") {
      // Word opens HTML content saved as .doc with full fidelity (no extra deps).
      return new NextResponse(html, {
        headers: withExportCacheHeaders({
          "Content-Type": "application/msword",
          "Content-Disposition": `attachment; filename="${baseName}${templateSuffix}.doc"`,
        }),
      });
    }

    if (format === "pdf") {
      const pdfHtml = buildQuotationHtml(doc, { siteOrigin, logoSrcs, forPdf: true });
      const pdfResult = await renderHtmlToPdf(pdfHtml, QUOTATION_PDF_OPTIONS);
      if (!pdfResult.ok) {
        return NextResponse.json(
          { error: pdfUnavailableMessage(pdfResult.error) },
          { status: 503 }
        );
      }
      return new NextResponse(pdfResult.buffer as unknown as BodyInit, {
        headers: withExportCacheHeaders({
          "Content-Type": "application/pdf",
          "Content-Disposition": `${disposition}; filename="${baseName}${templateSuffix}.pdf"`,
        }),
      });
    }

    if (format === "pptx") {
      const { buildQuotationPptxBuffer } = await import(
        "@/features/quotations/export/quotation-pptx"
      );
      const buffer = await buildQuotationPptxBuffer(doc);
      return new NextResponse(buffer as unknown as BodyInit, {
        headers: withExportCacheHeaders({
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          "Content-Disposition": `${disposition}; filename="${baseName}${templateSuffix}.pptx"`,
        }),
      });
    }

    // Inline HTML only — SAMEORIGIN/frame-ancestors self for same-origin embeds.
    // File downloads (Word/PDF/Excel/PPTX) keep the platform DENY framing policy.
    const isInlineHtmlPreview =
      !download && (format === "preview" || format === "html" || format === "htm");
    return new NextResponse(html, {
      headers: withExportCacheHeaders(
        {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Disposition": `${disposition}; filename="${baseName}${templateSuffix}.html"`,
        },
        { embeddable: isInlineHtmlPreview }
      ),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to export quotation";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
