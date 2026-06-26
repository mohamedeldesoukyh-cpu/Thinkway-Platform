import { sanitizeFileNameSegment } from "@/lib/reports/document/report-document-response";

import type { PerformanceReportVariant } from "@/lib/performance/report/performance-report-types";

function performanceReportVariantLabel(variant: PerformanceReportVariant): string {
  return variant === "influencers" ? "Influencer-Report" : "Combined-Report";
}

export function buildPerformanceReportFileBaseName(
  campaignName: string,
  documentNumber: string,
  variant: PerformanceReportVariant
): string {
  const namePart = sanitizeFileNameSegment(campaignName || "Campaign");
  const numberPart = sanitizeFileNameSegment(documentNumber || "report");
  const variantPart = performanceReportVariantLabel(variant);
  return `${namePart}_${numberPart}_${variantPart}`;
}
