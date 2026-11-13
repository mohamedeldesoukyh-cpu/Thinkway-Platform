"use client";

import { useEffect, useId, useRef } from "react";
import { ChevronRightIcon, ListFilterIcon, RotateCcwIcon, SearchIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cairoToday, type OverviewFilters, type OverviewReport } from "@/lib/reports/overview/overview-report";
import { cn } from "@/lib/utils";

import { OverviewAsOfControl, OverviewCurrencyControl, OverviewDateRangeFilter, OverviewOptionFilter } from "./overview-filter-controls";
import { ACTIVITY_OPTIONS, changedFilterKeys, CLIENT_TYPE_OPTIONS } from "./overview-report-ui";

type FilterKey = Exclude<keyof OverviewFilters, "columns">;

type OverviewFilterPanelProps = {
  draft: OverviewFilters;
  applied: OverviewFilters;
  options: OverviewReport["options"];
  pending: boolean;
  onChange: (key: FilterKey, value: string) => void;
  onApply: () => void;
  onReset: () => void;
  /** Restores the draft to the applied filters. */
  onDiscard: () => void;
};

const STATUS_LABEL = (label: string) => label.charAt(0).toUpperCase() + label.slice(1);
const ACTIVITY_DETAIL: Record<string, string> = {
  actual: "Campaigns with any went-live revenue or cost",
  accrued: "Campaigns with any amount not yet live",
  both: "Campaigns with both actual and accrued amounts",
};

/**
 * Filter bar. Every control edits a draft; nothing reaches the URL until
 * Apply filters (or Enter in search). Pills show the draft value, and an amber
 * dot marks any filter whose draft differs from the report on screen.
 */
