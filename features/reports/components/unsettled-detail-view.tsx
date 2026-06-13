"use client";

import { useMemo } from "react";

import { DocumentNumber } from "@/components/ui/document-number";
import { ReportExportActions } from "@/features/reports/components/report-export-actions";
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import type { UnsettledReportData } from "@/lib/reports/statements/unsettled-types";
import { formatGroupClientLabel } from "@/lib/reports/statements/entity-label";
import { cn } from "@/lib/utils";

type Props = {
  report: UnsettledReportData;
};

function formatAmount(value: number): string {
  if (value === 0) return "—";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string): string {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function UnsettledDetailView({ report }: Props) {
  const exportFixedParams = useMemo(
    () => ({
      entityId: report.entity_id ?? "",
    }),
    [report.entity_id]
  );

  const entityDisplayName =
    formatGroupClientLabel(report.group_name, report.entity_name) ?? report.entity_name;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/70 bg-card px-3 py-2.5 shadow-sm md:px-4">
        <div className="flex flex-wrap items-center justify-end gap-3">
          <ReportExportActions
            apiPath="/api/reports/unsettled/document"
            fixedParams={exportFixedParams}
            disabled={!report.entity_id}
          />
        </div>
      </div>

      <OperationalTableSection wide tableOnly cardSurface>
        <div className="space-y-3 px-4 py-4 md:px-6">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold tracking-tight text-foreground">
              Statement of unsettled
            </h2>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              {report.entity_code ? (
                <span>
                  Code:{" "}
                  <DocumentNumber
                    value={report.entity_code}
                    className="font-medium text-foreground"
                  />
                </span>
              ) : null}
              {entityDisplayName ? (
                <span>
                  {report.group_name ? "Client: " : "Name: "}
                  <span className="font-medium text-foreground">{entityDisplayName}</span>
                </span>
              ) : null}
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Open invoices with outstanding balance. Payment credits are not included.
            </p>
          </div>

          {report.lines.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/70 bg-muted/15 px-4 py-8 text-center">
              <p className="text-sm font-medium text-foreground">No unsettled invoices</p>
              <p className="mx-auto mt-2 max-w-lg text-[11px] leading-relaxed text-muted-foreground">
                All invoices for this legal entity are fully paid or void.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/70">
              <table className="min-w-[900px] w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border/70 bg-muted/25 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2 text-left font-semibold">Invoice date</th>
                    <th className="px-4 py-2 text-left font-semibold">Invoice number</th>
                    <th className="px-4 py-2 text-left font-semibold">Campaign</th>
                    <th className="px-4 py-2 text-right font-semibold">Outstanding</th>
                    <th className="px-4 py-2 text-right font-semibold">Credit</th>
                    <th className="px-4 py-2 text-right font-semibold">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {report.lines.map((line) => (
                    <tr
                      key={`${line.kind}-${line.document_number}-${line.date}`}
                      className="border-b border-border/50 last:border-0"
                    >
                      <td className="px-4 py-2.5 tabular-nums">{formatDate(line.date)}</td>
                      <td className="px-4 py-2.5 font-medium">{line.document_number}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {line.campaign_name ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {formatAmount(line.debit)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {formatAmount(line.credit)}
                      </td>
                      <td
                        className={cn(
                          "px-4 py-2.5 text-right tabular-nums font-medium",
                          line.balance !== 0 && "text-foreground"
                        )}
                      >
                        {formatAmount(line.balance)}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-border/70 bg-muted/20 font-semibold">
                    <td className="px-4 py-2.5" colSpan={3}>
                      Total outstanding
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {formatAmount(report.totals.total_debit)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {formatAmount(report.totals.total_credit)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {formatAmount(report.totals.closing_balance)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </OperationalTableSection>
    </div>
  );
}
