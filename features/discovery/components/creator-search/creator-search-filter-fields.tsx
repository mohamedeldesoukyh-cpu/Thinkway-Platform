"use client";

import { PlusIcon } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { toggleCategoryInList } from "@/lib/creators/category-filter";
import { DISCOVERY_PLATFORMS } from "@/lib/discovery/types";
import { cn } from "@/lib/utils";

import type { CreatorSearchFilters } from "./creator-search-types";

/** Filter panel palette — matches thinkway-filter-panel HTML mockup */
const FP_BLUE = "#2563eb";
const FP_LABEL = "#94a3b8";

type FieldProps = {
  filters: CreatorSearchFilters;
  onChange: (next: CreatorSearchFilters) => void;
};

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  twitter: "X (Twitter)",
};

const FOLLOWER_PRESETS = [
  { id: "nano", label: "Nano · 1k–10k", min: "1000", max: "10000" },
  { id: "micro", label: "Micro · 10k–50k", min: "10000", max: "50000" },
  { id: "mid", label: "Mid · 50k–500k", min: "50000", max: "500000" },
  { id: "macro", label: "Macro · 500k–1M", min: "500000", max: "1000000" },
  { id: "mega", label: "Mega · 1M+", min: "1000000", max: "" },
] as const;

const ENGAGEMENT_PRESETS = ["1", "2", "3", "5"] as const;

const THINKWAY_SCORE_PRESETS = ["40", "50", "60", "70", "80"] as const;

const QUICK_CATEGORIES = [
  "Beauty",
  "Fashion",
  "Fitness",
  "Food",
  "Travel",
  "Lifestyle",
  "Tech",
  "Gaming",
] as const;

const QUICK_INTERESTS = [
  "Beauty & Cosmetics",
  "Fashion",
  "Health & Wellness",
  "Food & Drink",
  "Travel",
  "Photography",
] as const;

const GENDER_OPTIONS = [
  { value: "", label: "Any" },
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
] as const;

export function FieldLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "mb-[7px] text-[10px] font-bold uppercase tracking-[0.05em]",
        className
      )}
      style={{ color: FP_LABEL }}
    >
      {children}
    </p>
  );
}

export function FieldHint({ children }: { children: ReactNode }) {
  return (
    <p className="mt-[5px] text-[10px]" style={{ color: FP_LABEL }}>
      {children}
    </p>
  );
}

const filterInputClass =
  "h-9 rounded-md border-[#e2e8f0] bg-white px-3 text-xs text-[#0f172a] shadow-none placeholder:text-[#94a3b8] focus-visible:border-[#2563eb] focus-visible:ring-[3px] focus-visible:ring-[#2563eb]/[0.08]";

export function FilterInput(props: React.ComponentProps<typeof Input>) {
  return <Input className={cn(filterInputClass, props.className)} {...props} />;
}

export function FilterSelect({
  className,
  children,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <select className={cn(filterInputClass, "cursor-pointer", className)} {...props}>
      {children}
    </select>
  );
}

export function FilterChip({
  label,
  active,
  onToggle,
}: {
  label: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className={cn(
        "inline-flex h-[26px] shrink-0 items-center gap-1 whitespace-nowrap rounded-[20px] border px-2.5 text-[11px] font-medium transition-all duration-[140ms]",
        active
          ? "border-[#93c5fd] bg-[#eff6ff] font-semibold text-[#1d4ed8]"
          : "border-[#e2e8f0] bg-white text-[#475569] hover:border-[#93c5fd] hover:bg-[#eff6ff] hover:text-[#1d4ed8]"
      )}
    >
      <span>{label}</span>
      {active ? (
        <span className="ml-px text-[12px] leading-none text-[#1d4ed8]">×</span>
      ) : (
        <span
          className="ml-px flex size-3.5 items-center justify-center rounded-full text-[10px] font-bold"
          style={{ backgroundColor: "rgba(37,99,235,.1)", color: FP_BLUE }}
        >
          +
        </span>
      )}
    </button>
  );
}

