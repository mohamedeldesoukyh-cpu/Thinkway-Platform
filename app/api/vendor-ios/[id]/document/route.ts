import { NextResponse } from "next/server";

import { createPdfDocumentResponse } from "@/lib/documents/pdf-response";
import { renderLiveVendorIoHtml } from "@/lib/io/render-live-vendor-io-html";
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
      if (typed.generated_pdf_url && !download) {
        return NextResponse.redirect(typed.generated_pdf_url);
      }

      if (typed.generated_pdf_url && download) {
        const pdfResponse = await fetch(typed.generated_pdf_url);
        if (pdfResponse.ok) {
          const pdfBuffer = await pdfResponse.arrayBuffer();
          return new NextResponse(pdfBuffer, {
            headers: {
              "Content-Type": "application/pdf",
              "Content-Disposition": `${disposition}; filename="${baseName}.pdf"`,
            },
          });
        }
      }

      const html = await renderLiveVendorIoHtml(supabase, id);
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
