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
import { ReportExportActions } from "@/features/reports/components/report-export-actions";
import { PNL_PERIOD_OPTIONS } from "@/lib/analytics/pnl/pnl-periods";
import type {
  RevenueByFunctionFilter,
  RevenueByFunctionReportData,
} from "@/lib/analytics/revenue-by-function/revenue-by-function-types";
import type { ClientTypeFilter } from "@/lib/analytics/filters/client-type-filter";

type Props = {
  report: Pick<
    RevenueByFunctionReportData,
    | "year"
    | "period_scope"
    | "display_currency"
    | "available_currencies"
    | "function_filter"
    | "user_filter"
    | "client_type"
    | "user_options"
  >;
};

function yearOptions(anchor: number): number[] {
  return Array.from({ length: 8 }, (_, index) => anchor - index);
}

export function RevenueByFunctionControls({ report }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const state = useMemo(
    () => ({
      year: String(report.year),
      period: report.period_scope,
      currency: report.display_currency,
      function: report.function_filter,
      user: report.user_filter,
      clientType: report.client_type,
    }),
    [report]
  );

  const apply = useCallback(
    (patch: Partial<typeof state>) => {
      const next = { ...state, ...patch };
      const params = new URLSearchParams();
      params.set("year", next.year);
      if (next.period !== "fy") {
        params.set("period", next.period);
      }
      if (next.currency) {
        params.set("currency", next.currency);
      }
      if (next.function !== "all") {
        params.set("function", next.function);
      }
      if (next.user !== "all") {
        params.set("user", next.user);
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

        <div className="grid min-w-[7rem] gap-1">
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Year
          </Label>
          <Select value={state.year} onValueChange={(value) => apply({ year: value })}>
            <SelectTrigger className="h-8 w-[7rem] text-xs">
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
            Period
          </Label>
          <Select
            value={state.period}
            onValueChange={(value) => apply({ period: value as typeof state.period })}
          >
            <SelectTrigger className="h-8 w-[8.5rem] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PNL_PERIOD_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
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
            <SelectTrigger className="h-8 w-[6.5rem] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {report.available_currencies.map((code) => (
                <SelectItem key={code} value={code}>
                  {code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid min-w-[7rem] gap-1">
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Function
          </Label>
          <Select
            value={state.function}
            onValueChange={(value) =>
              apply({
                function: value as RevenueByFunctionFilter,
                user: "all",
              })
            }
          >
            <SelectTrigger className="h-8 w-[7rem] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="ops">OPS</SelectItem>
              <SelectItem value="sales">Sales</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid min-w-[10rem] gap-1">
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
            User
          </Label>
          <Select
            value={state.user}
            onValueChange={(value) => apply({ user: value })}
          >
            <SelectTrigger className="h-8 w-[11rem] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All users</SelectItem>
              {report.user_options.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name}
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

        <div className="ml-auto">
          <ReportExportActions apiPath="/api/reports/revenue-by-function/document" />
        </div>
      </div>
    </div>
  );
}
