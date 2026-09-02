"use client";

import Link from "next/link";
import { useCallback, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";

import { MetricCard } from "@/components/shared/kpi/metric-card";
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import {
  SpendingByCategoryControls,
  SpendingByCategoryViewTabs,
} from "@/features/reports/components/spending-by-category-controls";
import type {
  SpendingByCategoryDetailGroup,
  SpendingByCategoryReportData,
  SpendingByCategorySummaryRow,
  SpendingByCategoryView,
} from "@/lib/analytics/spending-by-category/spending-by-category-types";
import { cn } from "@/lib/utils";

type Props = {
  report: SpendingByCategoryReportData;
};

function formatAmount(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

function formatAmountOrDash(value: number): string {
  return value === 0 ? "—" : formatAmount(value);
}

function SummaryTable({
  rows,
  groupBy,
  currency,
}: {
  rows: SpendingByCategorySummaryRow[];
  groupBy: SpendingByCategoryReportData["group_by"];
  currency: string;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border/70">
      <table className="min-w-[900px] w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border/70 bg-muted/25 text-[11px] uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-2 text-left font-semibold">Category</th>
            {groupBy === "subcategory" ? (
              <th className="px-4 py-2 text-left font-semibold">Subcategory</th>
            ) : null}
            <th className="px-4 py-2 text-right font-semibold">Clients</th>
            <th className="px-4 py-2 text-right font-semibold">Campaigns</th>
            <th className="px-4 py-2 text-right font-semibold">Spending ({currency})</th>
            <th className="px-4 py-2 text-right font-semibold">% of total</th>
            <th className="px-4 py-2 text-right font-semibold">VR amount</th>
            <th className="px-4 py-2 text-right font-semibold">Avg margin</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={`${row.category_slug}-${row.subcategory_slug ?? "all"}`}
              className="border-b border-border/50 last:border-0"
            >
              <td className="px-4 py-2.5 font-medium text-foreground">{row.category_label}</td>
              {groupBy === "subcategory" ? (
                <td className="px-4 py-2.5 text-muted-foreground">
                  {row.subcategory_label ?? "—"}
                </td>
              ) : null}
              <td className="px-4 py-2.5 text-right tabular-nums">{row.client_count}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{row.campaign_count}</td>
              <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                {formatAmountOrDash(row.total_spending)}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                {formatPercent(row.percent_of_total)}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums">
                {formatAmountOrDash(row.vr_amount)}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums text-emerald-700 dark:text-emerald-400">
                {row.total_spending === 0 ? "—" : formatPercent(row.avg_margin_percent)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AnalysisGroup({
  group,
  currency,
  defaultOpen = false,
}: {
  group: SpendingByCategoryDetailGroup;
  currency: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [openClients, setOpenClients] = useState<Set<string>>(new Set());

  const toggleClient = (clientId: string) => {
    setOpenClients((prev) => {
      const next = new Set(prev);
      if (next.has(clientId)) {
        next.delete(clientId);
      } else {
        next.add(clientId);
      }
      return next;
    });
  };

  const title =
    group.subcategory_label != null
      ? `${group.category_label} · ${group.subcategory_label}`
      : group.category_label;

  return (
    <div className="rounded-lg border border-border/70">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/20"
      >
        <div className="flex min-w-0 items-center gap-2">
          {open ? (
            <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
          )}
          <div className="min-w-0">
            <p className="whitespace-normal break-words text-sm font-semibold text-foreground">{title}</p>
            <p className="text-[11px] text-muted-foreground">
              {group.clients.length} client{group.clients.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        <p className="shrink-0 text-sm font-semibold tabular-nums text-[var(--brand-product)]">
          {formatAmount(group.total_spending)} {currency}
        </p>
      </button>

      {open ? (
        <div className="border-t border-border/70 bg-muted/10">
          {group.clients.map((client) => {
            const clientOpen = openClients.has(client.client_id);
            return (
              <div key={client.client_id} className="border-b border-border/50 last:border-0">
                <button
                  type="button"
                  onClick={() => toggleClient(client.client_id)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-2.5 pl-8 text-left hover:bg-muted/20"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {clientOpen ? (
                      <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <Link
                      href={`/clients/${client.client_id}`}
                      onClick={(event) => event.stopPropagation()}
                      className="whitespace-normal break-words text-sm font-medium text-foreground underline-offset-2 hover:text-brand-blue hover:underline"
                    >
                      {client.client_name}
                    </Link>
                  </div>
                  <div className="flex shrink-0 items-center gap-4 text-xs tabular-nums">
                    <span>{formatAmount(client.spending)}</span>
                    <span className="text-muted-foreground">
                      {client.spending === 0 ? "—" : formatPercent(client.margin_percent)}
                    </span>
                  </div>
                </button>

                {clientOpen ? (
                  <div className="overflow-x-auto border-t border-border/50 bg-card">
                    <table className="min-w-full border-collapse text-xs">
                      <thead>
                        <tr className="bg-muted/20 text-[10px] uppercase tracking-wide text-muted-foreground">
                          <th className="px-4 py-2 pl-14 text-left font-semibold">Campaign</th>
                          <th className="px-4 py-2 text-left font-semibold">Brand</th>
                          <th className="px-4 py-2 text-right font-semibold">Spending</th>
                          <th className="px-4 py-2 text-right font-semibold">VR</th>
                          <th className="px-4 py-2 text-right font-semibold">Margin</th>
                        </tr>
                      </thead>
                      <tbody>
                        {client.campaigns.map((campaign) => (
                          <tr key={campaign.campaign_header_id} className="border-t border-border/40">
                            <td className="px-4 py-2 pl-14">
                              <Link
                                href={`/campaigns/${campaign.campaign_header_id}`}
                                className="font-medium text-foreground underline-offset-2 hover:text-brand-blue hover:underline"
                              >
                                {campaign.campaign_label}
                              </Link>
                            </td>
                            <td className="px-4 py-2 text-muted-foreground">
                              {campaign.brand_name ?? "—"}
                            </td>
                            <td className="px-4 py-2 text-right tabular-nums">
                              {formatAmountOrDash(campaign.spending)}
                            </td>
                            <td className="px-4 py-2 text-right tabular-nums">
                              {formatAmountOrDash(campaign.vr_amount)}
                            </td>
                            <td className="px-4 py-2 text-right tabular-nums text-emerald-700 dark:text-emerald-400">
                              {campaign.spending === 0
                                ? "—"
                                : formatPercent(campaign.margin_percent)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function SpendingByCategoryView({ report }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const hasReportData = report.summary_rows.length > 0;

  const setView = useCallback(
    (view: SpendingByCategoryView) => {
      const params = new URLSearchParams();
      params.set("year", String(report.year));
      if (report.period_scope !== "fy") {
        params.set("period", report.period_scope);
      }
      if (report.display_currency) {
        params.set("currency", report.display_currency);
      }
      if (report.group_by !== "category") {
        params.set("groupBy", report.group_by);
      }
      if (view !== "summary") {
        params.set("view", view);
      }
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
    },
    [
      pathname,
      report.display_currency,
      report.group_by,
      report.period_scope,
      report.year,
      router,
    ]
  );

  const kpiStrip = useMemo(
    () => (
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          title="Total spending"
          value={`${formatAmount(report.kpis.total_spending)} ${report.display_currency}`}
        />
        <MetricCard
          title="Categories"
          value={String(report.kpis.category_count)}
          subtitle={
            report.group_by === "subcategory"
              ? `${report.summary_rows.length} subcategory rows`
              : undefined
          }
        />
        <MetricCard
          title="Top category share"
          value={formatPercent(report.kpis.top_category_share_percent)}
          subtitle={report.kpis.top_category_label ?? "No data"}
        />
      </div>
    ),
    [report]
  );

  return (
    <div className="space-y-4">
      <SpendingByCategoryControls report={report} />

      {report.has_mixed_source_currencies ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
          Mixed source currencies detected ({report.mixed_currency_codes.join(", ")}). Amounts are
          converted to {report.display_currency} for comparison — review exchange rates before
          interpreting totals.
        </div>
      ) : null}

      {kpiStrip}

      <OperationalTableSection wide tableOnly cardSurface>
        <div className="space-y-3 px-4 py-4 md:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                Spending by category — {report.period_label} {report.year}
              </h2>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Grouped by {report.group_by} in {report.display_currency}.
              </p>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {report.period_note}
              </p>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {report.data_scope_note}
              </p>
            </div>

            <SpendingByCategoryViewTabs view={report.view} onChange={setView} />
          </div>

          {!hasReportData ? (
            <div className="rounded-lg border border-dashed border-border/70 bg-muted/15 px-4 py-8 text-center">
              <p className="text-sm font-medium text-foreground">
                No spending data for this scope
              </p>
              <p className="mx-auto mt-2 max-w-lg text-[11px] leading-relaxed text-muted-foreground">
                Try another year or period, or confirm campaigns are active, paused, or completed
                with billable lines and client categories assigned.
              </p>
            </div>
          ) : report.view === "summary" ? (
            <SummaryTable
              rows={report.summary_rows}
              groupBy={report.group_by}
              currency={report.display_currency}
            />
          ) : (
            <div className="space-y-3">
              {report.detail_groups.map((group, index) => (
                <AnalysisGroup
                  key={`${group.category_slug}-${group.subcategory_slug ?? "all"}`}
                  group={group}
                  currency={report.display_currency}
                  defaultOpen={index === 0}
                />
              ))}
            </div>
          )}
        </div>
      </OperationalTableSection>
    </div>
  );
}
