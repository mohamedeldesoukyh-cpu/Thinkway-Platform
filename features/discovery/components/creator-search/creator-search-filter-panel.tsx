"use client";

import { XIcon } from "lucide-react";
import { useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

import {
  AiField,
  AudienceField,
  CategoryField,
  CommercialField,
  EngagementField,
  FollowerRangeField,
  LocationField,
  NameField,
  PlatformField,
} from "./creator-search-filter-fields";
import type { CreatorSearchFilters } from "./creator-search-types";

type Props = {
  filters: CreatorSearchFilters;
  onChange: (next: CreatorSearchFilters) => void;
  onClearAll: () => void;
  onClose: () => void;
  total: number;
  loading?: boolean;
};

function FilterSection({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={cn("border-b border-[#e2e8f0]", !open && "collapsed")}>
      <button
        type="button"
        className="flex w-full items-center justify-between px-6 py-[15px] pb-[13px] text-left transition-colors duration-120 hover:bg-[#f8fafc]"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span className="text-xs font-bold tracking-[-0.01em] text-[#0f172a]">{title}</span>
        <span
          className={cn(
            "text-[#94a3b8] transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]",
            !open && "-rotate-90"
          )}
        >
          <svg
            className="block size-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </span>
      </button>
      {open ? <div className="px-6 pb-5">{children}</div> : null}
    </section>
  );
}

export function CreatorSearchFilterPanel({
  filters,
  onChange,
  onClearAll,
  onClose,
  total,
  loading,
}: Props) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-white shadow-[-8px_0_40px_rgba(15,23,42,0.12)] animate-in slide-in-from-right-10 fade-in duration-[280ms] ease-[cubic-bezier(0.32,0.72,0,1)]">
      <div className="flex shrink-0 items-center justify-between border-b border-[#e2e8f0] px-6 py-4">
        <h2 className="text-[15px] font-bold tracking-[-0.02em] text-[#0f172a]">Filters</h2>
        <button
          type="button"
          onClick={onClose}
          title="Close"
          className="flex size-7 items-center justify-center rounded-md border border-[#e2e8f0] bg-white text-[#94a3b8] transition-all duration-120 hover:border-[#cbd5e1] hover:bg-[#f8fafc] hover:text-[#0f172a]"
          aria-label="Close filters"
        >
          <XIcon className="size-3.5" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain [scrollbar-color:#e2e8f0_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-sm [&::-webkit-scrollbar-thumb]:bg-[#e2e8f0]">
        <FilterSection title="Creator metrics">
          <NameField filters={filters} onChange={onChange} />
          <PlatformField filters={filters} onChange={onChange} />
          <FollowerRangeField filters={filters} onChange={onChange} />
          <EngagementField filters={filters} onChange={onChange} />
          <LocationField filters={filters} onChange={onChange} />
          <CategoryField filters={filters} onChange={onChange} />
        </FilterSection>

        <FilterSection title="Audience data">
          <AudienceField filters={filters} onChange={onChange} />
        </FilterSection>

        <FilterSection title="Commercial" defaultOpen={false}>
          <CommercialField filters={filters} onChange={onChange} />
        </FilterSection>

        <FilterSection title="AI scoring" defaultOpen={false}>
          <AiField filters={filters} onChange={onChange} />
        </FilterSection>
      </div>

      <div className="flex shrink-0 items-center gap-2.5 border-t border-[#e2e8f0] bg-white px-6 py-4">
        <button
          type="button"
          onClick={onClearAll}
          className="inline-flex h-[38px] shrink-0 items-center whitespace-nowrap rounded-md border border-[#e2e8f0] bg-white px-3.5 text-xs font-medium text-[#475569] transition-colors duration-120 hover:border-[#cbd5e1] hover:bg-[#f8fafc]"
        >
          Clear all
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="h-[38px] flex-1 rounded-md border-0 bg-gradient-to-br from-[#2563eb] to-[#4f46e5] text-[13px] font-bold tracking-[-0.01em] text-white shadow-[0_2px_12px_rgba(37,99,235,0.3)] transition-all duration-150 hover:brightness-[1.08] hover:shadow-[0_4px_20px_rgba(37,99,235,0.45)] hover:[transform:translateY(-1px)] active:scale-[0.98] disabled:opacity-60"
        >
          {loading ? "Searching…" : `Show ${total.toLocaleString()} results`}
        </button>
      </div>
    </div>
  );
}
