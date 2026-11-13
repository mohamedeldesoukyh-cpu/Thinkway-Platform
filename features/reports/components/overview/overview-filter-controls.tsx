"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { CalendarClockIcon, CalendarRangeIcon, CheckIcon, ChevronDownIcon, PlusIcon, SearchIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { OverviewOption } from "@/lib/reports/overview/overview-report";
import { cn } from "@/lib/utils";

import { formatOverviewDate, formatOverviewDateRange, overviewDatePresets } from "./overview-report-ui";

/* -------------------------------------------------------------------------- */
/* Pill                                                                        */
/* -------------------------------------------------------------------------- */

type PillState = { active: boolean; edited: boolean };

const pillShell = (state: PillState) =>
  cn(
    "relative inline-flex h-8 max-w-full items-stretch rounded-full border text-[13px] transition-colors",
    state.active
      ? "border-[color-mix(in_srgb,var(--blue)_32%,transparent)] bg-[var(--blue-light)] text-[var(--blue-text)]"
      : "border-dashed border-border bg-card text-muted-foreground hover:border-solid hover:border-[color-mix(in_srgb,var(--foreground)_22%,transparent)] hover:text-foreground",
  );

const pillButton =
  "inline-flex min-w-0 items-center gap-1.5 rounded-full px-3 outline-none focus-visible:ring-3 focus-visible:ring-ring/40 aria-expanded:bg-[color-mix(in_srgb,currentColor_8%,transparent)]";

/** Amber dot: this filter's draft value has not been applied yet. */
function EditedDot({ edited }: { edited: boolean }) {
  if (!edited) return null;
  return (
    <>
      <span aria-hidden className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-card bg-[var(--amber)]" />
      <span className="sr-only"> (changed, not applied)</span>
    </>
  );
}

function PillLabel({ label, value, icon }: { label: string; value?: string; icon?: ReactNode }) {
  return (
    <>
      {value ? icon : <PlusIcon aria-hidden className="size-3.5 shrink-0" />}
      <span className={cn("shrink-0", value && "text-[color-mix(in_srgb,currentColor_72%,transparent)]")}>{label}</span>
      {value && (
        <span className="min-w-0 max-w-[14rem] truncate font-semibold" title={value}>
          {value}
        </span>
      )}
    </>
  );
}

function ClearButton({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <button
      type="button"
      onClick={onClear}
      aria-label={`Clear ${label} filter`}
      className="-ml-1 mr-1 inline-flex size-6 shrink-0 items-center justify-center self-center rounded-full outline-none hover:bg-[color-mix(in_srgb,currentColor_12%,transparent)] focus-visible:ring-3 focus-visible:ring-ring/40"
    >
      <XIcon aria-hidden className="size-3.5" />
    </button>
  );
}

const panelClass = "w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border-border/60 p-0 shadow-xl";

/* -------------------------------------------------------------------------- */
/* Option filter (searchable listbox in a popover)                             */
/* -------------------------------------------------------------------------- */

type OptionFilterProps = {
  label: string;
  /** Plural noun for the "All …" option and search placeholder, e.g. "clients". */
  noun: string;
  value: string;
  appliedValue: string;
  options: readonly OverviewOption[];
  onChange: (value: string) => void;
  /** Shown above the list, e.g. when options still reflect the applied parent filter. */
  note?: string;
  formatLabel?: (label: string) => string;
  /** Search box appears automatically when there are more than 7 options. */
  searchable?: boolean;
  description?: (value: string) => string | undefined;
};

