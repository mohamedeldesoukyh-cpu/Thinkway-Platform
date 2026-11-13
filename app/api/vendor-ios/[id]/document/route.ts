import { formatDocumentNumberForDisplay } from "@/lib/documents/format-document-number";
import { NextResponse } from "next/server";

import { createPdfDocumentResponse } from "@/lib/documents/pdf-response";
import { renderLiveVendorIoHtml } from "@/lib/io/render-live-vendor-io-html";
import { downloadIoDocumentBuffer } from "@/lib/io/io-document-storage";
import {
  INSERTION_ORDER_PDF_OPTIONS,
  pdfUnavailableMessage,
  renderHtmlToPdf,
} from "@/lib/io/vendor-io-pdf";
import { requireApiPermission } from "@/lib/auth/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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
      .select("document_number")
      .eq("id", id)
      .maybeSingle();

    if (!vendorIo) {
      return NextResponse.json({ error: "Vendor IO not found" }, { status: 404 });
    }

    const typed = vendorIo as {
      document_number: string | null;
    };

    const disposition = download ? "attachment" : "inline";
    const baseName = typed.document_number ? formatDocumentNumberForDisplay(typed.document_number) : id;

    if (format === "pdf") {
      const { data: signed, error: signatureError } = await supabase.from("vendor_io_signatures")
        .select("signed_pdf_path").eq("vendor_io_id",id).maybeSingle();
      if (signatureError) throw new Error("Could not verify the signed IO document.");
      if (signed) {
        // Both IO and signature were authorized through the caller's RLS client.
        // Only the private object read uses server credentials; never accept a
        // request-supplied path or return a storage URL.
        const path = (signed as { signed_pdf_path: string }).signed_pdf_path;
        const unavailable = () => NextResponse.json(
          { error: "The signed PDF is temporarily unavailable. Please try again." },
          { status: 500 },
        );
        if (!path.startsWith(`${id}/signed/`) ||
            !/^[0-9a-f-]{36}\/signed\/[0-9a-f-]{36}\.pdf$/i.test(path)) return unavailable();
        try {
          const buffer = await downloadIoDocumentBuffer(createSupabaseAdminClient(), "vendor-io-documents", path);
          if (!buffer) return unavailable();
          const response = createPdfDocumentResponse(buffer, `${baseName}-Signed`, download);
          response.headers.set("Cache-Control", "private, no-store");
          return response;
        } catch {
          return unavailable();
        }
      }
      // Both inline and download reflect campaign overrides and platform clause updates.
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
