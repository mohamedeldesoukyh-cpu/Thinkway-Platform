"use client";

import { useCallback, useMemo, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { FilterIcon, RotateCcwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PnlPeriodScope } from "@/lib/analytics/pnl/pnl-periods";
import type { ClientTypeFilter } from "@/lib/analytics/filters/client-type-filter";
import {
  DAILY_MONTH_OPTIONS,
  DAILY_PERIOD_OPTIONS,
} from "@/lib/analytics/daily/daily-report-periods";
import type { DailyReportData } from "@/lib/analytics/daily/daily-report-types";

type Props = {
  report: Pick<
    DailyReportData,
    | "year"
    | "view_mode"
    | "layout"
    | "month"
    | "period_scope"
    | "display_currency"
    | "available_currencies"
    | "client_type"
  >;
};

function yearOptions(anchor: number): number[] {
  return Array.from({ length: 8 }, (_, index) => anchor - index);
}

export function DailyReportControls({ report }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const state = useMemo(
    () => ({
      year: String(report.year),
      view: report.view_mode,
      layout: report.layout,
      month: String(report.month ?? new Date().getMonth() + 1),
      period: report.period_scope ?? "q1",
      currency: report.display_currency,
      clientType: report.client_type,
    }),
    [report]
  );

  const apply = useCallback(
    (patch: Partial<typeof state>) => {
      const next = { ...state, ...patch };
      const params = new URLSearchParams();
      params.set("year", next.year);
      if (next.view === "month") {
        params.set("month", next.month);
      } else {
        params.set("view", "period");
        params.set("period", next.period);
      }
      if (next.currency) {
        params.set("currency", next.currency);
      }
      if (next.layout === "columns") {
        params.set("layout", "columns");
      }
      if (next.clientType !== "all") {
        params.set("clientType", next.clientType);
      }
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
    },
    [pathname, router, state]
  );

  const reset = () => {
    startTransition(() => {
      router.push(pathname);
    });
  };

  const yearList = yearOptions(new Date().getFullYear());

  return (
    <div
      className="rounded-xl border border-border/70 bg-card px-3 py-2.5 shadow-sm md:px-4"
      data-pending={isPending ? "true" : undefined}
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
          <FilterIcon className="size-3.5" aria-hidden />
          Report scope
        </div>

        <div className="grid min-w-[6rem] gap-1">
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Year
          </Label>
          <Select value={state.year} onValueChange={(value) => apply({ year: value })}>
            <SelectTrigger className="h-8 w-[5.5rem] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearList.map((year) => (
                <SelectItem key={year} value={String(year)}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid min-w-[8rem] gap-1">
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
            View
          </Label>
          <Select
            value={state.view}
            onValueChange={(value) =>
              apply({ view: value as typeof state.view })
            }
          >
            <SelectTrigger className="h-8 w-[8rem] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Single month</SelectItem>
              <SelectItem value="period">Quarter / half</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {state.view === "month" ? (
          <div className="grid min-w-[8rem] gap-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Month
            </Label>
            <Select value={state.month} onValueChange={(value) => apply({ month: value })}>
              <SelectTrigger className="h-8 w-[8rem] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAILY_MONTH_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={String(option.value)}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="grid min-w-[8rem] gap-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Period
            </Label>
            <Select
              value={state.period}
              onValueChange={(value) =>
                apply({ period: value as PnlPeriodScope })
              }
            >
              <SelectTrigger className="h-8 w-[8rem] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAILY_PERIOD_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="grid min-w-[8rem] gap-1">
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Layout
          </Label>
          <Select
            value={state.layout}
            onValueChange={(value) =>
              apply({ layout: value as typeof state.layout })
            }
          >
            <SelectTrigger className="h-8 w-[8.5rem] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="stacked">Stacked</SelectItem>
              <SelectItem value="columns">Side by side</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid min-w-[6rem] gap-1">
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Currency
          </Label>
          <Select
            value={state.currency}
            onValueChange={(value) => apply({ currency: value })}
          >
            <SelectTrigger className="h-8 w-[5.5rem] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {report.available_currencies.map((currency) => (
                <SelectItem key={currency} value={currency}>
                  {currency}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid min-w-[7rem] gap-1">
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Client type
          </Label>
          <Select
            value={state.clientType}
            onValueChange={(value) =>
              apply({ clientType: value as ClientTypeFilter })
            }
          >
            <SelectTrigger className="h-8 w-[7rem] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="agency">Agency</SelectItem>
              <SelectItem value="direct">Direct</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-xs text-muted-foreground"
          onClick={reset}
        >
          <RotateCcwIcon className="size-3.5" />
          Reset
        </Button>
      </div>
    </div>
  );
}
