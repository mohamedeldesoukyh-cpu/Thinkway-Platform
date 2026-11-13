import { z } from "zod";
import { CUSTOM_COLUMNS, CUSTOM_CURRENCIES } from "./custom-report";

export const CUSTOM_REPORTS_PREFERENCE_KEY = "saved_custom_reports_v1";
const filterKeys = ["clientId", "brandId", "campaignId", "creatorId", "recordCurrency"] as const;
export const savedCustomReportSchema = z.object({
  id: z.string().uuid(), name: z.string().trim().min(1).max(80), favorite: z.boolean(),
  columns: z.array(z.string().refine(key => CUSTOM_COLUMNS.some(c => c.key === key) && key !== "vat")).min(1).max(CUSTOM_COLUMNS.length - 1).transform(keys => [...new Set(keys)]),
  currency: z.enum(CUSTOM_CURRENCIES), includeVat: z.boolean(),
  filters: z.object({ clientId: z.string().uuid().optional(), brandId: z.string().uuid().optional(), campaignId: z.string().uuid().optional(), creatorId: z.string().uuid().optional(), recordCurrency: z.string().regex(/^[A-Z]{3}$/).optional() }),
});
export type SavedCustomReport = z.infer<typeof savedCustomReportSchema>;
export function readSavedCustomReports(value: unknown): SavedCustomReport[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => { const parsed = savedCustomReportSchema.safeParse(item); return parsed.success ? [parsed.data] : []; }).slice(0, 30);
}
export function savedCustomReportParams(report: SavedCustomReport) {
  const params = new URLSearchParams({ reportName: report.name, columns: report.columns.join(","), currency: report.currency, includeVat: report.includeVat ? "1" : "0" });
  for (const key of filterKeys) if (report.filters[key]) params.set(key, report.filters[key]!);
  return params;
}
export function savedCustomReportUrl(report: SavedCustomReport, preview = false) {
  const params = savedCustomReportParams(report);
  if (preview) params.set("format", "html"); else params.set("savedReport", report.id);
  return `${preview ? "/api/reports/custom/document" : "/reports/custom"}?${params}`;
}
