import {
  DownloadIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ShortlistTemplateVariant } from "@/features/discovery/shortlists/export/shortlist-template";

type ShortlistPreviewDownloadsProps = {
  shortlistId: string;
  template: ShortlistTemplateVariant;
  itemIds?: string[];
};

export function buildShortlistExportHref(
  shortlistId: string,
  format: string,
  template: ShortlistTemplateVariant,
  options?: { download?: boolean; itemIds?: string[] }
) {
  const params = new URLSearchParams({ format });
  if (options?.download !== false) {
    params.set("download", "1");
  }
  if (template === "detailed") {
    params.set("template", "detailed");
  }
  if (options?.itemIds?.length) {
    params.set("items", options.itemIds.join(","));
  }
  return `/api/shortlists/${shortlistId}/export?${params.toString()}`;
}

export function ShortlistPreviewDownloads({
  shortlistId,
  template,
  itemIds,
}: ShortlistPreviewDownloadsProps) {
  const exportOptions = { itemIds };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="outline" asChild>
        <a href={buildShortlistExportHref(shortlistId, "csv", template, exportOptions)}>
          <FileTextIcon data-icon="inline-start" className="size-3.5" />
          CSV
        </a>
      </Button>
      <Button size="sm" variant="outline" asChild>
        <a href={buildShortlistExportHref(shortlistId, "word", template, exportOptions)}>
          <FileTextIcon data-icon="inline-start" className="size-3.5" />
          Word
        </a>
      </Button>
      <Button size="sm" variant="outline" asChild>
        <a href={buildShortlistExportHref(shortlistId, "pdf", template, exportOptions)}>
          <DownloadIcon data-icon="inline-start" className="size-3.5" />
          PDF
        </a>
      </Button>
      <Button size="sm" variant="outline" asChild>
        <a href={buildShortlistExportHref(shortlistId, "excel", template, exportOptions)}>
          <FileSpreadsheetIcon data-icon="inline-start" className="size-3.5" />
          Excel
        </a>
      </Button>
    </div>
  );
}
