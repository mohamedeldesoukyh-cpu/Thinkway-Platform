import { NextResponse } from "next/server";

import { renderLiveInvoiceHtml } from "@/lib/billing/render-live-invoice-html";
import { createPdfDocumentResponse } from "@/lib/documents/pdf-response";
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
  const format = searchParams.get("format") ?? "html";
  const download = searchParams.get("download") === "1";

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data: invoice } = await supabase
      .from("invoices")
      .select("document_number")
      .eq("id", id)
      .maybeSingle();

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const typed = invoice as { document_number: string | null };
    const html = await renderLiveInvoiceHtml(supabase, id);
    const baseName = typed.document_number ?? id;
    const disposition = download ? "attachment" : "inline";

    if (format === "pdf") {
      const pdfResult = await renderHtmlToPdf(html);
      if (!pdfResult.ok) {
        return NextResponse.json(
          { error: pdfUnavailableMessage(pdfResult.error) },
          { status: 503 }
        );
      }

      return createPdfDocumentResponse(pdfResult.buffer, baseName, download);
    }

    if (format === "html") {
      return new NextResponse(html, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Disposition": `${disposition}; filename="${baseName}.html"`,
        },
      });
    }

    return NextResponse.json({ error: "Unsupported format" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load invoice document";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