export function OverviewOptionFilter({
  label,
  noun,
  value,
  appliedValue,
  options,
  onChange,
  note,
  formatLabel = text => text,
  searchable,
  description,
}: OptionFilterProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const uid = useId();
  const listId = `${uid}-list`;
  const listRef = useRef<HTMLUListElement>(null);
  const showSearch = searchable ?? options.length > 7;

  const selected = options.find(option => option.value === value);
  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = [{ value: "", label: `All ${noun}` }, ...options];
    return q ? all.filter(item => item.value && formatLabel(item.label).toLowerCase().includes(q)) : all;
  }, [formatLabel, noun, options, query]);

  useEffect(() => {
    if (!open) return;
    document.getElementById(`${uid}-opt-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, open, uid]);

  const choose = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const last = items.length - 1;
    if (event.key === "ArrowDown") { event.preventDefault(); setActive(i => Math.min(last, i + 1)); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setActive(i => Math.max(0, i - 1)); }
    else if (event.key === "Home" && !showSearch) { event.preventDefault(); setActive(0); }
    else if (event.key === "End" && !showSearch) { event.preventDefault(); setActive(last); }
    else if (event.key === "Enter" || (event.key === " " && !showSearch)) {
      event.preventDefault();
      const item = items[active];
      if (item) choose(item.value);
    }
  };

  const state = { active: Boolean(value), edited: value !== appliedValue };
  const shownValue = selected ? formatLabel(selected.label) : value || undefined;

  return (
    <span className={pillShell(state)}>
      <Popover
        open={open}
        onOpenChange={next => {
          setOpen(next);
          if (next) {
            setQuery("");
            setActive(Math.max(0, [{ value: "" }, ...options].findIndex(option => option.value === value)));
          }
        }}
      >
        <PopoverTrigger asChild>
          <button type="button" aria-haspopup="listbox" className={pillButton}>
            <PillLabel label={label} value={shownValue} />
            {!value && <ChevronDownIcon aria-hidden className="size-3.5 shrink-0 opacity-60" />}
            <EditedDot edited={state.edited} />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className={panelClass}
          onOpenAutoFocus={event => {
            event.preventDefault();
            (showSearch ? document.getElementById(`${uid}-search`) : listRef.current)?.focus();
          }}
        >
          <div className="flex items-baseline justify-between gap-3 border-b border-border/50 px-3.5 pb-2 pt-3">
            <p className="text-xs font-semibold text-foreground">{label}</p>
            <p className="text-[11px] tabular-nums text-muted-foreground">{options.length} {options.length === 1 ? "option" : "options"}</p>
          </div>
          {showSearch && (
            <div className="relative border-b border-border/50 p-2">
              <SearchIcon aria-hidden className="pointer-events-none absolute left-4.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                id={`${uid}-search`}
                role="combobox"
                aria-expanded
                aria-controls={listId}
                aria-activedescendant={items[active] ? `${uid}-opt-${active}` : undefined}
                aria-label={`Search ${noun}`}
                autoComplete="off"
                value={query}
                placeholder={`Search ${noun}`}
                onChange={event => { setQuery(event.target.value); setActive(0); }}
                onKeyDown={onKeyDown}
                className="h-8 w-full rounded-lg bg-muted/60 pl-7 pr-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
              />
            </div>
          )}
          {note && <p className="border-b border-border/50 bg-[var(--amber-bg)] px-3.5 py-2 text-[11px] leading-4 text-[var(--amber-text)]">{note}</p>}
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={label}
            tabIndex={showSearch ? -1 : 0}
            aria-activedescendant={!showSearch && items[active] ? `${uid}-opt-${active}` : undefined}
            onKeyDown={showSearch ? undefined : onKeyDown}
            className="max-h-[min(18rem,50dvh)] overflow-y-auto p-1.5 outline-none"
          >
            {items.length === 0 && <li className="px-3 py-6 text-center text-xs text-muted-foreground">No {noun} match “{query}”.</li>}
            {items.map((item, index) => {
              const isSelected = item.value === value;
              const text = item.value ? formatLabel(item.label) : item.label;
              const detail = item.value ? description?.(item.value) : undefined;
              return (
                <li
                  key={item.value || "__all"}
                  id={`${uid}-opt-${index}`}
                  role="option"
                  aria-selected={isSelected}
                  onMouseMove={() => setActive(index)}
                  onClick={() => choose(item.value)}
                  className={cn(
                    "flex cursor-pointer items-start gap-2 rounded-lg px-2.5 py-1.5 text-sm",
                    index === active && "bg-muted",
                    !item.value && "text-muted-foreground",
                  )}
                >
                  <CheckIcon aria-hidden className={cn("mt-0.5 size-3.5 shrink-0 text-[var(--blue-text)]", !isSelected && "invisible")} />
                  <span className="min-w-0">
                    <span className={cn("block break-words", isSelected && "font-semibold text-foreground")}>{text}</span>
                    {detail && <span className="block text-[11px] leading-4 text-muted-foreground">{detail}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        </PopoverContent>
      </Popover>
      {value && <ClearButton label={label} onClear={() => onChange("")} />}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Campaign start date range                                                   */
/* -------------------------------------------------------------------------- */

type DateRangeFilterProps = {
  from: string;
  to: string;
  appliedFrom: string;
  appliedTo: string;
  today: string;
  onChange: (from: string, to: string) => void;
};

export function OverviewDateRangeFilter({ from, to, appliedFrom, appliedTo, today, onChange }: DateRangeFilterProps) {
  const [open, setOpen] = useState(false);
  const presets = overviewDatePresets(today);
  const value = formatOverviewDateRange(from, to);
  const state = { active: Boolean(from || to), edited: from !== appliedFrom || to !== appliedTo };
  const reversed = Boolean(from && to && from > to);

  return (
    <span className={pillShell(state)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" aria-haspopup="dialog" className={pillButton}>
            <PillLabel label="Campaign start" value={value || undefined} icon={<CalendarRangeIcon aria-hidden className="size-3.5 shrink-0" />} />
            {!value && <ChevronDownIcon aria-hidden className="size-3.5 shrink-0 opacity-60" />}
            <EditedDot edited={state.edited} />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" aria-label="Campaign start dates" className={cn(panelClass, "w-[min(22rem,calc(100vw-1.5rem))]")}>
          <div className="space-y-3 p-3.5">
            <div>
              <p className="text-xs font-semibold text-foreground">Campaign start date</p>
              <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">Shows campaigns that start within this range. Not related to publication dates.</p>
            </div>
            <div role="group" aria-label="Quick ranges" className="flex flex-wrap gap-1.5">
              {presets.map(preset => {
                const on = preset.from === from && preset.to === to;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => onChange(preset.from, preset.to)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/40",
                      on ? "border-transparent bg-[var(--blue)] font-medium text-white" : "border-border text-foreground hover:bg-muted",
                    )}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="grid gap-1 text-[11px] font-medium text-muted-foreground">
                From
                <Input type="date" value={from} onChange={event => onChange(event.target.value, to)} className="h-9 text-sm" />
              </label>
              <label className="grid gap-1 text-[11px] font-medium text-muted-foreground">
                To
                <Input type="date" value={to} onChange={event => onChange(from, event.target.value)} className="h-9 text-sm" />
              </label>
            </div>
            {reversed && <p className="text-[11px] text-[var(--amber-text)]">From is after To; the report will swap them when applied.</p>}
          </div>
          <div className="flex items-center justify-between border-t border-border/50 bg-muted/30 px-3.5 py-2.5">
            <Button type="button" variant="ghost" size="xs" disabled={!from && !to} onClick={() => onChange("", "")}>Clear dates</Button>
            <Button type="button" size="xs" onClick={() => setOpen(false)}>Done</Button>
          </div>
        </PopoverContent>
      </Popover>
      {(from || to) && <ClearButton label="Campaign start" onClear={() => onChange("", "")} />}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Report basis: went-live as-of date + display currency                      */
/* -------------------------------------------------------------------------- */

export function OverviewAsOfControl({ value, appliedValue, today, onChange }: { value: string; appliedValue: string; today: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const edited = value !== appliedValue;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-haspopup="dialog"
          aria-label={`Went live as of ${formatOverviewDate(value) || "today"}. Change date`}
          className="relative inline-flex h-9 items-center gap-2 rounded-full border border-border bg-card pl-3 pr-2.5 text-[13px] outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/40 aria-expanded:bg-muted"
        >
          <CalendarClockIcon aria-hidden className="size-4 text-muted-foreground max-sm:hidden" />
          <span className="text-muted-foreground"><span className="max-sm:hidden">Went live </span>as of</span>
          <span className="font-semibold text-foreground">{formatOverviewDate(value) || "Today"}</span>
          <ChevronDownIcon aria-hidden className="size-3.5 text-muted-foreground max-sm:hidden" />
          <EditedDot edited={edited} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" aria-label="Went live as of" className={cn(panelClass, "w-[min(19rem,calc(100vw-1.5rem))]")}>
        <div className="space-y-3 p-3.5">
          <div>
            <p className="text-xs font-semibold text-foreground">Went live as of</p>
            <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
              Splits current campaign values into actual (published by this date) and accrued (not yet live). It is not a historical accounting snapshot.
            </p>
          </div>
          <Input type="date" aria-label="Went live as of date" value={value} max={today} onChange={event => onChange(event.target.value)} className="h-9 text-sm" />
        </div>
        <div className="flex items-center justify-between border-t border-border/50 bg-muted/30 px-3.5 py-2.5">
          <Button type="button" variant="ghost" size="xs" disabled={value === today} onClick={() => onChange(today)}>Today</Button>
          <Button type="button" size="xs" onClick={() => setOpen(false)}>Done</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function OverviewCurrencyControl({ value, appliedValue, options, onChange }: { value: string; appliedValue: string; options: readonly OverviewOption[]; onChange: (value: string) => void }) {
  const name = useId();
  if (options.length > 5) {
    return (
      <OverviewOptionFilter label="Currency" noun="currencies" value={value} appliedValue={appliedValue} options={options} onChange={next => next && onChange(next)} />
    );
  }
  return (
    <fieldset className="relative inline-flex h-9 items-center rounded-full border border-border bg-muted/50 p-0.5">
      <legend className="sr-only">Display currency</legend>
      {options.map(option => {
        const checked = option.value === value;
        return (
          <label
            key={option.value}
            className={cn(
              "relative inline-flex h-full cursor-pointer items-center rounded-full px-2.5 text-xs sm:px-3 font-semibold tracking-wide transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/40",
              checked ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <input type="radio" name={name} value={option.value} checked={checked} onChange={() => onChange(option.value)} className="sr-only" />
            {option.label}
          </label>
        );
      })}
      {value !== appliedValue && <EditedDot edited />}
    </fieldset>
  );
}