export function OverviewFilterPanel({ draft, applied, options, pending, onChange, onApply, onReset, onDiscard }: OverviewFilterPanelProps) {
  const uid = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const today = cairoToday();
  const changed = changedFilterKeys(draft, applied);
  const changeCount = changed.length;
  const activeCount = (["q", "groupId", "clientId", "brandId", "campaignId", "status", "clientType", "activity", "from", "to"] as const)
    .filter(key => applied[key]).length;

  // "/" focuses search, as in most data tools. Ignored while typing in a field.
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable=true], [role=dialog]")) return;
      event.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const pendingParent = (parent: "groupId" | "clientId" | "brandId", noun: string) =>
    draft[parent] !== applied[parent] ? `Showing ${noun} for the applied selection. Apply filters to narrow this list.` : undefined;

  return (
    <section aria-label="Report filters" className="rounded-2xl border border-border/70 bg-card shadow-sm">
      <form
        role="search"
        onSubmit={event => {
          event.preventDefault();
          onApply();
        }}
      >
        {/* Row 1: search + report basis */}
        <div className="flex flex-wrap items-center gap-2.5 border-b border-border/60 p-3 sm:px-4">
          <div className="relative min-w-0 flex-[1_1_20rem]">
            <label htmlFor={`${uid}-q`} className="sr-only">Search group, client, brand or campaign</label>
            <SearchIcon aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={searchRef}
              id={`${uid}-q`}
              type="search"
              enterKeyHint="search"
              value={draft.q}
              placeholder="Search group, client, brand or campaign"
              onChange={event => onChange("q", event.target.value)}
              className={cn(
                "h-10 w-full rounded-full border border-input bg-input-background pl-10 pr-16 text-sm text-foreground outline-none transition-[color,box-shadow,background-color]",
                "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:bg-card focus-visible:ring-3 focus-visible:ring-ring/30 dark:focus-visible:bg-input-background",
                "[&::-webkit-search-cancel-button]:hidden",
                draft.q !== applied.q && "border-[color-mix(in_srgb,var(--amber)_55%,transparent)]",
              )}
            />
            <span className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
              {draft.q ? (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => { onChange("q", ""); searchRef.current?.focus(); }}
                  className="inline-flex size-7 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40"
                >
                  <XIcon aria-hidden className="size-3.5" />
                </button>
              ) : (
                <kbd aria-hidden className="hidden h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1 font-sans text-[11px] text-muted-foreground sm:inline-flex">/</kbd>
              )}
            </span>
          </div>
          <div role="group" aria-label="Report basis" className="flex flex-wrap items-center gap-2">
            <OverviewCurrencyControl value={draft.currency} appliedValue={applied.currency} options={options.currency} onChange={value => onChange("currency", value)} />
            <OverviewAsOfControl value={draft.asOf} appliedValue={applied.asOf} today={today} onChange={value => onChange("asOf", value)} />
          </div>
        </div>

        {/* Row 2: filter pills + actions */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5 p-3 sm:px-4">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <ListFilterIcon aria-hidden className="size-3.5" />
            Filters
            {activeCount > 0 && (
              <span className="rounded-full bg-muted px-1.5 text-[11px] font-semibold tabular-nums text-foreground">
                {activeCount}<span className="sr-only"> applied</span>
              </span>
            )}
          </span>

          <div role="group" aria-label="Scope: group, client, brand, campaign" className="flex flex-wrap items-center gap-1">
            <OverviewOptionFilter label="Group" noun="groups" value={draft.groupId} appliedValue={applied.groupId} options={options.groupId} onChange={value => onChange("groupId", value)} />
            <ChevronRightIcon aria-hidden className="size-3.5 text-muted-foreground/50 max-sm:hidden" />
            <OverviewOptionFilter label="Client" noun="clients" value={draft.clientId} appliedValue={applied.clientId} options={options.clientId} note={pendingParent("groupId", "clients")} onChange={value => onChange("clientId", value)} />
            <ChevronRightIcon aria-hidden className="size-3.5 text-muted-foreground/50 max-sm:hidden" />
            <OverviewOptionFilter label="Brand" noun="brands" value={draft.brandId} appliedValue={applied.brandId} options={options.brandId} note={pendingParent("clientId", "brands") ?? pendingParent("groupId", "brands")} onChange={value => onChange("brandId", value)} />
            <ChevronRightIcon aria-hidden className="size-3.5 text-muted-foreground/50 max-sm:hidden" />
            <OverviewOptionFilter label="Campaign" noun="campaigns" value={draft.campaignId} appliedValue={applied.campaignId} options={options.campaignId} note={pendingParent("brandId", "campaigns") ?? pendingParent("clientId", "campaigns") ?? pendingParent("groupId", "campaigns")} onChange={value => onChange("campaignId", value)} />
          </div>

          <span aria-hidden className="hidden h-5 w-px bg-border lg:block" />

          <div role="group" aria-label="More filters" className="flex flex-wrap items-center gap-1.5">
            <OverviewOptionFilter label="Status" noun="statuses" value={draft.status} appliedValue={applied.status} options={options.status} formatLabel={STATUS_LABEL} onChange={value => onChange("status", value)} />
            <OverviewOptionFilter label="Client type" noun="client types" value={draft.clientType} appliedValue={applied.clientType} options={CLIENT_TYPE_OPTIONS} searchable={false} onChange={value => onChange("clientType", value)} />
            <OverviewOptionFilter label="Activity" noun="activity" value={draft.activity} appliedValue={applied.activity} options={ACTIVITY_OPTIONS} searchable={false} description={value => ACTIVITY_DETAIL[value]} onChange={value => onChange("activity", value)} />
            <OverviewDateRangeFilter
              from={draft.from}
              to={draft.to}
              appliedFrom={applied.from}
              appliedTo={applied.to}
              today={today}
              onChange={(from, to) => { onChange("from", from); onChange("to", to); }}
            />
          </div>

          <div
            className={cn(
              "ml-auto flex items-center gap-1.5",
              changeCount > 0 && !pending &&
                "max-sm:fixed max-sm:inset-x-3 max-sm:bottom-3 max-sm:z-[60] max-sm:justify-between max-sm:rounded-2xl max-sm:border max-sm:border-border max-sm:bg-card max-sm:p-2 max-sm:shadow-xl",
            )}
          >
            {changeCount > 0 && !pending && (
              <>
                <span role="status" className="mr-1 inline-flex items-center gap-1.5 pl-1 text-xs text-muted-foreground max-sm:sr-only">
                  <span aria-hidden className="size-1.5 rounded-full bg-[var(--amber)]" />
                  <span>{changeCount} {changeCount === 1 ? "change" : "changes"} not applied</span>
                </span>
                <Button type="button" size="sm" variant="ghost" onClick={onDiscard} title="Undo edits that have not been applied">Discard</Button>
              </>
            )}
            <Button type="button" size="sm" variant="ghost" onClick={onReset} disabled={pending} title="Clear all filters and show every campaign" className="text-muted-foreground">
              <RotateCcwIcon data-icon="inline-start" className="size-3.5" aria-hidden />
              Reset filters
            </Button>
            <Button type="submit" size="sm" disabled={pending} className="min-w-[7.5rem]">
              {pending ? "Applying…" : "Apply filters"}
              {!pending && changeCount > 0 && (
                <span className="ml-0.5 rounded-full bg-white/20 px-1.5 text-[11px] font-semibold tabular-nums">
                  {changeCount}<span className="sr-only"> pending</span>
                </span>
              )}
            </Button>
          </div>
        </div>
      </form>
    </section>
  );
}
