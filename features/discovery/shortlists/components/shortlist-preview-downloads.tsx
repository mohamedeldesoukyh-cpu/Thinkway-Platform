import {
  DownloadIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  PresentationIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  appendShortlistExportRevision,
  appendShortlistTemplateParam,
  type ShortlistTemplateVariant,
} from "@/features/discovery/shortlists/export/shortlist-template";

type ShortlistPreviewDownloadsProps = {
  shortlistId: string;
  template: ShortlistTemplateVariant;
  itemIds?: string[];
  exportRevision?: string | null;
};

export function buildShortlistExportHref(
  shortlistId: string,
  format: string,
  template: ShortlistTemplateVariant,
  options?: { download?: boolean; itemIds?: string[]; exportRevision?: string | null }
) {
  const params = new URLSearchParams({ format });
  if (options?.download !== false) {
    params.set("download", "1");
  }
  appendShortlistTemplateParam(params, template);
  appendShortlistExportRevision(params, options?.exportRevision);
  if (options?.itemIds?.length) {
    params.set("items", options.itemIds.join(","));
  }
  return `/api/shortlists/${shortlistId}/export?${params.toString()}`;
}

export function ShortlistPreviewDownloads({
  shortlistId,
  template,
  itemIds,
  exportRevision,
}: ShortlistPreviewDownloadsProps) {
  const exportOptions = { itemIds, exportRevision };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="outline" asChild>
        <a href={buildShortlistExportHref(shortlistId, "html", template, exportOptions)}>
          <FileTextIcon data-icon="inline-start" className="size-3.5" />
          HTML
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
      {template === "showcase" ? (
        <Button size="sm" variant="outline" asChild>
          <a href={buildShortlistExportHref(shortlistId, "pptx", template, exportOptions)}>
            <PresentationIcon data-icon="inline-start" className="size-3.5" />
            PPTX
          </a>
        </Button>
      ) : null}
    </div>
  );
}
