import {
  DownloadIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  appendQuotationTemplateParam,
  type QuotationTemplateVariant,
} from "@/features/quotations/export/quotation-template";

type QuotationPreviewDownloadsProps = {
  quotationId: string;
  template: QuotationTemplateVariant;
};

export function buildExportHref(
  quotationId: string,
  format: string,
  template: QuotationTemplateVariant,
  options?: { download?: boolean }
) {
  const params = new URLSearchParams({ format });
  if (options?.download !== false) {
    params.set("download", "1");
  }
  appendQuotationTemplateParam(params, template);
  return `/api/quotations/${quotationId}/export?${params.toString()}`;
}

export function QuotationPreviewDownloads({
  quotationId,
  template,
}: QuotationPreviewDownloadsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="outline" asChild>
        <a href={buildExportHref(quotationId, "word", template)}>
          <FileTextIcon data-icon="inline-start" className="size-3.5" />
          Word
        </a>
      </Button>
      <Button size="sm" variant="outline" asChild>
        <a href={buildExportHref(quotationId, "pdf", template)}>
          <DownloadIcon data-icon="inline-start" className="size-3.5" />
          PDF
        </a>
      </Button>
      <Button size="sm" variant="outline" asChild>
        <a href={buildExportHref(quotationId, "excel", template)}>
          <FileSpreadsheetIcon data-icon="inline-start" className="size-3.5" />
          Excel
        </a>
      </Button>
    </div>
  );
}
