import { inlineRemoteImagesInHtml } from "@/lib/io/pdf-inline-remote-images";
import { renderHtmlToPdf } from "@/lib/io/vendor-io-pdf";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/permissions-server";
import { loadReviewSchedule, loadCampaignReviewSchedule } from "./load-review-schedule";
import {
  scheduleFilename,
  scheduleReportHtml,
  scheduleWorkbook,
} from "./review-schedule-export";
import { reviewScheduleToday } from "./content-review-schedule";

export async function reviewScheduleResponse(
  request: Request,
  id: string,
  format: "pdf" | "xlsx" | "html",
) {
  const headers: Record<string, string> = {
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  };
  const token = request.headers
    .get("authorization")
    ?.match(/^Bearer (.+)$/)?.[1];
  try {
    let data;
    if (token) {
      data = await loadReviewSchedule(token, id);
    } else {
      const db = await createSupabaseServerClient();
      const access = await requirePermission(db, "campaigns.read");
      if ("error" in access) return new Response("Campaign access required", { status: 403, headers });
      // Session client preserves row-level access. Never use the service role here.
      data = await loadCampaignReviewSchedule(db, id);
    }
    if (!data)
      return new Response("Review access unavailable", {
        status: 403,
        headers,
      });
    const date = reviewScheduleToday();
    headers["Content-Disposition"] =
      `attachment; filename="${scheduleFilename(data, format, date)}"`;
    if (format === "xlsx") {
      const book = await scheduleWorkbook(data, date);
      headers["Content-Type"] =
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      return new Response(new Uint8Array(await book.xlsx.writeBuffer()), {
        headers,
      });
    }
    const html = await inlineRemoteImagesInHtml(scheduleReportHtml(data, date));
    if (format === "html") {
      headers["Content-Type"] = "text/html; charset=utf-8";
      headers["Content-Security-Policy"] =
        "default-src 'none'; style-src 'unsafe-inline'; img-src data: https:; font-src data:; base-uri 'none'";
      return new Response(html, { headers });
    }
    const pdf = await renderHtmlToPdf(html, {
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0", bottom: "0", left: "0", right: "0" },
    });
    if (!pdf.ok)
      return new Response("PDF could not be prepared. Please try again.", {
        status: 503,
        headers,
      });
    headers["Content-Type"] = "application/pdf";
    return new Response(new Uint8Array(pdf.buffer), { headers });
  } catch {
    return new Response("Schedule could not be loaded. Please try again.", {
      status: 503,
      headers,
    });
  }
}
