"use client";

import { ChevronDownIcon } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { DISCOVERY_PLATFORMS } from "@/lib/discovery/types";
import { cn } from "@/lib/utils";

import type { CreatorSearchFilters } from "./creator-search-types";

type Props = {
  filters: CreatorSearchFilters;
  onChange: (next: CreatorSearchFilters) => void;
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
    <section className="border-b border-[#E6EAF2] py-3">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="text-[12px] font-semibold text-[#0B0F1A]">{title}</span>
        <ChevronDownIcon
          className={cn(
            "size-4 shrink-0 text-[#9099A8] transition-transform",
            open && "rotate-180"
          )}
        />
      </button>
      {open ? <div className="mt-3 space-y-3">{children}</div> : null}
    </section>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <p className="text-[11px] font-medium text-[#5B6575]">{children}</p>;
}

function PlatformPill({
  platform,
  selected,
  onToggle,
}: {
  platform: string;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "rounded-full border px-2.5 py-1 text-[11px] font-medium capitalize transition-colors",
        selected
          ? "border-[#0057FF] bg-[#EEF4FF] text-[#0057FF]"
          : "border-[#E6EAF2] bg-white text-[#5B6575] hover:border-[#0057FF]/40"
      )}
    >
      {platform}
    </button>
  );
}

