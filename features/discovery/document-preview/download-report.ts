import { parseApiError } from "@/lib/security/api-error";

export function reportDownloadFilename(disposition: string | null, fallback: string): string {
  const encoded = disposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (encoded) {
    try { return decodeURIComponent(encoded); } catch { /* Use the ASCII fallback. */ }
  }
  return disposition?.match(/filename="([^"]+)"/i)?.[1] || fallback;
}

/** A failed export is not a downloadable report. */
export async function fetchReportDownload(href: string): Promise<Response> {
  const response = await fetch(href);
  if (response.redirected && new URL(response.url).pathname === "/login") {
    throw new Error("Your session expired. Sign in again to download the report.");
  }
  if (!response.ok) {
    const error = await parseApiError(response, "Could not download the report. Please try again.");
    throw new Error(error.message);
  }
  return response;
}

export async function downloadReport(href: string, format: string): Promise<void> {
  const response = await fetchReportDownload(href);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  const extension = ({ word: "doc", excel: "xlsx" } as Record<string, string>)[format] ?? format;
  anchor.download = reportDownloadFilename(response.headers.get("Content-Disposition"), `report.${extension}`);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
