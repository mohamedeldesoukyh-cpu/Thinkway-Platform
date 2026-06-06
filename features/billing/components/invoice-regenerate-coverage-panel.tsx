"use client";

import { AlertTriangleIcon, CheckCircle2Icon, GitBranchIcon, ShieldAlertIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { IoCoverageAnalysis } from "@/lib/operations/io-coverage";
import { formatDocumentNumberForDisplay } from "@/lib/documents/format-document-number";

type InvoiceRegenerateCoveragePanelProps = {
  coverage: IoCoverageAnalysis;
};

function CategoryBadge({ category }: { category: "unchanged" | "revised" | "needs_io" }) {
  if (category === "unchanged") {
    return (
      <Badge variant="outline" className="gap-1 border-emerald-500/40 text-emerald-700 dark:text-emerald-300">
        <CheckCircle2Icon className="size-3" />
        Unchanged
      </Badge>
    );
  }
  if (category === "revised") {
    return (
      <Badge variant="outline" className="gap-1 border-amber-500/40 text-amber-800 dark:text-amber-200">
        <GitBranchIcon className="size-3" />
        Revised
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 border-destructive/40 text-destructive">
      <ShieldAlertIcon className="size-3" />
      Needs IO
    </Badge>
  );
}

export function InvoiceRegenerateCoveragePanel({
  coverage,
}: InvoiceRegenerateCoveragePanelProps) {
  const unchanged = coverage.lines.filter((l) => l.category === "unchanged");
  const revised = coverage.lines.filter((l) => l.category === "revised");
  const needsIo = coverage.lines.filter((l) => l.category === "needs_io");

  return (
    <div className="grid gap-3 rounded-lg border bg-muted/20 p-3 text-sm">
      {coverage.case === "revision_warning" && coverage.warning_message ? (
        <div className="flex gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-950 dark:text-amber-100">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
          <p>{coverage.warning_message}</p>
        </div>
      ) : null}

      {coverage.case === "blocked" && coverage.block_message ? (
        <div className="flex gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive">
          <ShieldAlertIcon className="mt-0.5 size-4 shrink-0" />
          <p>{coverage.block_message}</p>
        </div>
      ) : null}

      {unchanged.length > 0 ? (
        <CoverageSection title="Unchanged lines (same IO references)" lines={unchanged} />
      ) : null}
      {revised.length > 0 ? (
        <CoverageSection
          title="Revised lines (IO revision under same number)"
          lines={revised}
        />
      ) : null}
      {needsIo.length > 0 ? (
        <CoverageSection title="New lines needing IO generation" lines={needsIo} />
      ) : null}
    </div>
  );
}

function CoverageSection({
  title,
  lines,
}: {
  title: string;
  lines: IoCoverageAnalysis["lines"];
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <ul className="space-y-1">
        {lines.map((line) => (
          <li
            key={line.line_id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background/80 px-2 py-1.5"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{line.line_name}</p>
              {line.change_summary ? (
                <p className="text-xs text-muted-foreground">{line.change_summary}</p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {line.vendor_io_document_number ? (
                <span className="font-mono text-[10px] text-muted-foreground">
                  {formatDocumentNumberForDisplay(line.vendor_io_document_number)}
                </span>
              ) : null}
              <CategoryBadge category={line.category} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
