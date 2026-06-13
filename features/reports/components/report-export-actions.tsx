"use client";

import { FileSpreadsheetIcon, FileTextIcon } from "lucide-react";
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";

type Props = {
  apiPath: string;
  /** Extra query params always included (e.g. type=client). */
  fixedParams?: Record<string, string>;
  /** When true, export buttons are disabled (e.g. no entity selected). */
  disabled?: boolean;
  disabledReason?: string;
};

function buildExportUrl(
  apiPath: string,
  searchParams: URLSearchParams,
  fixedParams: Record<string, string>,
  format: "html" | "pdf" | "xlsx",
  download: boolean
): string {
  const params = new URLSearchParams();

  searchParams.forEach((value, key) => {
    params.set(key, value);
  });

  for (const [key, value] of Object.entries(fixedParams)) {
    params.set(key, value);
  }

  params.set("format", format);
  if (download) {
    params.set("download", "1");
  }

  return `${apiPath}?${params.toString()}`;
}

export function ReportExportActions({
  apiPath,
  fixedParams = {},
  disabled = false,
  disabledReason,
}: Props) {
  const searchParams = useSearchParams();

  const urls = useMemo(
    () => ({
      html: buildExportUrl(apiPath, searchParams, fixedParams, "html", false),
      pdf: buildExportUrl(apiPath, searchParams, fixedParams, "pdf", false),
      xlsx: buildExportUrl(apiPath, searchParams, fixedParams, "xlsx", true),
    }),
    [apiPath, fixedParams, searchParams]
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Export
      </span>
      {disabled ? (
        <>
          <Button size="sm" variant="outline" disabled title={disabledReason}>
            <FileTextIcon data-icon="inline-start" className="size-3.5" />
            Preview HTML
          </Button>
          <Button size="sm" variant="outline" disabled title={disabledReason}>
            PDF
          </Button>
          <Button size="sm" variant="outline" disabled title={disabledReason}>
            <FileSpreadsheetIcon data-icon="inline-start" className="size-3.5" />
            Excel
          </Button>
        </>
      ) : (
        <>
          <Button size="sm" variant="outline" asChild>
            <a href={urls.html} target="_blank" rel="noopener noreferrer">
              <FileTextIcon data-icon="inline-start" className="size-3.5" />
              Preview HTML
            </a>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <a href={urls.pdf} target="_blank" rel="noopener noreferrer">
              PDF
            </a>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <a href={urls.xlsx} target="_blank" rel="noopener noreferrer">
              <FileSpreadsheetIcon data-icon="inline-start" className="size-3.5" />
              Excel
            </a>
          </Button>
        </>
      )}
    </div>
  );
}
