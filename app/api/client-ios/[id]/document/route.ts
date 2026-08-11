import { NextResponse } from "next/server";

import { createPdfDocumentResponse } from "@/lib/documents/pdf-response";
import { resolveClientIoDocumentLayout } from "@/lib/io/client-io-document-layout";
import { CLIENT_IO_DOCUMENTS_BUCKET } from "@/lib/io/client-io-document-service";
import { createIoDocumentSignedUrl } from "@/lib/io/io-document-storage";
import { renderLiveClientIoHtml } from "@/lib/io/render-live-client-io-html";
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
  const layout = resolveClientIoDocumentLayout(searchParams.get("layout"));
  const download = searchParams.get("download") === "1";

  const supabase = await createSupabaseServerClient();
  const auth = await requireApiPermission(supabase, "client_ios.read");
  if ("response" in auth) return auth.response;

  try {
    const { data: clientIo } = await supabase
      .from("client_ios")
      .select("generated_html_url, generated_pdf_url, document_number, terms_html")
      .eq("id", id)
      .maybeSingle();

    if (!clientIo) {
      return NextResponse.json({ error: "Client IO not found" }, { status: 404 });
    }

    const typed = clientIo as {
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
      if (typed.generated_pdf_url && !download && layout === "detailed") {
        const signedUrl = await createIoDocumentSignedUrl(
          supabase,
          CLIENT_IO_DOCUMENTS_BUCKET,
          typed.generated_pdf_url
        );
        if (signedUrl) {
          return NextResponse.redirect(signedUrl);
        }
      }

      const html = await renderLiveClientIoHtml(supabase, id, layout, auth.userId);
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
      const html = await renderLiveClientIoHtml(supabase, id, layout, auth.userId);
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
    const message = error instanceof Error ? error.message : "Failed to load Client IO document";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
