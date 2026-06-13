"use client";

import { useCallback, useMemo, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { FilterIcon, RotateCcwIcon } from "lucide-react";

import { DocumentNumber } from "@/components/ui/document-number";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ReportExportActions } from "@/features/reports/components/report-export-actions";
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import type { StatementsReportData } from "@/lib/reports/statements/statement-types";
import { formatGroupClientLabel } from "@/lib/reports/statements/entity-label";
import { cn } from "@/lib/utils";

type Props = {
  report: StatementsReportData;
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

export function StatementsDetailView({ report }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const debitLabel =
    report.type === "client" ? "Debit (Invoices)" : "Debit (Payments)";
  const creditLabel =
    report.type === "client" ? "Credit (Payments)" : "Credit (Vendor invoices)";

  const state = useMemo(
    () => ({
      from: report.from_date ?? "",
      to: report.to_date ?? "",
    }),
    [report.from_date, report.to_date]
  );

  const apply = useCallback(
    (patch: Partial<typeof state>) => {
      const next = { ...state, ...patch };
      const params = new URLSearchParams();
      if (next.from) {
        params.set("from", next.from);
      }
      if (next.to) {
        params.set("to", next.to);
      }
      const query = params.toString();
      startTransition(() => {
        router.push(query ? `${pathname}?${query}` : pathname);
      });
    },
    [pathname, router, state]
  );

  const reset = () => {
    startTransition(() => {
      router.push(pathname);
    });
  };

  const exportFixedParams = useMemo(
    () => ({
      type: report.type,
      entityId: report.entity_id ?? "",
    }),
    [report.entity_id, report.type]
  );

  const entityDisplayName =
    report.type === "client"
      ? formatGroupClientLabel(report.group_name, report.entity_name) ?? report.entity_name
      : report.entity_name;

  return (
    <div className="space-y-4">
      <div
        className="rounded-xl border border-border/70 bg-card px-3 py-2.5 shadow-sm md:px-4"
        data-pending={isPending ? "true" : undefined}
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
              <FilterIcon className="size-3.5" aria-hidden />
              Date range
            </div>

            <div className="grid min-w-[8rem] gap-1">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                From
              </Label>
              <Input
                type="date"
                className="h-8 w-[9rem] text-xs"
                value={state.from}
                onChange={(event) => apply({ from: event.target.value })}
              />
            </div>

            <div className="grid min-w-[8rem] gap-1">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                To
              </Label>
              <Input
                type="date"
                className="h-8 w-[9rem] text-xs"
                value={state.to}
                onChange={(event) => apply({ to: event.target.value })}
              />
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-xs text-muted-foreground"
              onClick={reset}
            >
              <RotateCcwIcon className="size-3.5" />
              Reset dates
            </Button>
          </div>

          <ReportExportActions
            apiPath="/api/reports/statements/document"
            fixedParams={exportFixedParams}
            disabled={!report.entity_id}
          />
        </div>
      </div>

      <OperationalTableSection wide tableOnly cardSurface>
        <div className="space-y-3 px-4 py-4 md:px-6">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold tracking-tight text-foreground">
              {report.type === "client" ? "Client statement" : "Vendor statement"}
            </h2>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              {report.entity_code ? (
                <span>
                  Code: <DocumentNumber value={report.entity_code} className="font-medium text-foreground" />
                </span>
              ) : null}
              {entityDisplayName ? (
                <span>
                  {report.type === "client" && report.group_name ? "Client: " : "Name: "}
                  <span className="font-medium text-foreground">{entityDisplayName}</span>
                </span>
              ) : null}
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {report.type === "client"
                ? "Invoice debits and payment credits for the selected legal entity."
                : "Vendor invoice credits and payment debits for the selected vendor."}
            </p>
          </div>

          {report.lines.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/70 bg-muted/15 px-4 py-8 text-center">
              <p className="text-sm font-medium text-foreground">No ledger entries</p>
              <p className="mx-auto mt-2 max-w-lg text-[11px] leading-relaxed text-muted-foreground">
                No invoices or payments match the selected date range.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/70">
              <table className="min-w-[900px] w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border/70 bg-muted/25 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2 text-left font-semibold">Date</th>
                    <th className="px-4 py-2 text-left font-semibold">Document</th>
                    <th className="px-4 py-2 text-left font-semibold">Campaign</th>
                    <th className="px-4 py-2 text-right font-semibold">{debitLabel}</th>
                    <th className="px-4 py-2 text-right font-semibold">{creditLabel}</th>
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
                      Totals
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
