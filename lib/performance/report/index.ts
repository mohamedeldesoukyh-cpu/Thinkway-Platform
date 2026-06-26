export { buildPerformanceReportFileBaseName } from "@/lib/performance/report/performance-report-filename";
export { loadPerformanceReportDocumentData } from "@/lib/performance/report/performance-report-document-data";
export { buildPerformanceReportExcelBuffer } from "@/lib/performance/report/performance-report-excel";
export { buildPerformanceReportPptxBuffer } from "@/lib/performance/report/performance-report-pptx";
export { renderPerformanceReportHtml } from "@/lib/performance/report/performance-report-template-render";
export type {
  PerformanceReportDocumentData,
  PerformanceReportVariant,
} from "@/lib/performance/report/performance-report-types";

/** @deprecated Use renderPerformanceReportHtml with PerformanceReportDocumentData */
export {
  buildCampaignPerformanceExcelBuffer,
  buildCampaignPerformanceExcelRows,
  renderCampaignPerformanceReportHtml,
} from "@/lib/campaigns/performance-report-document-legacy";
