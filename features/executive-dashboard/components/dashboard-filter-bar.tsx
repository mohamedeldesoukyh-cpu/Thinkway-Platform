"use client";

import { useCallback, useMemo, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FilterIcon, RotateCcwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DashboardFilterOptions } from "@/features/analytics/load-executive-dashboard";
import {
  parseDashboardSearchParams,
  serializeDashboardFilters,
  type DashboardFilterState,
} from "@/lib/analytics/dashboard-filters";
import { devLog } from "@/lib/dev-log";

type DashboardFilterBarProps = {
  options: DashboardFilterOptions;
};

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "achieved", label: "Achieved revenue" },
  { value: "unachieved", label: "Unachieved revenue" },
  { value: "invoiced", label: "Invoiced" },
  { value: "in_collections", label: "In collections" },
] as const;

export function DashboardFilterBar({ options }: DashboardFilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const state = useMemo(
    () => parseDashboardSearchParams(Object.fromEntries(searchParams.entries())),
    [searchParams]
  );

  const applyState = useCallback(
    (next: DashboardFilterState) => {
      const params = serializeDashboardFilters(next);
      const query = params.toString();
      if (process.env.NODE_ENV === "development") {
        devLog("[dashboard-filter] apply", { query });
      }
      startTransition(() => {
        router.push(query ? `${pathname}?${query}` : pathname);
      });
    },
    [pathname, router]
  );

  const update = (patch: Partial<DashboardFilterState>) => {
    applyState({ ...state, ...patch });
  };

  const reset = () => {
    applyState({});
  };

  return (
    <div
      className="sticky top-0 z-20 -mx-4 border-b border-border bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:-mx-8 md:px-8"
      data-pending={isPending ? "true" : undefined}
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <FilterIcon className="size-4" aria-hidden />
          Filters
        </div>
        <div className="grid min-w-[120px] flex-1 gap-1 sm:max-w-[140px]">
          <Label htmlFor="filter-from" className="text-xs">
            From
          </Label>
          <Input
            id="filter-from"
            type="date"
            value={state.from ?? ""}
            onChange={(e) => update({ from: e.target.value || undefined })}
            className="h-9"
          />
        </div>
        <div className="grid min-w-[120px] flex-1 gap-1 sm:max-w-[140px]">
          <Label htmlFor="filter-to" className="text-xs">
            To
          </Label>
          <Input
            id="filter-to"
            type="date"
            value={state.to ?? ""}
            onChange={(e) => update({ to: e.target.value || undefined })}
            className="h-9"
          />
        </div>
        <FilterSelect
          label="Country"
          value={state.country ?? "all"}
          onValueChange={(v) => update({ country: v === "all" ? undefined : v })}
          items={[
            { value: "all", label: "All countries" },
            ...options.countries.map((c) => ({ value: c, label: c })),
          ]}
        />
        <FilterSelect
          label="Client"
          value={state.clientId ?? "all"}
          onValueChange={(v) => update({ clientId: v === "all" ? undefined : v })}
          items={[
            { value: "all", label: "All clients" },
            ...options.clients.map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
        <FilterSelect
          label="Brand"
          value={state.brandId ?? "all"}
          onValueChange={(v) => update({ brandId: v === "all" ? undefined : v })}
          items={[
            { value: "all", label: "All brands" },
            ...options.brands.map((b) => ({ value: b.id, label: b.name })),
          ]}
        />
        <FilterSelect
          label="Currency"
          value={state.currency ?? "all"}
          onValueChange={(v) => update({ currency: v === "all" ? undefined : v })}
          items={[
            { value: "all", label: "All currencies" },
            ...options.currencies.map((c) => ({ value: c, label: c })),
          ]}
        />
        <FilterSelect
          label="Status"
          value={state.campaignStatus ?? "all"}
          onValueChange={(v) =>
            update({ campaignStatus: v === "all" ? undefined : v })
          }
          items={STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 shrink-0"
          onClick={reset}
        >
          <RotateCcwIcon className="size-3.5" data-icon="inline-start" />
          Reset
        </Button>
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onValueChange,
  items,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  items: { value: string; label: string }[];
}) {
  return (
    <div className="grid min-w-[140px] flex-1 gap-1 sm:max-w-[180px]">
      <Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="h-9 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
