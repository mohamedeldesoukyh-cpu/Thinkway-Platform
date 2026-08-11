import { NextResponse } from "next/server";

import { createPdfDocumentResponse } from "@/lib/documents/pdf-response";
import { createIoDocumentSignedUrl } from "@/lib/io/io-document-storage";
import { renderLiveVendorIoHtml } from "@/lib/io/render-live-vendor-io-html";
import { VENDOR_IO_DOCUMENTS_BUCKET } from "@/lib/io/vendor-io-document-service";
import {
  INSERTION_ORDER_PDF_OPTIONS,
  pdfUnavailableMessage,
  renderHtmlToPdf,
} from "@/lib/io/vendor-io-pdf";
import { requireApiPermission } from "@/lib/auth/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") ?? "html";
  const download = searchParams.get("download") === "1";

  const supabase = await createSupabaseServerClient();
  const auth = await requireApiPermission(supabase, "vendor_ios.read");
  if ("response" in auth) return auth.response;

  try {
    const { data: vendorIo } = await supabase
      .from("vendor_ios")
      .select("generated_html_url, generated_pdf_url, document_number, terms_html")
      .eq("id", id)
      .maybeSingle();

    if (!vendorIo) {
      return NextResponse.json({ error: "Vendor IO not found" }, { status: 404 });
    }

    const typed = vendorIo as {
      generated_pdf_url: string | null;
      generated_html_url: string | null;
      document_number: string | null;
      terms_html: string | null;
    };

    const disposition = download ? "attachment" : "inline";
    const baseName = typed.document_number ?? id;

    if (format === "pdf") {
      // Inline view may use the stored generated PDF for speed.
      // Download always re-renders from live HTML so PDF matches Preview.
      if (typed.generated_pdf_url && !download) {
        const signedUrl = await createIoDocumentSignedUrl(
          supabase,
          VENDOR_IO_DOCUMENTS_BUCKET,
          typed.generated_pdf_url
        );
        if (signedUrl) {
          return NextResponse.redirect(signedUrl);
        }
      }

      const html = await renderLiveVendorIoHtml(supabase, id);
      const pdfResult = await renderHtmlToPdf(html, INSERTION_ORDER_PDF_OPTIONS);
      if (!pdfResult.ok) {
        return NextResponse.json(
          { error: pdfUnavailableMessage(pdfResult.error) },
          { status: 503 }
        );
      }

      return createPdfDocumentResponse(pdfResult.buffer, baseName, download);
    }

    if (format === "html") {
      const html = await renderLiveVendorIoHtml(supabase, id);
      const fileName = `${baseName}.html`;

      return new NextResponse(html, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Disposition": `${disposition}; filename="${fileName}"`,
        },
      });
    }

    return NextResponse.json({ error: "Unsupported format" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load Vendor IO document";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
