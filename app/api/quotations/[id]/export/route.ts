import { NextResponse } from "next/server";

import { buildQuotationDocument } from "@/features/quotations/export/quotation-document";
import { buildQuotationExcel } from "@/features/quotations/export/quotation-excel";
import { buildQuotationHtml } from "@/features/quotations/export/quotation-html";
import { resolveQuotationTemplate } from "@/features/quotations/export/quotation-template";
import { getQuotationDetail } from "@/features/quotations/queries";
import { pdfUnavailableMessage, renderHtmlToPdf } from "@/lib/io/vendor-io-pdf";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

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

    const doc = buildQuotationDocument(detail, { template });
    const baseName = doc.serial;
    const disposition = download ? "attachment" : "inline";
    const templateSuffix = template === "lump-sum" ? "-lump-sum" : "";

    if (format === "excel") {
      const buffer = await buildQuotationExcel(detail);
      return new NextResponse(buffer as unknown as BodyInit, {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${baseName}.xlsx"`,
        },
      });
    }

    const html = buildQuotationHtml(doc);

    if (format === "word") {
      // Word opens HTML content saved as .doc with full fidelity (no extra deps).
      return new NextResponse(html, {
        headers: {
          "Content-Type": "application/msword",
          "Content-Disposition": `attachment; filename="${baseName}${templateSuffix}.doc"`,
        },
      });
    }

    if (format === "pdf") {
      const pdfResult = await renderHtmlToPdf(html);
      if (!pdfResult.ok) {
        return NextResponse.json(
          { error: pdfUnavailableMessage(pdfResult.error) },
          { status: 503 }
        );
      }
      return new NextResponse(pdfResult.buffer as unknown as BodyInit, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `${disposition}; filename="${baseName}${templateSuffix}.pdf"`,
        },
      });
    }

    // Default: preview (inline HTML)
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `${disposition}; filename="${baseName}${templateSuffix}.html"`,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to export quotation";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
