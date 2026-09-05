"use client";

import { XIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";

import { cn } from "@/lib/utils";

export const DISCOVERY_FILTER_SECTIONS_STORAGE_KEY =
  "discovery-search-filter-sections";

export const DISCOVERY_FILTER_DRAWER_BODY_CLASS =
  "discovery-filter-drawer-body flex min-h-0 flex-1 flex-col bg-[#eef2f8] px-4 pb-4 pt-3.5 dark:bg-muted";

export const DISCOVERY_FILTER_DRAWER_SCROLL_CLASS =
  "discovery-filter-drawer-scroll min-h-0 flex-1 overflow-y-auto overscroll-y-contain rounded-2xl border border-[rgba(0,87,255,0.14)] bg-white px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_8px_24px_rgba(0,87,255,0.06)] [scrollbar-color:#e2e8f0_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-sm [&::-webkit-scrollbar-thumb]:bg-[#e2e8f0] dark:border-border dark:bg-card dark:shadow-none dark:[scrollbar-color:var(--border)_transparent] dark:[&::-webkit-scrollbar-thumb]:bg-border";

export function DiscoveryFilterSectionCountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="discovery-filter-drawer-section__count flex h-5 min-w-5 items-center justify-center rounded-full bg-[#0057FF] px-1.5 text-[10px] font-bold text-white">
      {count}
    </span>
  );
}

export function useDiscoveryFilterSectionState(
  sectionId: string,
  defaultOpen = false,
): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DISCOVERY_FILTER_SECTIONS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, boolean>;
      if (sectionId in parsed) setOpen(parsed[sectionId]);
    } catch {
      /* ignore malformed storage */
    }
  }, [sectionId]);

  const setSectionOpen = useCallback(
    (next: boolean) => {
      setOpen(next);
      try {
        const raw = localStorage.getItem(DISCOVERY_FILTER_SECTIONS_STORAGE_KEY);
        const parsed = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
        parsed[sectionId] = next;
        localStorage.setItem(
          DISCOVERY_FILTER_SECTIONS_STORAGE_KEY,
          JSON.stringify(parsed),
        );
      } catch {
        /* ignore storage failures */
      }
    },
    [sectionId],
  );

  return [open, setSectionOpen];
}

type DiscoveryFilterDrawerSectionProps = {
  sectionId: string;
  title: string;
  icon?: ReactNode;
  count?: number;
  defaultOpen?: boolean;
  onClearSection?: () => void;
  children: ReactNode;
};

export function DiscoveryFilterDrawerSection({
  sectionId,
  title,
  icon: _icon,
  count = 0,
  defaultOpen = false,
  onClearSection,
  children,
}: DiscoveryFilterDrawerSectionProps) {
  const [open, setOpen] = useDiscoveryFilterSectionState(
    sectionId,
    defaultOpen,
  );
  const modified = count > 0;

  return (
    <section
      className={cn(
        "tw-fsec discovery-filter-drawer-section",
        modified && "discovery-filter-drawer-section--modified",
        !open && "discovery-filter-drawer-section--collapsed",
      )}
    >
      <button
        type="button"
        className="tw-fsec__h"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <b>{title}</b>
        {count > 0 ? <span className="tw-cs">{count}</span> : null}
        {modified && onClearSection ? (
          <span
            role="button"
            tabIndex={0}
            className="tw-more"
            onClick={(event) => {
              event.stopPropagation();
              onClearSection();
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.stopPropagation();
              onClearSection();
            }}
          >
            Clear
          </span>
        ) : null}
        <span className="ar">{open ? "▾" : "▸"}</span>
      </button>
      {open ? <div className="tw-fsec__b">{children}</div> : null}
    </section>
  );
}

type DiscoveryFilterActiveChip = {
  id: string;
  label: string;
  onRemove: () => void;
};

type DiscoveryFilterActiveSummaryProps = {
  chips: DiscoveryFilterActiveChip[];
  onClearAll: () => void;
};

