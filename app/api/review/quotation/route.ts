import { NextResponse } from "next/server";
import { renderExistingQuotationPdf, renderExistingQuotationHtml } from "@/features/client-workspace/client-quotation-pdf";
import { resolveCommercialDocuments } from "@/features/client-workspace/commercial-documents";
export const dynamic = "force-dynamic";
export const maxDuration = 120;
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  let access;
  try { access = await resolveCommercialDocuments(query.get("sign")?.trim() || ""); }
  catch { return NextResponse.json({error:"This quotation is not available for this review link."},{status:403}); }
  if (!access.quotationId) return NextResponse.json({error:"No quotation is available yet."},{status:404});
  try {
    if (query.get("format") === "html") {
      const rendered = await renderExistingQuotationHtml({supabase:access.db as never, quotationId:access.quotationId,
        host:request.headers.get("x-forwarded-host") ?? request.headers.get("host"),proto:request.headers.get("x-forwarded-proto")});
      if (!rendered.ok) return NextResponse.json({error:rendered.message},{status:503});
      return new NextResponse(rendered.html,{headers:{"Content-Type":"text/html; charset=utf-8",
        "Cache-Control":"private, no-store","Referrer-Policy":"no-referrer","X-Content-Type-Options":"nosniff",
        "Content-Security-Policy":"sandbox allow-same-origin; default-src 'none'; style-src 'unsafe-inline' https:; img-src https: data:; font-src https: data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"}});
    }
    const rendered = await renderExistingQuotationPdf({supabase:access.db as never, quotationId:access.quotationId,
      host:request.headers.get("x-forwarded-host") ?? request.headers.get("host"),proto:request.headers.get("x-forwarded-proto")});
    if (!rendered.ok) return NextResponse.json({error:rendered.message},{status:503});
    return new NextResponse(rendered.buffer as unknown as BodyInit,{headers:{"Content-Type":"application/pdf",
      "Content-Disposition":`${query.get("view") === "1" ? "inline" : "attachment"}; filename="${rendered.filename.replace(/["\r\n]/g, "")}"`,
      "Cache-Control":"private, no-store","Referrer-Policy":"no-referrer"}});
  } catch { return NextResponse.json({error:"Could not prepare the quotation. Please try again."},{status:503}); }
}
