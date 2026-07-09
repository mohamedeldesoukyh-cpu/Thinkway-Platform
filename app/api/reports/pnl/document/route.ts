import { NextResponse } from "next/server";

import {
  getPnLReport,
  parsePnLReportSearchParams,
} from "@/lib/analytics/queries/pnl-report";
import {
  buildPnlReportExcelBuffer,
  buildPnlReportFileBaseNameSafe,
  buildPnlReportHtml,
} from "@/lib/reports/document/pnl-report-document";
import {
  createHtmlDocumentResponse,
  createPdfFromHtmlResponse,
  createXlsxDocumentResponse,
  parseReportDocumentFormat,
} from "@/lib/reports/document/report-document-response";
import { getClientIp, requireApiPermission } from "@/lib/auth/api-auth";
import { logAuditEvent } from "@/lib/audit/log-audit-event";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const format = parseReportDocumentFormat(searchParams.get("format"));
  const download = searchParams.get("download") === "1";

  if (!format) {
    return NextResponse.json({ error: "Unsupported format" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const auth = await requireApiPermission(supabase, "analytics.read");
  if ("response" in auth) return auth.response;

  try {
    const queryParams: Record<string, string | string[] | undefined> = {};
    searchParams.forEach((value, key) => {
      if (key !== "format" && key !== "download") {
        queryParams[key] = value;
      }
    });

    const query = parsePnLReportSearchParams(queryParams);
    const report = await getPnLReport(query);
    const baseName = buildPnlReportFileBaseNameSafe(report);

    void logAuditEvent(supabase, {
      userId: auth.userId,
      action: "export",
      entityType: "report",
      entityId: "pnl",
      metadata: { format, download },
      ip: getClientIp(request),
    });

    if (format === "html") {
      const html = buildPnlReportHtml(report);
      return createHtmlDocumentResponse(html, baseName, download);
    }

    if (format === "xlsx") {
      const buffer = await buildPnlReportExcelBuffer(report);
      return createXlsxDocumentResponse(buffer, baseName, true);
    }

    const html = buildPnlReportHtml(report);
    return createPdfFromHtmlResponse(html, baseName, download);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to export P&L report";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
