import { NextResponse } from "next/server";

import {
  getSpendingByCategoryReport,
  parseSpendingByCategorySearchParams,
} from "@/lib/analytics/queries/spending-by-category-report";
import {
  buildSpendingByCategoryCsv,
  buildSpendingByCategoryFileBaseNameSafe,
  buildSpendingByCategoryReportExcelBuffer,
  buildSpendingByCategoryReportHtml,
} from "@/lib/reports/document/spending-by-category-document";
import {
  createHtmlDocumentResponse,
  createPdfFromHtmlResponse,
  createXlsxDocumentResponse,
  parseReportDocumentFormat,
} from "@/lib/reports/document/report-document-response";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

function createCsvDocumentResponse(
  content: string,
  baseName: string,
  suffix: string
): NextResponse {
  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${baseName}-${suffix}.csv"`,
    },
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const formatRaw = searchParams.get("format");
  const format = formatRaw === "csv" ? "csv" : parseReportDocumentFormat(formatRaw);
  const download = searchParams.get("download") === "1";
  const exportView = searchParams.get("exportView") === "detail" ? "detail" : "summary";

  if (!format) {
    return NextResponse.json({ error: "Unsupported format" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const queryParams: Record<string, string | string[] | undefined> = {};
    searchParams.forEach((value, key) => {
      if (
        key !== "format" &&
        key !== "download" &&
        key !== "exportView"
      ) {
        queryParams[key] = value;
      }
    });

    const query = parseSpendingByCategorySearchParams(queryParams);
    const report = await getSpendingByCategoryReport(query);
    const baseName = buildSpendingByCategoryFileBaseNameSafe(report);

    if (format === "csv") {
      const csv = buildSpendingByCategoryCsv(report, exportView);
      return createCsvDocumentResponse(csv, baseName, exportView);
    }

    if (format === "html") {
      const html = buildSpendingByCategoryReportHtml(report);
      return createHtmlDocumentResponse(html, baseName, download);
    }

    if (format === "xlsx") {
      const buffer = await buildSpendingByCategoryReportExcelBuffer(report);
      return createXlsxDocumentResponse(buffer, baseName, true);
    }

    const html = buildSpendingByCategoryReportHtml(report);
    return createPdfFromHtmlResponse(html, baseName, download);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to export spending by category report";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
