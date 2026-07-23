"use client";

import Link from "next/link";
import {
  CheckIcon,
  ChevronDownIcon,
  DownloadIcon,
  ExternalLinkIcon,
  EyeIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  PresentationIcon,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { buildExportHref } from "@/features/quotations/components/quotation-preview-downloads";
import { QuotationToolbarButton } from "@/features/quotations/components/quotation-detail-primitives";
import { quotationPreviewPath } from "@/features/quotations/constants";
import {
  QUOTATION_TEMPLATE_OPTIONS,
  appendQuotationExportRevision,
  appendQuotationTemplateParam,
  type QuotationTemplateVariant,
} from "@/features/quotations/export/quotation-template";
import { cn } from "@/lib/utils";

type Props = {
  quotationId: string;
  serialNumber?: string | null;
  exportTemplate: QuotationTemplateVariant;
  onExportTemplateChange: (template: QuotationTemplateVariant) => void;
  exportRevision?: string | null;
  busy?: boolean;
};

const EXPORT_FORMATS = [
  { format: "excel" as const, label: "Excel", icon: FileSpreadsheetIcon },
  { format: "word" as const, label: "Word", icon: FileTextIcon },
  { format: "pdf" as const, label: "PDF", icon: DownloadIcon },
  { format: "pptx" as const, label: "PPTX", icon: PresentationIcon },
];

function quotationPreviewHref(
  quotationId: string,
  serialNumber: string | null | undefined,
  template: QuotationTemplateVariant,
  exportRevision?: string | null
): string {
  const params = new URLSearchParams();
  appendQuotationTemplateParam(params, template);
  appendQuotationExportRevision(params, exportRevision);
  const query = params.toString();
  return quotationPreviewPath(quotationId, serialNumber, query || undefined);
}

export function QuotationPreviewToolbarActions({
  quotationId,
  serialNumber,
  exportTemplate,
  onExportTemplateChange,
  exportRevision,
  busy,
}: Props) {
  const previewHref = quotationPreviewHref(
    quotationId,
    serialNumber,
    exportTemplate,
    exportRevision
  );
  const activeTemplate =
    QUOTATION_TEMPLATE_OPTIONS.find((option) => option.id === exportTemplate) ??
    QUOTATION_TEMPLATE_OPTIONS[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <QuotationToolbarButton variant="outline" size="sm" disabled={busy} className="btn">
          <EyeIcon className="size-3.5" />
          Preview
          <span className="spill spill-compact">{activeTemplate.label}</span>
          <ChevronDownIcon className="size-3 text-[var(--text-4)]" />
        </QuotationToolbarButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[220px]">
        <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
          Template
        </DropdownMenuLabel>
        {QUOTATION_TEMPLATE_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.id}
            onSelect={() => onExportTemplateChange(option.id)}
            className="flex items-center justify-between gap-3 py-2"
          >
            <span className="min-w-0">
              <span
                className={cn(
                  "block text-[13px] font-medium",
                  exportTemplate === option.id && "font-semibold text-foreground"
                )}
              >
                {option.label}
              </span>
              <span className="block text-[11px] text-muted-foreground">{option.hint}</span>
            </span>
            <CheckIcon
              className={cn(
                "size-3.5 shrink-0 text-primary",
                exportTemplate === option.id ? "opacity-100" : "opacity-0"
              )}
            />
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
          Export
        </DropdownMenuLabel>
        {EXPORT_FORMATS.map(({ format, label, icon: Icon }) => (
          <DropdownMenuItem key={format} asChild>
            <a
              href={buildExportHref(quotationId, format, exportTemplate, {
                download: true,
                exportRevision,
              })}
              download
              className="flex cursor-pointer items-center gap-2"
            >
              <Icon className="size-3.5" />
              {label}
            </a>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link
            href={previewHref}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between gap-2"
          >
            <span>Open preview</span>
            <ExternalLinkIcon className="size-3.5 text-muted-foreground" />
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
