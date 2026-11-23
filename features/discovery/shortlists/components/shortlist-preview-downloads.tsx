
import { PreviewDownloadMenu } from "@/features/discovery/document-preview/preview-download-menu";
import { appendPlatformsQueryParam } from "@/features/discovery/document-preview/document-export-selection";
import {
  appendShortlistExportRevision,
  appendShortlistTemplateParam,
  type ShortlistTemplateVariant,
} from "@/features/discovery/shortlists/export/shortlist-template";

type ShortlistPreviewDownloadsProps = {
  shortlistId: string;
  template: ShortlistTemplateVariant;
  itemIds?: string[];
  platforms?: string[] | null;
  exportRevision?: string | null;
};

export function buildShortlistExportHref(
  shortlistId: string,
  format: string,
  template: ShortlistTemplateVariant,
  options?: {
    download?: boolean;
    itemIds?: string[];
    platforms?: string[] | null;
    exportRevision?: string | null;
  }
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
  appendPlatformsQueryParam(params, options?.platforms);
  return `/api/shortlists/${shortlistId}/export?${params.toString()}`;
}

export function ShortlistPreviewDownloads({
  shortlistId,
  template,
  itemIds,
  platforms,
  exportRevision,
}: ShortlistPreviewDownloadsProps) {
  const exportOptions = { itemIds, platforms, exportRevision };

  const formats = [{format:"html",label:"HTML"},{format:"pdf",label:"PDF"},...(template !== "creator-list" ? [{format:"word",label:"Word"},{format:"excel",label:"Excel"},{format:"csv",label:"CSV"},{format:"pptx",label:"PowerPoint (PPTX)"}] : [])];
  return <PreviewDownloadMenu formats={formats.map(entry => ({...entry,href:buildShortlistExportHref(shortlistId,entry.format,template,exportOptions)}))} />;
}
