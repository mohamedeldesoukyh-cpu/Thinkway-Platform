"use client";
import { useRemovedReportPages } from "@/features/discovery/document-preview/report-page-selection-context";
import { appendProposalOptions, type ProposalOption } from "@/features/quotations/export/proposal-options";
import { isQuotationListTemplate } from "@/features/quotations/export/quotation-template";

import { PreviewDownloadMenu } from "@/features/discovery/document-preview/preview-download-menu";
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
  proposalOptions?: ProposalOption[];
  exportRevision?: string | null;
};

export function buildExportHref(
  quotationId: string,
  format: string,
  template: QuotationTemplateVariant,
  options?: {
    excludedPages?: number[];
    download?: boolean;
    exportRevision?: string | null;
    itemIds?: string[];
    platforms?: string[] | null;
    proposalOptions?: ProposalOption[];
  }
) {
  const params = new URLSearchParams({ format });
  if (options?.download !== false) {
    params.set("download", "1");
  }
  if (options?.excludedPages?.length) params.set("excludePages", options.excludedPages.join(","));
  appendQuotationTemplateParam(params, template);
  appendQuotationExportRevision(params, options?.exportRevision);
  if (options?.itemIds?.length) {
    params.set("items", options.itemIds.join(","));
  }
  appendPlatformsQueryParam(params, options?.platforms);
  appendProposalOptions(params, options?.proposalOptions);
  return `/api/quotations/${quotationId}/export?${params.toString()}`;
}

export function QuotationPreviewDownloads({
  quotationId,
  template,
  itemIds,
  platforms,
  exportRevision,
  proposalOptions,
}: QuotationPreviewDownloadsProps) {
  const excludedPages = useRemovedReportPages();
  const exportOptions = { itemIds, platforms, exportRevision, proposalOptions, excludedPages };

  const formats = [{format:"html",label:"HTML"},{format:"word",label:"Word"},{format:"pdf",label:"PDF"},...(!isQuotationListTemplate(template) ? [{format:"excel",label:"Excel"}] : []),{format:"pptx",label:"PowerPoint (PPTX)"}];
  return <PreviewDownloadMenu formats={formats.map(entry => ({...entry,href:buildExportHref(quotationId,entry.format,template,exportOptions)}))} />;
}
