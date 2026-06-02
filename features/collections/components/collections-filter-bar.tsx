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
import {
  parseCollectionsSearchParams,
  serializeCollectionsFilters,
  type CollectionsFilterState,
} from "@/lib/collections/dashboard-filters";
import { devLog } from "@/lib/platform/logger";

const TABS = [
  { value: "dashboard", label: "Collections dashboard" },
  { value: "aging", label: "AR aging" },
  { value: "statements", label: "Client statements" },
  { value: "allocation", label: "Payment allocation" },
  { value: "forecast", label: "Collections forecast" },
  { value: "overdue", label: "Overdue management" },
  { value: "payables", label: "Vendor payables" },
] as const;

type CollectionsFilterBarProps = {
  options: DashboardFilterOptions;
};

export function CollectionsFilterBar({ options }: CollectionsFilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const state = useMemo(
    () => parseCollectionsSearchParams(Object.fromEntries(searchParams.entries())),
    [searchParams]
  );

  const apply = useCallback(
    (next: CollectionsFilterState) => {
      const q = serializeCollectionsFilters(next).toString();
      if (process.env.NODE_ENV === "development") {
        devLog("[collections] filter", q);
      }
      startTransition(() => router.push(q ? `${pathname}?${q}` : pathname));
    },
    [pathname, router]
  );

  return (
    <div
      className="sticky top-0 z-20 -mx-4 border-b border-border bg-background/95 px-4 py-3 backdrop-blur md:-mx-8 md:px-8"
      data-pending={isPending ? "true" : undefined}
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <FilterIcon className="size-4" aria-hidden />
          Collections
        </div>
        <div className="grid min-w-[160px] gap-1">
          <Label className="text-xs">Section</Label>
          <Select value={state.tab ?? "dashboard"} onValueChange={(tab) => apply({ ...state, tab })}>
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
        <div className="grid min-w-[140px] gap-1">
          <Label className="text-xs">Client</Label>
          <Select
            value={state.clientId ?? "__all__"}
            onValueChange={(c) =>
              apply({ ...state, clientId: c === "__all__" ? undefined : c })
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
        <Button type="button" variant="ghost" size="sm" onClick={() => apply({ tab: state.tab })}>
          <RotateCcwIcon className="size-3.5" aria-hidden />
          Reset
        </Button>
      </div>
    </div>
  );
}
