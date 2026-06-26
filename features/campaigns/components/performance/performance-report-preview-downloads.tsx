import {
  DownloadIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
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

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="outline" asChild>
        <a href={buildReportHref(reportBase, "html", variant, reportOptions)}>
          <FileTextIcon data-icon="inline-start" className="size-3.5" />
          Download HTML
        </a>
      </Button>
      <Button size="sm" variant="outline" asChild>
        <a href={buildReportHref(reportBase, "pdf", "combined", reportOptions)}>
          <DownloadIcon data-icon="inline-start" className="size-3.5" />
          Combined PDF
        </a>
      </Button>
      <Button size="sm" variant="outline" asChild>
        <a
          href={buildReportHref(reportBase, "pdf", "influencers", {
            influencerPdf: true,
            ...reportOptions,
          })}
        >
          <DownloadIcon data-icon="inline-start" className="size-3.5" />
          Influencer PDF
        </a>
      </Button>
      <Button size="sm" variant="outline" asChild>
        <a href={buildReportHref(reportBase, "xlsx", variant, reportOptions)}>
          <FileSpreadsheetIcon data-icon="inline-start" className="size-3.5" />
          Excel
        </a>
      </Button>
      <Button size="sm" variant="outline" asChild>
        <a href={buildReportHref(reportBase, "pptx", variant, reportOptions)}>
          <FileTextIcon data-icon="inline-start" className="size-3.5" />
          PPT
        </a>
      </Button>
    </div>
  );
}
