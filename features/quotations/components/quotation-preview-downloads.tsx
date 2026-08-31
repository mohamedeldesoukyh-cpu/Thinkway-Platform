import {
  DownloadIcon,
  FileCodeIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  PresentationIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { appendPlatformsQueryParam } from "@/features/discovery/document-preview/document-export-selection";
import {
  appendQuotationExportRevision,
  appendQuotationTemplateParam,
  type QuotationTemplateVariant,
} from "@/features/quotations/export/quotation-template";

type QuotationPreviewDownloadsProps = {
  quotationId: string;
  template: QuotationTemplateVariant;
  itemIds?: string[];
  platforms?: string[] | null;
  exportRevision?: string | null;
};

export function buildExportHref(
  quotationId: string,
  format: string,
  template: QuotationTemplateVariant,
  options?: {
    download?: boolean;
    exportRevision?: string | null;
    itemIds?: string[];
    platforms?: string[] | null;
  }
) {
  const params = new URLSearchParams({ format });
  if (options?.download !== false) {
    params.set("download", "1");
  }
  appendQuotationTemplateParam(params, template);
  appendQuotationExportRevision(params, options?.exportRevision);
  if (options?.itemIds?.length) {
    params.set("items", options.itemIds.join(","));
  }
  appendPlatformsQueryParam(params, options?.platforms);
  return `/api/quotations/${quotationId}/export?${params.toString()}`;
}

export function QuotationPreviewDownloads({
  quotationId,
  template,
  itemIds,
  platforms,
  exportRevision,
}: QuotationPreviewDownloadsProps) {
  const exportOptions = { itemIds, platforms, exportRevision };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="outline" asChild>
        <a
          href={buildExportHref(quotationId, "html", template, exportOptions)}
          download
        >
          <FileCodeIcon data-icon="inline-start" className="size-3.5" />
          HTML
        </a>
      </Button>
      <Button size="sm" variant="outline" asChild>
        <a
          href={buildExportHref(quotationId, "word", template, exportOptions)}
          download
        >
          <FileTextIcon data-icon="inline-start" className="size-3.5" />
          Word
        </a>
      </Button>
      <Button size="sm" variant="outline" asChild>
        <a
          href={buildExportHref(quotationId, "pdf", template, exportOptions)}
          download
        >
          <DownloadIcon data-icon="inline-start" className="size-3.5" />
          PDF
        </a>
      </Button>
      <Button size="sm" variant="outline" asChild>
        <a
          href={buildExportHref(quotationId, "excel", template, exportOptions)}
          download
        >
          <FileSpreadsheetIcon data-icon="inline-start" className="size-3.5" />
          Excel
        </a>
      </Button>
      <Button size="sm" variant="outline" asChild>
        <a
          href={buildExportHref(quotationId, "pptx", template, exportOptions)}
          download
        >
          <PresentationIcon data-icon="inline-start" className="size-3.5" />
          PPTX
        </a>
      </Button>
    </div>
  );
}