export function RatePill({
  label,
  active,
  onToggle,
}: {
  label: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className={cn(
        "inline-flex h-7 shrink-0 items-center rounded-md border px-3 text-[11px] font-semibold transition-all duration-[140ms]",
        active
          ? "border-[#2563eb] bg-[#2563eb] text-white"
          : "border-[#e2e8f0] bg-white text-[#475569] hover:border-[#93c5fd] hover:bg-[#eff6ff] hover:text-[#1d4ed8]"
      )}
    >
      {label}
    </button>
  );
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex overflow-hidden rounded-md border border-[#e2e8f0]",
        className
      )}
      role="group"
    >
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value || "any"}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex-1 border-r border-[#e2e8f0] px-2 py-[7px] text-center text-[11px] font-medium transition-colors last:border-r-0",
              selected
                ? "bg-[#eff6ff] font-semibold text-[#1d4ed8]"
                : "text-[#94a3b8] hover:bg-[#f8fafc] hover:text-[#475569]"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function RangeRow({
  min,
  max,
  onMinChange,
  onMaxChange,
  minPlaceholder = "Min",
  maxPlaceholder = "Max",
  type = "text",
}: {
  min: string;
  max: string;
  onMinChange: (value: string) => void;
  onMaxChange: (value: string) => void;
  minPlaceholder?: string;
  maxPlaceholder?: string;
  type?: "text" | "number";
}) {
  return (
    <div className="flex items-center gap-2">
      <FilterInput
        value={min}
        onChange={(e) => onMinChange(e.target.value)}
        placeholder={minPlaceholder}
        type={type}
        className="flex-1"
      />
      <span className="shrink-0 text-xs text-[#94a3b8]">—</span>
      <FilterInput
        value={max}
        onChange={(e) => onMaxChange(e.target.value)}
        placeholder={maxPlaceholder}
        type={type}
        className="flex-1"
      />
    </div>
  );
}

function ClearLink({ onClear }: { onClear: () => void }) {
  return (
    <button
      type="button"
      onClick={onClear}
      className="text-[10px] font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
    >
      Clear
    </button>
  );
}

function FieldGroup({
  label,
  onClear,
  showClear,
  children,
  className,
}: {
  label: string;
  onClear?: () => void;
  showClear?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mt-3.5 first:mt-0", className)}>
      <div className="mb-[7px] flex items-center justify-between gap-2">
        <FieldLabel className="mb-0">{label}</FieldLabel>
        {showClear && onClear ? <ClearLink onClear={onClear} /> : null}
      </div>
      {children}
    </div>
  );
}

/* ---------------------------------- groups --------------------------------- */

export function PlatformField({ filters, onChange }: FieldProps) {
  function toggle(platform: string) {
    const set = new Set(filters.platforms);
    if (set.has(platform)) set.delete(platform);
    else set.add(platform);
    onChange({ ...filters, platforms: [...set] });
  }
  return (
    <FieldGroup
      label="Social platform"
      showClear={filters.platforms.length > 0}
      onClear={() => onChange({ ...filters, platforms: [] })}
    >
      <div className="flex flex-wrap gap-1.5">
        {DISCOVERY_PLATFORMS.map((platform) => (
          <FilterChip
            key={platform}
            label={PLATFORM_LABELS[platform] ?? platform}
            active={filters.platforms.includes(platform)}
            onToggle={() => toggle(platform)}
          />
        ))}
      </div>
    </FieldGroup>
  );
}

export function FollowerRangeField({ filters, onChange }: FieldProps) {
  const activePreset = FOLLOWER_PRESETS.find(
    (p) => p.min === filters.minFollowers && p.max === filters.maxFollowers
  );
  function applyPreset(preset: (typeof FOLLOWER_PRESETS)[number]) {
    if (activePreset?.id === preset.id) {
      onChange({ ...filters, minFollowers: "", maxFollowers: "" });
    } else {
      onChange({ ...filters, minFollowers: preset.min, maxFollowers: preset.max });
    }
  }
  return (
    <FieldGroup
      label="Follower range"
      showClear={Boolean(filters.minFollowers || filters.maxFollowers)}
      onClear={() => onChange({ ...filters, minFollowers: "", maxFollowers: "" })}
    >
      <div className="mb-2 flex flex-wrap gap-1.5">
        {FOLLOWER_PRESETS.map((preset) => (
          <FilterChip
            key={preset.id}
            label={preset.label}
            active={activePreset?.id === preset.id}
            onToggle={() => applyPreset(preset)}
          />
        ))}
      </div>
      <RangeRow
        min={filters.minFollowers}
        max={filters.maxFollowers}
        onMinChange={(value) => onChange({ ...filters, minFollowers: value })}
        onMaxChange={(value) => onChange({ ...filters, maxFollowers: value })}
        type="number"
      />
      <FieldHint>Custom follower range</FieldHint>
    </FieldGroup>
  );
}

export function EngagementField({ filters, onChange }: FieldProps) {
  return (
    <>
      <FieldGroup label="Minimum engagement rate">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {ENGAGEMENT_PRESETS.map((value) => (
            <RatePill
              key={value}
              label={`${value}%+`}
              active={filters.minEngagement === value}
              onToggle={() =>
                onChange({
                  ...filters,
                  minEngagement: filters.minEngagement === value ? "" : value,
                })
              }
            />
          ))}
        </div>
        <FilterInput
          value={filters.minEngagement}
          onChange={(e) => onChange({ ...filters, minEngagement: e.target.value })}
          type="number"
          placeholder="Custom %"
        />
      </FieldGroup>
      <FieldGroup label="Minimum average views">
        <FilterInput
          value={filters.minViews}
          onChange={(e) => onChange({ ...filters, minViews: e.target.value })}
          type="number"
          placeholder="e.g. 10000"
        />
      </FieldGroup>
    </>
  );
}

export function LocationField({ filters, onChange }: FieldProps) {
  return (
    <div className="mt-3.5 grid grid-cols-3 gap-3">
      <div>
        <FieldLabel className="mt-0">Creator country</FieldLabel>
        <FilterInput
          value={filters.country}
          onChange={(e) => onChange({ ...filters, country: e.target.value.toUpperCase() })}
          placeholder="e.g. AE"
        />
      </div>
      <div>
        <FieldLabel className="mt-0">Language</FieldLabel>
        <FilterInput
          value={filters.language}
          onChange={(e) => onChange({ ...filters, language: e.target.value })}
          placeholder="e.g. en"
        />
      </div>
      <div>
        <FieldLabel className="mt-0">Verification</FieldLabel>
        <FilterSelect disabled aria-label="Verification (coming soon)" className="cursor-not-allowed opacity-60">
          <option>Any</option>
          <option>Verified</option>
          <option>Unverified</option>
        </FilterSelect>
      </div>
    </div>
  );
}

export function CategoryField({ filters, onChange }: FieldProps) {
  const [draftCategory, setDraftCategory] = useState("");

  function addDraftCategory() {
    const value = draftCategory.trim();
    if (!value) return;
    if (filters.categories.includes(value)) {
      setDraftCategory("");
      return;
    }
    onChange({ ...filters, categories: [...filters.categories, value] });
    setDraftCategory("");
  }

  const customCategories = filters.categories.filter(
    (category) =>
      !QUICK_CATEGORIES.some((quick) => quick.toLowerCase() === category.toLowerCase())
  );

  return (
    <>
      <FieldGroup label="Category">
        <div className="mb-2 flex gap-1.5">
          <FilterInput
            value={draftCategory}
            onChange={(e) => setDraftCategory(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addDraftCategory();
              }
            }}
            placeholder="Add category…"
            className="flex-1"
          />
          <button
            type="button"
            onClick={addDraftCategory}
            disabled={!draftCategory.trim()}
            className="inline-flex size-[34px] shrink-0 items-center justify-center rounded-md border border-[#e2e8f0] bg-white text-[#94a3b8] transition-all duration-120 hover:border-[#2563eb] hover:bg-[#2563eb] hover:text-white disabled:opacity-40"
            aria-label="Add category"
          >
            <PlusIcon className="size-3.5" />
          </button>
        </div>
        {customCategories.length > 0 ? (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {customCategories.map((category) => (
              <span
                key={category}
                className="inline-flex h-6 items-center gap-[5px] rounded-[5px] border border-[#bfdbfe] bg-[#eff6ff] px-2 text-[11px] font-medium text-[#1d4ed8]"
              >
                {category}
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      ...filters,
                      categories: filters.categories.filter((value) => value !== category),
                    })
                  }
                  className="flex size-3.5 items-center justify-center rounded-full text-[10px] text-[#1d4ed8] transition-colors hover:bg-[rgba(37,99,235,.3)]"
                  style={{ backgroundColor: "rgba(37,99,235,.15)" }}
                  aria-label={`Remove ${category}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-1.5">
          {QUICK_CATEGORIES.map((category) => (
            <FilterChip
              key={category}
              label={category}
              active={filters.categories.some(
                (selected) => selected.toLowerCase() === category.toLowerCase()
              )}
              onToggle={() =>
                onChange({
                  ...filters,
                  categories: toggleCategoryInList(filters.categories, category),
                })
              }
            />
          ))}
        </div>
      </FieldGroup>
      <FieldGroup label="Audience interests">
        <FilterInput
          value={filters.audienceInterests}
          onChange={(e) => onChange({ ...filters, audienceInterests: e.target.value })}
          placeholder="beauty, fashion"
          className="mb-2"
        />
        <div className="flex flex-wrap gap-1.5">
          {QUICK_INTERESTS.map((interest) => (
            <FilterChip
              key={interest}
              label={interest}
              active={filters.audienceInterests.toLowerCase() === interest.toLowerCase()}
              onToggle={() =>
                onChange({
                  ...filters,
                  audienceInterests:
                    filters.audienceInterests.toLowerCase() === interest.toLowerCase()
                      ? ""
                      : interest,
                })
              }
            />
          ))}
        </div>
      </FieldGroup>
    </>
  );
}

const MOCKUP_CHIP_LABELS = {
  exclusivity: ["None", "Full", "Partial"],
  contractStatus: ["Active", "Expired", "None"],
} as const;

function MockupChip({ label }: { label: string }) {
  return (
    <span className="inline-flex h-[26px] shrink-0 items-center gap-1 whitespace-nowrap rounded-[20px] border border-[#e2e8f0] bg-white px-2.5 text-[11px] font-medium text-[#475569]">
      <span>{label}</span>
      <span
        className="ml-px flex size-3.5 items-center justify-center rounded-full text-[10px] font-bold"
        style={{ backgroundColor: "rgba(37,99,235,.1)", color: FP_BLUE }}
      >
        +
      </span>
    </span>
  );
}

export function AudienceField({ filters, onChange }: FieldProps) {
  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <FieldLabel className="mt-0">Audience country</FieldLabel>
          <FilterInput
            value={filters.audienceCountry}
            onChange={(e) =>
              onChange({ ...filters, audienceCountry: e.target.value.toUpperCase() })
            }
            placeholder="e.g. AE"
          />
        </div>
        <div>
          <FieldLabel className="mt-0">Min audience %</FieldLabel>
          <FilterInput
            disabled
            placeholder="e.g. 30"
            aria-label="Min audience percentage (coming soon)"
            className="cursor-not-allowed opacity-60"
          />
        </div>
        <div>
          <FieldLabel className="mt-0">Age range</FieldLabel>
          <RangeRow
            min={filters.ageMin}
            max={filters.ageMax}
            onMinChange={(value) => onChange({ ...filters, ageMin: value })}
            onMaxChange={(value) => onChange({ ...filters, ageMax: value })}
            minPlaceholder="Min"
            maxPlaceholder="Max"
            type="number"
          />
        </div>
      </div>
      <FieldGroup label="Gender">
        <SegmentedControl
          value={filters.gender.toLowerCase() as "" | "male" | "female"}
          options={GENDER_OPTIONS}
          onChange={(value) => onChange({ ...filters, gender: value })}
          className="max-w-[320px]"
        />
      </FieldGroup>
    </>
  );
}

export function CommercialField({ filters, onChange }: FieldProps) {
  return (
    <>
      <FieldGroup label="Pricing range (USD)" className="mt-0">
        <RangeRow
          min={filters.minEstimatedCost}
          max={filters.maxEstimatedCost}
          onMinChange={(value) => onChange({ ...filters, minEstimatedCost: value })}
          onMaxChange={(value) => onChange({ ...filters, maxEstimatedCost: value })}
          type="number"
        />
      </FieldGroup>
      <FieldGroup label="Exclusivity">
        <div className="flex flex-wrap gap-1.5">
          {MOCKUP_CHIP_LABELS.exclusivity.map((label) => (
            <MockupChip key={label} label={label} />
          ))}
        </div>
      </FieldGroup>
      <FieldGroup label="Contract status">
        <div className="flex flex-wrap gap-1.5">
          {MOCKUP_CHIP_LABELS.contractStatus.map((label) => (
            <MockupChip key={label} label={label} />
          ))}
        </div>
      </FieldGroup>
      <FieldGroup label="Min. brand safety score">
        <FilterInput
          value={filters.minBrandSafety}
          onChange={(e) => onChange({ ...filters, minBrandSafety: e.target.value })}
          type="number"
          placeholder="60"
        />
      </FieldGroup>
    </>
  );
}

export function AiField({ filters, onChange }: FieldProps) {
  return (
    <>
      <FieldGroup label="Minimum Thinkway score" className="mt-0">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {THINKWAY_SCORE_PRESETS.map((value) => (
            <RatePill
              key={value}
              label={`${value}+`}
              active={filters.minThinkwayScore === value}
              onToggle={() =>
                onChange({
                  ...filters,
                  minThinkwayScore: filters.minThinkwayScore === value ? "" : value,
                })
              }
            />
          ))}
        </div>
      </FieldGroup>
      <FieldGroup label="Brand fit category">
        <FilterInput
          value={filters.aiNiche}
          onChange={(e) => onChange({ ...filters, aiNiche: e.target.value })}
          placeholder="e.g. Camera & Photography"
        />
      </FieldGroup>
      <FieldGroup label="Source confidence">
        <RangeRow
          min={filters.minBrandFit}
          max={filters.minAiScore}
          onMinChange={(value) => onChange({ ...filters, minBrandFit: value })}
          onMaxChange={(value) => onChange({ ...filters, minAiScore: value })}
          minPlaceholder="Min %"
          maxPlaceholder="Max %"
          type="number"
        />
      </FieldGroup>
    </>
  );
}

export function NameField({ filters, onChange }: FieldProps) {
  return (
    <FieldGroup label="Search by handle or name">
      <FilterInput
        value={filters.handle}
        onChange={(e) => onChange({ ...filters, handle: e.target.value })}
        placeholder="@username"
      />
    </FieldGroup>
  );
}

/** @deprecated Use FilterChip — kept for filter bar compatibility */
export function TogglePill({
  label,
  active,
  onToggle,
}: {
  label: string;
  active: boolean;
  onToggle: () => void;
}) {
  return <FilterChip label={label} active={active} onToggle={onToggle} />;
}
