"use client";

import { XIcon } from "lucide-react";
import { useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

import {
  AiField,
  AudienceField,
  CategoryField,
  CommercialField,
  ContentSearchField,
  EngagementField,
  FollowerRangeField,
  LocationField,
  NameField,
  PlatformField,
} from "./creator-search-filter-fields";
import {
  creatorSearchSectionFilterCounts,
  type CreatorSearchFilters,
} from "./creator-search-types";

type Props = {
  filters: CreatorSearchFilters;
  onChange: (next: CreatorSearchFilters) => void;
  onClearAll: () => void;
  onClose?: () => void;
  total: number;
  loading?: boolean;
};

function SectionCountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#1D9E75] px-1.5 text-[10px] font-bold text-white">
      {count}
    </span>
  );
}

function FilterSection({
  title,
  count = 0,
  defaultOpen = true,
  children,
}: {
  title: string;
  count?: number;
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
        <span className="flex items-center gap-2">
          <span className="text-xs font-bold tracking-[-0.01em] text-[#0f172a]">{title}</span>
          <SectionCountBadge count={count} />
        </span>
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
  const sectionCounts = creatorSearchSectionFilterCounts(filters);

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="flex shrink-0 items-center justify-between border-b border-[#e2e8f0] px-6 py-4">
        <h2 className="text-[15px] font-bold tracking-[-0.02em] text-[#0f172a]">Filters</h2>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            title="Close"
            className="flex size-7 items-center justify-center rounded-md border border-[#e2e8f0] bg-white text-[#94a3b8] transition-all duration-120 hover:border-[#cbd5e1] hover:bg-[#f8fafc] hover:text-[#0f172a]"
            aria-label="Close filters"
          >
            <XIcon className="size-3.5" />
          </button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain [scrollbar-color:#e2e8f0_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-sm [&::-webkit-scrollbar-thumb]:bg-[#e2e8f0]">
        <FilterSection title="Content search" count={sectionCounts.content} defaultOpen>
          <ContentSearchField filters={filters} onChange={onChange} />
        </FilterSection>

        <FilterSection title="Audience data" count={sectionCounts.audience} defaultOpen>
          <AudienceField filters={filters} onChange={onChange} />
        </FilterSection>

        <FilterSection title="Creator metrics" count={sectionCounts.metrics} defaultOpen={false}>
          <NameField filters={filters} onChange={onChange} />
          <PlatformField filters={filters} onChange={onChange} />
          <FollowerRangeField filters={filters} onChange={onChange} />
          <EngagementField filters={filters} onChange={onChange} />
          <LocationField filters={filters} onChange={onChange} />
          <CategoryField filters={filters} onChange={onChange} />
        </FilterSection>

        <FilterSection title="Commercial" count={sectionCounts.commercial} defaultOpen={false}>
          <CommercialField filters={filters} onChange={onChange} />
        </FilterSection>

        <FilterSection title="AI scoring" count={sectionCounts.ai} defaultOpen={false}>
          <AiField filters={filters} onChange={onChange} />
        </FilterSection>
      </div>

      <div className="flex shrink-0 items-center gap-2.5 border-t border-[#e2e8f0] bg-white px-6 py-4">
        <button
          type="button"
          onClick={onClearAll}
          className="inline-flex h-[38px] shrink-0 items-center whitespace-nowrap rounded-md border border-[#e2e8f0] bg-white px-3.5 text-xs font-medium text-[#475569] transition-colors duration-120 hover:border-[#cbd5e1] hover:bg-[#f8fafc]"
        >
          Clear All Filters
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={loading || !onClose}
          className="h-[38px] flex-1 rounded-md border-0 bg-[#1D9E75] text-[13px] font-bold tracking-[-0.01em] text-white shadow-[0_2px_12px_rgba(29,158,117,0.28)] transition-all duration-150 hover:brightness-[1.06] hover:shadow-[0_4px_20px_rgba(29,158,117,0.38)] hover:[transform:translateY(-1px)] active:scale-[0.98] disabled:opacity-60"
        >
          {loading ? "Searching…" : `Show ${total.toLocaleString()} results`}
        </button>
      </div>
    </div>
  );
}