export function CreatorSearchFilterSidebar({ filters, onChange }: Props) {
  function patch(partial: Partial<CreatorSearchFilters>) {
    onChange({ ...filters, ...partial });
  }

  function togglePlatform(platform: string) {
    const set = new Set(filters.platforms);
    if (set.has(platform)) set.delete(platform);
    else set.add(platform);
    patch({ platforms: [...set] });
  }

  return (
    <aside className="flex h-full w-[320px] shrink-0 flex-col border-r border-[#E6EAF2] bg-[#FAFBFD]">
      <div className="shrink-0 border-b border-[#E6EAF2] px-4 py-3">
        <h2 className="text-[13px] font-semibold text-[#0B0F1A]">Filters</h2>
        <p className="mt-0.5 text-[11px] text-[#9099A8]">Always visible · refine as you scan</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 pb-6">
        <FilterSection title="Basic">
          <div className="space-y-1.5">
            <FieldLabel>Creator name / handle</FieldLabel>
            <Input
              value={filters.handle}
              onChange={(e) => patch({ handle: e.target.value })}
              placeholder="@username"
              className="h-8 border-[#E6EAF2] bg-white text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Platform</FieldLabel>
            <div className="flex flex-wrap gap-1.5">
              {DISCOVERY_PLATFORMS.map((p) => (
                <PlatformPill
                  key={p}
                  platform={p}
                  selected={filters.platforms.includes(p)}
                  onToggle={() => togglePlatform(p)}
                />
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <FieldLabel>Country</FieldLabel>
              <Input
                value={filters.country}
                onChange={(e) => patch({ country: e.target.value.toUpperCase() })}
                placeholder="AE"
                className="h-8 border-[#E6EAF2] bg-white text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Language</FieldLabel>
              <Input
                value={filters.language}
                onChange={(e) => patch({ language: e.target.value })}
                placeholder="en"
                className="h-8 border-[#E6EAF2] bg-white text-xs"
              />
            </div>
          </div>
        </FilterSection>

        <FilterSection title="Audience" defaultOpen>
          <div className="space-y-1.5">
            <FieldLabel>Audience country</FieldLabel>
            <Input
              value={filters.audienceCountry}
              onChange={(e) => patch({ audienceCountry: e.target.value })}
              placeholder="AE"
              className="h-8 border-[#E6EAF2] bg-white text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Audience interests</FieldLabel>
            <Input
              value={filters.audienceInterests}
              onChange={(e) => patch({ audienceInterests: e.target.value })}
              placeholder="beauty, fashion"
              className="h-8 border-[#E6EAF2] bg-white text-xs"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <FieldLabel>Gender</FieldLabel>
              <Input
                value={filters.gender}
                onChange={(e) => patch({ gender: e.target.value })}
                placeholder="Any"
                className="h-8 border-[#E6EAF2] bg-white text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Age range</FieldLabel>
              <div className="flex items-center gap-1">
                <Input
                  value={filters.ageMin}
                  onChange={(e) => patch({ ageMin: e.target.value })}
                  placeholder="18"
                  className="h-8 border-[#E6EAF2] bg-white text-xs"
                />
                <span className="text-[10px] text-[#9099A8]">–</span>
                <Input
                  value={filters.ageMax}
                  onChange={(e) => patch({ ageMax: e.target.value })}
                  placeholder="35"
                  className="h-8 border-[#E6EAF2] bg-white text-xs"
                />
              </div>
            </div>
          </div>
        </FilterSection>

        <FilterSection title="Performance" defaultOpen>
          <div className="space-y-1.5">
            <FieldLabel>Followers range</FieldLabel>
            <div className="flex items-center gap-1">
              <Input
                value={filters.minFollowers}
                onChange={(e) => patch({ minFollowers: e.target.value })}
                placeholder="Min"
                type="number"
                className="h-8 border-[#E6EAF2] bg-white text-xs"
              />
              <span className="text-[10px] text-[#9099A8]">–</span>
              <Input
                value={filters.maxFollowers}
                onChange={(e) => patch({ maxFollowers: e.target.value })}
                placeholder="Max"
                type="number"
                className="h-8 border-[#E6EAF2] bg-white text-xs"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <FieldLabel>Min engagement %</FieldLabel>
              <Input
                value={filters.minEngagement}
                onChange={(e) => patch({ minEngagement: e.target.value })}
                type="number"
                className="h-8 border-[#E6EAF2] bg-white text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Min avg views</FieldLabel>
              <Input
                value={filters.minViews}
                onChange={(e) => patch({ minViews: e.target.value })}
                type="number"
                className="h-8 border-[#E6EAF2] bg-white text-xs"
              />
            </div>
          </div>
        </FilterSection>

        <FilterSection title="Commercial" defaultOpen={false}>
          <div className="space-y-1.5">
            <FieldLabel>Estimated cost range</FieldLabel>
            <div className="flex items-center gap-1">
              <Input
                value={filters.minEstimatedCost}
                onChange={(e) => patch({ minEstimatedCost: e.target.value })}
                placeholder="Min"
                type="number"
                className="h-8 border-[#E6EAF2] bg-white text-xs"
              />
              <span className="text-[10px] text-[#9099A8]">–</span>
              <Input
                value={filters.maxEstimatedCost}
                onChange={(e) => patch({ maxEstimatedCost: e.target.value })}
                placeholder="Max"
                type="number"
                className="h-8 border-[#E6EAF2] bg-white text-xs"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Category</FieldLabel>
            <Input
              value={filters.category}
              onChange={(e) => patch({ category: e.target.value })}
              placeholder="beauty"
              className="h-8 border-[#E6EAF2] bg-white text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Min brand safety score</FieldLabel>
            <Input
              value={filters.minBrandSafety}
              onChange={(e) => patch({ minBrandSafety: e.target.value })}
              type="number"
              placeholder="60"
              className="h-8 border-[#E6EAF2] bg-white text-xs"
            />
          </div>
        </FilterSection>

        <FilterSection title="AI" defaultOpen={false}>
          <div className="space-y-1.5">
            <FieldLabel>Min Thinkway AI score</FieldLabel>
            <Input
              value={filters.minThinkwayScore}
              onChange={(e) => patch({ minThinkwayScore: e.target.value })}
              type="number"
              placeholder="50"
              className="h-8 border-[#E6EAF2] bg-white text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Min brand fit (AI)</FieldLabel>
            <Input
              value={filters.minBrandFit}
              onChange={(e) => patch({ minBrandFit: e.target.value })}
              type="number"
              className="h-8 border-[#E6EAF2] bg-white text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>AI niche match</FieldLabel>
            <Input
              value={filters.aiNiche}
              onChange={(e) => patch({ aiNiche: e.target.value })}
              placeholder="beauty, luxury"
              className="h-8 border-[#E6EAF2] bg-white text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Min content quality (AI)</FieldLabel>
            <Input
              value={filters.minAiScore}
              onChange={(e) => patch({ minAiScore: e.target.value })}
              type="number"
              className="h-8 border-[#E6EAF2] bg-white text-xs"
            />
          </div>
        </FilterSection>
      </div>
    </aside>
  );
}
