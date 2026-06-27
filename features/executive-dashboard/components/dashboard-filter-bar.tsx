"use client";

import { useCallback, useMemo, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FilterIcon, RotateCcwIcon } from "lucide-react";

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
      className="platform-v6-dash-filters"
      data-pending={isPending ? "true" : undefined}
    >
      <FilterIcon className="size-[13px] shrink-0 text-[var(--tw-text-3,#94a3b8)]" aria-hidden />
      <span className="text-[11px] font-semibold text-[var(--tw-text-2,#475569)]">Filters</span>
      <div className="platform-v6-dash-filter-divider" aria-hidden />
      <div className="platform-v6-dash-filter">
        <label htmlFor="filter-from" className="platform-v6-df-lbl">
          From
        </label>
        <input
          id="filter-from"
          type="date"
          className="platform-v6-df-input"
          value={state.from ?? ""}
          onChange={(e) => update({ from: e.target.value || undefined })}
        />
      </div>
      <div className="platform-v6-dash-filter">
        <label htmlFor="filter-to" className="platform-v6-df-lbl">
          To
        </label>
        <input
          id="filter-to"
          type="date"
          className="platform-v6-df-input"
          value={state.to ?? ""}
          onChange={(e) => update({ to: e.target.value || undefined })}
        />
      </div>
      <div className="platform-v6-dash-filter-divider" aria-hidden />
      <FilterSelect
        label="Country"
        value={state.country ?? "all"}
        onChange={(v) => update({ country: v === "all" ? undefined : v })}
        items={[
          { value: "all", label: "All countries" },
          ...options.countries.map((c) => ({ value: c, label: c })),
        ]}
      />
      <FilterSelect
        label="Client"
        value={state.clientId ?? "all"}
        onChange={(v) => update({ clientId: v === "all" ? undefined : v })}
        items={[
          { value: "all", label: "All clients" },
          ...options.clients.map((c) => ({ value: c.id, label: c.name })),
        ]}
      />
      <FilterSelect
        label="Brand"
        value={state.brandId ?? "all"}
        onChange={(v) => update({ brandId: v === "all" ? undefined : v })}
        items={[
          { value: "all", label: "All brands" },
          ...options.brands.map((b) => ({ value: b.id, label: b.name })),
        ]}
      />
      <FilterSelect
        label="Currency"
        value={state.currency ?? "all"}
        onChange={(v) => update({ currency: v === "all" ? undefined : v })}
        items={[
          { value: "all", label: "All currencies" },
          ...options.currencies.map((c) => ({ value: c, label: c })),
        ]}
      />
      <FilterSelect
        label="Status"
        value={state.campaignStatus ?? "all"}
        onChange={(v) => update({ campaignStatus: v === "all" ? undefined : v })}
        items={STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
      />
      <button
        type="button"
        className="platform-v6-btn platform-v6-btn-sm ml-auto"
        onClick={reset}
      >
        <RotateCcwIcon className="size-3" aria-hidden />
        Reset
      </button>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  items,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  items: { value: string; label: string }[];
}) {
  return (
    <div className="platform-v6-dash-filter">
      <label className="platform-v6-df-lbl">{label}</label>
      <select
        className="platform-v6-df-input cursor-pointer"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {items.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    </div>
  );
}
