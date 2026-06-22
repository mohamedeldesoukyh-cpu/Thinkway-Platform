import { NextResponse } from "next/server";

import { getCampaignPerformanceBundle } from "@/features/campaigns/queries/publications";
import {
  buildCampaignPerformanceExcelBuffer,
  renderCampaignPerformanceReportHtml,
} from "@/lib/campaigns/performance-report-document";
import {
  createHtmlDocumentResponse,
  createPdfFromHtmlResponse,
  createXlsxDocumentResponse,
  parseReportDocumentFormat,
  sanitizeFileNameSegment,
} from "@/lib/reports/document/report-document-response";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/validation/uuid";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: campaignId } = await context.params;
  const { searchParams } = new URL(request.url);
  const format = parseReportDocumentFormat(searchParams.get("format"));
  const download = searchParams.get("download") === "1";

  if (!format) {
    return NextResponse.json({ error: "Unsupported format" }, { status: 400 });
  }

  if (!isUuid(campaignId)) {
    return NextResponse.json({ error: "Invalid campaign ID" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: campaign, error: campaignError } = await supabase
    .from("campaign_headers")
    .select("id, name, document_number")
    .eq("id", campaignId)
    .maybeSingle();

  if (campaignError || !campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const bundle = await getCampaignPerformanceBundle(campaignId);
  const baseName = sanitizeFileNameSegment(
    `${campaign.document_number}-performance-report`
  );

  if (format === "html") {
    const html = renderCampaignPerformanceReportHtml(
      campaign.name,
      campaign.document_number,
      bundle
    );
    return createHtmlDocumentResponse(html, baseName, download);
  }

  if (format === "xlsx") {
    const buffer = await buildCampaignPerformanceExcelBuffer(
      campaign.name,
      campaign.document_number,
      bundle
    );
    return createXlsxDocumentResponse(buffer, baseName, true);
  }

  const html = renderCampaignPerformanceReportHtml(
    campaign.name,
    campaign.document_number,
    bundle
  );
  return createPdfFromHtmlResponse(html, baseName, download);
}
