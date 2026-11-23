/** Windows-safe names with Unicode preserved for browser downloads. */
export function safeDownloadBasename(value: string, maxLength = 180) {
  return value.replace(/[<>:"/\\|?*\x00-\x1f\x7f]/g, "-").replace(/\s+/g, " ").trim().slice(0, maxLength).replace(/[. ]+$/, "") || "Report";
}
export function downloadDisposition(name: string, disposition: "attachment" | "inline" = "attachment") {
  const safe = safeDownloadBasename(name, 240);
  const ascii = safe.replace(/[^\x20-\x7e]/g, "_");
  return `${disposition}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(safe).replace(/['()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase())}`;
}
export function campaignDisplayName(name: string) {
  return name.replace(/^Quotation\s*[—–:-]\s*/i, "").trim() || name;
}
export function quotationDownloadName(client: string, campaign: string, number: string, date: string) {
  return safeDownloadBasename([client.slice(0, 60), campaignDisplayName(campaign).slice(0, 70), number.slice(0, 30), date].filter(Boolean).join(" - "));
}