export function DiscoveryFilterActiveSummary({
  chips,
  onClearAll,
}: DiscoveryFilterActiveSummaryProps) {
  if (chips.length === 0) return null;

  return (
    <div className="discovery-filter-drawer-active-summary mb-3 shrink-0">
      <div className="discovery-filter-drawer-active-summary__card overflow-hidden rounded-2xl border border-[rgba(0,87,255,0.2)] bg-[linear-gradient(135deg,rgba(239,246,255,0.98)_0%,rgba(255,255,255,0.98)_100%)] px-4 py-3.5 shadow-[0_10px_32px_rgba(0,87,255,0.08),0_2px_8px_rgba(15,23,42,0.06)] dark:border-[rgba(0,87,255,0.28)] dark:bg-[linear-gradient(135deg,rgba(0,87,255,0.1)_0%,rgba(24,24,27,0.98)_100%)] dark:shadow-[0_10px_32px_rgba(0,0,0,0.35)]">
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[#64748b] dark:text-muted-foreground">
            {chips.length} active filter{chips.length === 1 ? "" : "s"}
          </p>
          <button
            type="button"
            onClick={onClearAll}
            className="shrink-0 text-[11px] font-medium text-[#0057FF] transition-colors hover:text-[#0046cc] dark:text-blue-400 dark:hover:text-blue-300"
          >
            Clear all
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={chip.onRemove}
              className={cn(
                "group inline-flex max-w-full items-center gap-1 rounded-full border border-[rgba(0,87,255,0.18)] dark:border-[rgba(0,87,255,0.28)] bg-white dark:bg-card py-1 pr-1.5 pl-2.5",
                "text-[11px] font-medium text-[#0057FF] dark:text-blue-300 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:bg-[rgba(239,246,255,0.95)] dark:hover:bg-primary/10",
              )}
            >
              <span className="truncate">{chip.label}</span>
              <XIcon className="size-3 shrink-0 opacity-60 transition-opacity group-hover:opacity-100" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

type DiscoveryFilterDrawerProps = {
  title?: string;
  description?: string;
  onClose?: () => void;
  activeSummary?: ReactNode;
  children: ReactNode;
  footer: ReactNode;
  className?: string;
};

/** Pack right drawer — `tw-dr` / `tw-dr__i` / `tw-dr__b` / `tw-dr__a`. */
export function DiscoveryFilterDrawer({
  title = "Search filters",
  description,
  onClose,
  activeSummary,
  children,
  footer,
  className,
}: DiscoveryFilterDrawerProps) {
  return (
    <div
      className={cn(
        "discovery-suite discovery-filter-drawer flex h-full min-h-0 flex-col overflow-hidden bg-white",
        className,
      )}
    >
      <div className="tw-dr__h">
        <span className="k">Discovery</span>
        <span className="tw-sp" />
        {onClose ? (
          <button
            type="button"
            className="tw-dr__x"
            onClick={onClose}
            aria-label="Close"
          >
            &#10005;
          </button>
        ) : null}
      </div>
      <div className="tw-dr__i">
        <b>{title}</b>
        {description ? <p>{description}</p> : null}
      </div>
      {activeSummary ? (
        <div className="px-4 pt-3">{activeSummary}</div>
      ) : null}
      <div className="tw-dr__b min-h-0 flex-1 overflow-y-auto">{children}</div>
      {footer}
    </div>
  );
}

type DiscoveryFilterDrawerFooterProps = {
  onClear: () => void;
  onApply?: () => void;
  applyLabel: string;
  clearLabel?: string;
  activeCount?: number;
  loading?: boolean;
  disabled?: boolean;
};

export function DiscoveryFilterDrawerFooter({
  onClear,
  onApply,
  applyLabel,
  clearLabel = "Clear Filters",
  activeCount,
  loading,
  disabled,
}: DiscoveryFilterDrawerFooterProps) {
  return (
    <div className="tw-dr__a">
      <button type="button" className="tw-b sm" onClick={onClear}>
        {clearLabel}
      </button>
      {activeCount != null ? (
        <span className="tw-cs" aria-live="polite">
          {activeCount} active
        </span>
      ) : null}
      <span className="tw-sp" />
      <button
        type="button"
        className="tw-b sm pri"
        onClick={onApply}
        disabled={disabled || loading || !onApply}
      >
        {applyLabel}
      </button>
    </div>
  );
}
