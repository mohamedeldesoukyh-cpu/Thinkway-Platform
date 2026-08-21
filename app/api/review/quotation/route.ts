import { NextResponse } from "next/server";

import { renderExistingQuotationPdf } from "@/features/client-workspace/client-quotation-pdf";
import { resolveClientReviewByToken } from "@/features/client-workspace/load-client-workspace";
import { canOpenCommercialWorkspace, isSelectionConfirmed } from "@/features/client-workspace/selection-flow";
import { tryCreateServiceRoleClient } from "@/lib/supabase/service-role-client";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("sign")?.trim() || "";
  if (token.length < 16) {
    return NextResponse.json({ error: "This review link is not available." }, { status: 401 });
  }
  const service = tryCreateServiceRoleClient().client;
  if (!service) {
    return NextResponse.json({ error: "Download unavailable." }, { status: 503 });
  }
  const resolved = await resolveClientReviewByToken(service, token);
  if (!resolved.ok) {
    return NextResponse.json({ error: "This review link is not available." }, { status: 401 });
  }
  const quotationId = resolved.review.quotationId;
  if (!quotationId) {
    return NextResponse.json({ error: "No quotation is available to download." }, { status: 404 });
  }
  if (
    !canOpenCommercialWorkspace({
      selectionConfirmed: isSelectionConfirmed(resolved.review.sourceSnapshot),
      historical: resolved.review.status === "superseded",
      quotationStage: resolved.review.status === "approved" ? "approved" : undefined,
    })
  ) {
    return NextResponse.json(
      { error: "Approve selected creators before downloading the quotation." },
      { status: 403 }
    );
  }
  const rendered = await renderExistingQuotationPdf({
    supabase: service as never,
    quotationId,
    host: request.headers.get("x-forwarded-host") ?? request.headers.get("host"),
    proto: request.headers.get("x-forwarded-proto"),
  });
  if (!rendered.ok) {
    return NextResponse.json({ error: rendered.message }, { status: 503 });
  }
  return new NextResponse(rendered.buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${rendered.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
