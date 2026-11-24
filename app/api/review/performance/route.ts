import { NextResponse } from "next/server";
import { clientPerformanceAccess } from "@/features/client-workspace/client-performance-access";
import { loadPerformanceReportDocumentData, renderPerformanceReportHtml, buildPerformanceReportFileBaseName } from "@/lib/performance/report";
import { createPdfFromHtmlResponse } from "@/lib/reports/document/report-document-response";
import { PERFORMANCE_REPORT_PDF_OPTIONS } from "@/lib/io/vendor-io-pdf";
import { buildQrCodeDataUri } from "@/lib/performance/report/qr-code";
import { resolveIoPublicAppOrigin } from "@/lib/io/io-public-app-url";

import { prepareClientReportHtml, setClientReportActualSize } from "@/lib/performance/report/client-report-pdf";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("sign")?.trim() || "";
  let access;
  try { access = await clientPerformanceAccess(token); }
  catch { return NextResponse.json({ error: "This performance report is unavailable." }, { status: 403 }); }
  try {
    const data = await loadPerformanceReportDocumentData(access.db, access.campaignId, "combined");
    // The PDF uses the same performance-only template as the internal report.
    // Its QR must return to this client's signed workspace, never the staff dashboard.
    data.campaign.dashboardUrl = `${resolveIoPublicAppOrigin()}/review/${access.review.journeyId || access.review.id}/approval?${new URLSearchParams({ sign: token })}`;
    data.campaign.qrCodeImageUrl = await buildQrCodeDataUri(data.campaign.dashboardUrl, 160);
    if (!data.campaign.qrCodeImageUrl) throw new Error("Could not generate the private report QR code.");
    const name = buildPerformanceReportFileBaseName(data.campaign.name, data.campaign.documentNumber, "combined");
    const response = await createPdfFromHtmlResponse(await prepareClientReportHtml(renderPerformanceReportHtml(data)), name, new URL(request.url).searchParams.get("view") !== "1", PERFORMANCE_REPORT_PDF_OPTIONS);
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    if (!response.ok) return response;
    const pdf = await setClientReportActualSize(new Uint8Array(await response.arrayBuffer()));
    return new NextResponse(pdf as BodyInit, { headers: response.headers });
  } catch {
    return NextResponse.json({ error: "The report could not be exported. Please try again." }, { status: 503 });
  }
}
