"use client";

import { useCallback, useMemo, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
import type { DashboardFilterOptions } from "@/features/analytics/load-executive-dashboard";
import type { BudgetVersion } from "@/lib/planning/types/budget";
import type { ForecastVersion } from "@/lib/planning/types/forecast";
import {
  parsePlanningSearchParams,
  serializePlanningFilters,
  type PlanningFilterState,
} from "@/lib/planning/dashboard-filters";
import { devLog } from "@/lib/platform/logger";

type PlanningFilterBarProps = {
  options: DashboardFilterOptions;
  versions: BudgetVersion[];
  forecasts: ForecastVersion[];
  fiscalYear: number;
};

const TABS = [
  { value: "dashboard", label: "Budget dashboard" },
  { value: "versions", label: "Budget versions" },
  { value: "variance", label: "Budget variance" },
  { value: "forecasting", label: "Forecasting" },
  { value: "allocations", label: "Budget allocations" },
] as const;

export function PlanningFilterBar({
  options,
  versions,
  forecasts,
  fiscalYear,
}: PlanningFilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const state = useMemo(
    () => parsePlanningSearchParams(Object.fromEntries(searchParams.entries())),
    [searchParams]
  );

  const applyState = useCallback(
    (next: PlanningFilterState) => {
      const params = serializePlanningFilters({
        ...next,
        fiscalYear: next.fiscalYear ?? String(fiscalYear),
      });
      const query = params.toString();
      if (process.env.NODE_ENV === "development") {
        devLog("[planning-dashboard] filter apply", { query });
      }
      startTransition(() => {
        router.push(query ? `${pathname}?${query}` : pathname);
      });
    },
    [fiscalYear, pathname, router]
  );

  const update = (patch: Partial<PlanningFilterState>) => {
    applyState({ ...state, ...patch });
  };

  const yearOptions = useMemo(() => {
    const years = new Set([fiscalYear, fiscalYear - 1, fiscalYear + 1]);
    for (const v of versions) years.add(v.fiscal_year);
    return [...years].sort((a, b) => b - a);
  }, [fiscalYear, versions]);

  return (
    <div
      className="sticky top-0 z-20 -mx-4 border-b border-border bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:-mx-8 md:px-8"
      data-pending={isPending ? "true" : undefined}
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <FilterIcon className="size-4" aria-hidden />
          Planning filters
        </div>

        <div className="grid min-w-[120px] gap-1 sm:max-w-[140px]">
          <Label className="text-xs">Section</Label>
          <Select
            value={state.tab ?? "dashboard"}
            onValueChange={(tab) => update({ tab })}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TABS.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid min-w-[100px] gap-1 sm:max-w-[120px]">
          <Label className="text-xs">Fiscal year</Label>
          <Select
            value={state.fiscalYear ?? String(fiscalYear)}
            onValueChange={(fy) => update({ fiscalYear: fy })}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid min-w-[140px] gap-1 sm:max-w-[200px]">
          <Label className="text-xs">Budget version</Label>
          <Select
            value={state.versionId ?? "__none__"}
            onValueChange={(v) =>
              update({ versionId: v === "__none__" ? undefined : v })
            }
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Select version" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Auto (approved)</SelectItem>
              {versions.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.name} ({v.status})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid min-w-[140px] gap-1 sm:max-w-[200px]">
          <Label className="text-xs">Forecast</Label>
          <Select
            value={state.forecastId ?? "__none__"}
            onValueChange={(v) =>
              update({ forecastId: v === "__none__" ? undefined : v })
            }
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Forecast" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Latest</SelectItem>
              {forecasts.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid min-w-[120px] gap-1 sm:max-w-[160px]">
          <Label className="text-xs">Country</Label>
          <Select
            value={state.country ?? "__all__"}
            onValueChange={(c) =>
              update({ country: c === "__all__" ? undefined : c })
            }
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All countries</SelectItem>
              {options.countries.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid min-w-[140px] gap-1 sm:max-w-[180px]">
          <Label className="text-xs">Client</Label>
          <Select
            value={state.clientId ?? "__all__"}
            onValueChange={(c) =>
              update({ clientId: c === "__all__" ? undefined : c })
            }
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All clients</SelectItem>
              {options.clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid min-w-[140px] gap-1 sm:max-w-[180px]">
          <Label className="text-xs">Brand</Label>
          <Select
            value={state.brandId ?? "__all__"}
            onValueChange={(b) =>
              update({ brandId: b === "__all__" ? undefined : b })
            }
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All brands</SelectItem>
              {options.brands.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 gap-1"
          onClick={() => applyState({ tab: state.tab, fiscalYear: String(fiscalYear) })}
        >
          <RotateCcwIcon className="size-3.5" aria-hidden />
          Reset filters
        </Button>
      </div>
    </div>
  );
}
