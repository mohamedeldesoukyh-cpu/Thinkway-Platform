import { PreviewDownloadMenu } from "@/features/discovery/document-preview/preview-download-menu";
import type { PerformanceReportVariant } from "@/lib/performance/report";

type PerformanceReportPreviewDownloadsProps = {
  campaignId: string;
  variant: PerformanceReportVariant;
  publicationIds?: string[];
};

function buildReportHref(
  reportBase: string,
  format: string,
  variant: PerformanceReportVariant,
  options?: { download?: boolean; influencerPdf?: boolean; publicationIds?: string[] }
) {
  const params = new URLSearchParams({ format });
  if (options?.download !== false) {
    params.set("download", "1");
  }
  const pdfVariant = options?.influencerPdf ? "influencers" : variant;
  if (pdfVariant === "influencers") {
    params.set("variant", "influencers");
  }
  if (options?.publicationIds?.length) {
    params.set("publicationIds", options.publicationIds.join(","));
  }
  return `${reportBase}?${params.toString()}`;
}

export function PerformanceReportPreviewDownloads({
  campaignId,
  variant,
  publicationIds,
}: PerformanceReportPreviewDownloadsProps) {
  const reportBase = `/api/campaigns/${campaignId}/performance/document`;

  const reportOptions = { publicationIds };

  return <PreviewDownloadMenu formats={[
    {format:"html",label:"HTML",href:buildReportHref(reportBase,"html",variant,reportOptions)},
    {format:"pdf",label:"Combined PDF",href:buildReportHref(reportBase,"pdf","combined",reportOptions)},
    {format:"pdf",label:"Influencer PDF",href:buildReportHref(reportBase,"pdf","influencers",reportOptions)},
    {format:"xlsx",label:"Excel",href:buildReportHref(reportBase,"xlsx",variant,reportOptions)},
    {format:"pptx",label:"PowerPoint",href:buildReportHref(reportBase,"pptx",variant,reportOptions)},
  ]} />;
}
