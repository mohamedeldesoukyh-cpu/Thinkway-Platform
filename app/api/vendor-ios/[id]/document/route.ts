import { NextResponse } from "next/server";

import { renderLiveVendorIoHtml } from "@/lib/io/render-live-vendor-io-html";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

    if (format === "pdf" && typed.generated_pdf_url) {
      if (!download) {
        return NextResponse.redirect(typed.generated_pdf_url);
      }
      const pdfResponse = await fetch(typed.generated_pdf_url);
      if (!pdfResponse.ok) {
        return NextResponse.json({ error: "PDF not available" }, { status: 404 });
      }
      const pdfBuffer = await pdfResponse.arrayBuffer();
      return new NextResponse(pdfBuffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `${disposition}; filename="${baseName}.pdf"`,
        },
      });
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
