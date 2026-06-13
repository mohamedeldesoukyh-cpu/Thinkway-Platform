"use client";

import Link from "next/link";
import { useCallback, useMemo, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";

import { DocumentNumber } from "@/components/ui/document-number";
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import { ClientProfitabilityControls } from "@/features/reports/components/client-profitability-controls";
import { filterClientProfitabilityRows } from "@/lib/analytics/client-profitability/build-client-profitability-report";
import {
  MAX_CLIENT_PROFITABILITY_SELECTION,
  type ClientProfitabilityReportData,
} from "@/lib/analytics/client-profitability/client-profitability-types";
import { cn } from "@/lib/utils";

type Props = {
  report: ClientProfitabilityReportData;
};

function formatAmount(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatMarginPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

export function ClientProfitabilityView({ report }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const selectedIds = useMemo(
    () => new Set(report.selected_client_ids),
    [report.selected_client_ids]
  );

  const displayRows = useMemo(() => filterClientProfitabilityRows(report), [report]);

  const hasSelection = report.selected_client_ids.length > 0;
  const selectionAtMax = report.selected_client_ids.length >= MAX_CLIENT_PROFITABILITY_SELECTION;

  const pushParams = useCallback(
    (nextSelectedIds: string[]) => {
      const params = new URLSearchParams();
      params.set("year", String(report.year));
      if (report.period_scope !== "fy") {
        params.set("period", report.period_scope);
      }
      if (report.display_currency) {
        params.set("currency", report.display_currency);
      }
      if (report.client_type !== "all") {
        params.set("clientType", report.client_type);
      }
      if (nextSelectedIds.length > 0) {
        params.set("clients", nextSelectedIds.join(","));
      }
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
    },
    [pathname, report.client_type, report.display_currency, report.period_scope, report.year, router]
  );

  const toggleClient = (clientId: string) => {
    const next = new Set(report.selected_client_ids);
    if (next.has(clientId)) {
      next.delete(clientId);
    } else if (next.size < MAX_CLIENT_PROFITABILITY_SELECTION) {
      next.add(clientId);
    }
    pushParams([...next]);
  };

  const clearSelection = () => {
    const params = new URLSearchParams();
    params.set("year", String(report.year));
    if (report.period_scope !== "fy") {
      params.set("period", report.period_scope);
    }
    if (report.display_currency) {
      params.set("currency", report.display_currency);
    }
    if (report.client_type !== "all") {
      params.set("clientType", report.client_type);
    }
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const hasReportData = report.rows.some(
    (row) => row.revenue > 0 || row.gp_after_vr > 0
  );

  return (
    <div className="space-y-4" data-pending={isPending ? "true" : undefined}>
      <ClientProfitabilityControls report={report} onClearSelection={clearSelection} />

      <OperationalTableSection wide tableOnly cardSurface>
        <div className="space-y-3 px-4 py-4 md:px-6">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold tracking-tight text-foreground">
              Profitability by client — {report.period_label} {report.year}
            </h2>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {hasSelection
                ? `Comparing ${report.selected_client_ids.length} selected legal entit${report.selected_client_ids.length === 1 ? "y" : "ies"}. Select up to ${MAX_CLIENT_PROFITABILITY_SELECTION} clients to compare.`
                : `All legal entities in ${report.display_currency}. Select up to ${MAX_CLIENT_PROFITABILITY_SELECTION} clients to compare.`}
            </p>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {report.period_note}
            </p>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {report.data_scope_note}
            </p>
          </div>

          {!hasReportData ? (
            <div className="rounded-lg border border-dashed border-border/70 bg-muted/15 px-4 py-8 text-center">
              <p className="text-sm font-medium text-foreground">
                No profitability data for this scope
              </p>
              <p className="mx-auto mt-2 max-w-lg text-[11px] leading-relaxed text-muted-foreground">
                Try another year or period, or confirm campaigns are active, paused, or completed
                with assignment lines that have revenue and cost.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/70">
              <table className="min-w-[760px] w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border/70 bg-muted/25 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="w-10 px-3 py-2 text-center font-semibold">
                      <span className="sr-only">Compare</span>
                    </th>
                    <th className="px-4 py-2 text-left font-semibold">Code</th>
                    <th className="px-4 py-2 text-left font-semibold">Group</th>
                    <th className="px-4 py-2 text-left font-semibold">Legal entity</th>
                    <th className="px-4 py-2 text-right font-semibold">Revenue</th>
                    <th className="px-4 py-2 text-right font-semibold">GP</th>
                    <th className="px-4 py-2 text-right font-semibold">Margin %</th>
                  </tr>
                </thead>
                <tbody>
                  {(hasSelection ? displayRows : report.rows).map((row) => {
                    const isSelected = selectedIds.has(row.client_id);
                    const disableSelect =
                      !isSelected && selectionAtMax;

                    return (
                      <tr
                        key={row.client_id}
                        className={cn(
                          "border-b border-border/50 last:border-0",
                          isSelected && "bg-brand/5"
                        )}
                      >
                        <td className="px-3 py-2.5 text-center">
                          <input
                            type="checkbox"
                            className="size-3.5 rounded border-border accent-brand"
                            checked={isSelected}
                            disabled={disableSelect}
                            title={
                              disableSelect
                                ? `Maximum ${MAX_CLIENT_PROFITABILITY_SELECTION} clients for comparison`
                                : isSelected
                                  ? "Remove from comparison"
                                  : "Add to comparison"
                            }
                            aria-label={`Compare ${row.client_name}`}
                            onChange={() => toggleClient(row.client_id)}
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <DocumentNumber value={row.client_code} />
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {row.group_name ?? "—"}
                        </td>
                        <td className="px-4 py-2.5">
                          <Link
                            href={`/clients/${row.client_id}`}
                            className="font-medium text-foreground underline-offset-2 hover:text-brand-blue hover:underline"
                          >
                            {row.client_name}
                          </Link>
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {row.revenue === 0 ? "—" : formatAmount(row.revenue)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-medium text-emerald-700 dark:text-emerald-400">
                          {row.gp_after_vr === 0 ? "—" : formatAmount(row.gp_after_vr)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                          {row.revenue === 0 && row.gp_after_vr === 0
                            ? "—"
                            : formatMarginPercent(row.margin_percent)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </OperationalTableSection>
    </div>
  );
}
