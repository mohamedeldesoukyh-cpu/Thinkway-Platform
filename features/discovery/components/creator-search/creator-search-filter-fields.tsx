"use client";

import { PlusIcon, XIcon } from "lucide-react";
import { Fragment, useState, type ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { toggleCategoryInList } from "@/lib/creators/category-filter";
import {
  TIER_FILTER_RANGES,
  tierFilterPresetFields,
} from "@/lib/creators/influencer-tier";
import { DISCOVERY_PLATFORMS } from "@/lib/discovery/types";
import { PLATFORM_LABELS } from "@/lib/social/platforms";
import { PlatformIcon } from "@/lib/performance/platform-icon";
import { cn } from "@/lib/utils";

import {
  AGE_RANGE_MAX_OPTIONS,
  AGE_RANGE_OPTIONS,
  CONTENT_TAG_SUGGESTIONS,
  DISCOVERY_FILTER_COUNTRIES,
  DISCOVERY_FILTER_LANGUAGES,
  LAST_POST_WITHIN_OPTIONS,
} from "./creator-search-filter-constants";
import type { CreatorSearchFilters } from "./creator-search-types";

type FieldProps = {
  filters: CreatorSearchFilters;
  onChange: (next: CreatorSearchFilters) => void;
};

const FOLLOWER_PRESETS = TIER_FILTER_RANGES.map((range) => ({
  id: range.id,
  label: range.label,
  ...tierFilterPresetFields(range),
}));

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
        "discovery-filter-field-label mb-[7px] text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748b] dark:text-muted-foreground",
        className
      )}
    >
      {children}
    </p>
  );
}

export function FieldHint({ children }: { children: ReactNode }) {
  return (
    <p className="discovery-filter-field-hint mt-[5px] text-[10px] text-[#94a3b8] dark:text-muted-foreground">{children}</p>
  );
}

const filterInputClass =
  "discovery-filter-input h-9 rounded-[10px] border-[rgba(0,87,255,0.14)] dark:border-[rgba(0,87,255,0.24)] bg-white dark:bg-card px-3 text-xs text-[#0f172a] dark:text-foreground shadow-none placeholder:text-[#94a3b8] dark:placeholder:text-muted-foreground focus-visible:border-[#0057FF] focus-visible:ring-[3px] focus-visible:ring-[rgba(0,87,255,0.12)]";

const filterAddButtonClass =
  "discovery-filter-add-btn inline-flex size-[34px] shrink-0 items-center justify-center rounded-[10px] border border-[rgba(0,87,255,0.14)] dark:border-[rgba(0,87,255,0.24)] bg-white dark:bg-card text-[#94a3b8] dark:text-muted-foreground transition-all duration-120 hover:border-[#0057FF] hover:bg-[#0057FF] hover:text-white disabled:opacity-40";

const filterChipInactiveClass =
  "border-[rgba(0,87,255,0.14)] dark:border-[rgba(0,87,255,0.24)] bg-white dark:bg-card text-[#475569] dark:text-muted-foreground hover:border-[rgba(0,87,255,0.24)] hover:bg-[rgba(239,246,255,0.95)] dark:hover:bg-primary/10 hover:text-[#0057FF] dark:hover:text-blue-300";

const FILTER_CHIP_PREVIEW_COUNT = 6;

function ExpandableChipGrid<T>({
  items,
  previewCount = FILTER_CHIP_PREVIEW_COUNT,
  getKey,
  isHighlighted,
  renderChip,
}: {
  items: readonly T[];
  previewCount?: number;
  getKey: (item: T) => string;
  isHighlighted?: (item: T) => boolean;
  renderChip: (item: T) => ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const isActive = isHighlighted ?? (() => false);

  const visibleItems = expanded
    ? items
    : items.filter((item, index) => index < previewCount || isActive(item));

  const hiddenCount = items.filter(
    (item, index) => index >= previewCount && !isActive(item)
  ).length;

  if (items.length <= previewCount) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <Fragment key={getKey(item)}>{renderChip(item)}</Fragment>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {visibleItems.map((item) => (
          <Fragment key={getKey(item)}>{renderChip(item)}</Fragment>
        ))}
      </div>
      {hiddenCount > 0 || expanded ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-2 text-[11px] font-medium text-[#0057FF] transition-colors hover:text-[#0046cc]"
          aria-expanded={expanded}
        >
          {expanded ? "Show less" : `Show ${hiddenCount} more`}
        </button>
      ) : null}
    </>
  );
}

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
        "discovery-filter-chip inline-flex h-[26px] shrink-0 items-center gap-1 whitespace-nowrap rounded-[20px] border px-2.5 text-[11px] font-medium transition-all duration-[140ms]",
        active
          ? "border-[rgba(0,87,255,0.32)] bg-[rgba(0,87,255,0.1)] font-semibold text-[#0057FF] dark:text-blue-300"
          : "border-[rgba(0,87,255,0.14)] dark:border-border bg-white dark:bg-card text-[#475569] dark:text-muted-foreground hover:border-[rgba(0,87,255,0.24)] hover:bg-[rgba(239,246,255,0.95)] dark:hover:bg-primary/10 hover:text-[#0057FF] dark:hover:text-blue-300"
      )}
    >
      <span>{label}</span>
      {active ? (
        <span className="ml-px text-[12px] leading-none text-[#0057FF]">×</span>
      ) : (
        <span className="ml-px flex size-3.5 items-center justify-center rounded-full bg-[rgba(0,87,255,0.1)] text-[10px] font-bold text-[#0057FF]">
          +
        </span>
      )}
    </button>
  );
}

export function PlatformFilterChip({
  platform,
  active,
  onToggle,
}: {
  platform: string;
  active: boolean;
  onToggle: () => void;
}) {
  const label = PLATFORM_LABELS[platform as keyof typeof PLATFORM_LABELS] ?? platform;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className={cn(
        "discovery-filter-platform-chip inline-flex h-9 shrink-0 items-center gap-2 rounded-[10px] border px-2.5 text-[11px] font-semibold transition-all duration-[140ms]",
        active
          ? "border-[rgba(0,87,255,0.38)] bg-[rgba(0,87,255,0.1)] text-[#0057FF] shadow-[0_1px_3px_rgba(0,87,255,0.12)]"
          : filterChipInactiveClass
      )}
    >
      <PlatformIcon platform={platform} size="xs" variant="logo" className="size-5 shrink-0" />
      <span>{label}</span>
      {active ? (
        <XIcon className="size-3 shrink-0 opacity-70" aria-hidden />
      ) : (
        <PlusIcon className="size-3 shrink-0 text-[#0057FF] opacity-50" aria-hidden />
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
        "discovery-filter-rate-pill inline-flex h-7 shrink-0 items-center rounded-[10px] border px-3 text-[11px] font-semibold transition-all duration-[140ms]",
        active
          ? "border-[#0057FF] bg-[#0057FF] text-white"
          : filterChipInactiveClass
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
        "flex overflow-hidden rounded-[10px] border border-[rgba(0,87,255,0.14)] dark:border-[rgba(0,87,255,0.24)]",
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
              "flex-1 border-r border-[rgba(0,87,255,0.12)] dark:border-[rgba(0,87,255,0.2)] px-2 py-[7px] text-center text-[11px] font-medium transition-colors last:border-r-0",
              selected
                ? "bg-[rgba(0,87,255,0.1)] font-semibold text-[#0057FF] dark:text-blue-300"
                : "text-[#94a3b8] dark:text-muted-foreground hover:bg-[rgba(239,246,255,0.95)] dark:hover:bg-primary/10 hover:text-[#475569] dark:hover:text-foreground"
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
      className="text-[10px] font-medium text-[#0057FF] underline-offset-2 hover:text-[#0046cc] hover:underline"
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
    <div
      className={cn(
        "discovery-filter-field-group border-t border-[rgba(0,87,255,0.1)] pt-5 first:border-t-0 first:pt-0",
        className
      )}
    >
      <div className="mb-[7px] flex items-center justify-between gap-2">
        <FieldLabel className="mb-0">{label}</FieldLabel>
        {showClear && onClear ? <ClearLink onClear={onClear} /> : null}
      </div>
      {children}
    </div>
  );
}

function toggleInList(list: string[], value: string, normalize?: (value: string) => string) {
  const key = normalize ? normalize(value) : value;
  const has = list.some((entry) => (normalize ? normalize(entry) : entry) === key);
  if (has) {
    return list.filter((entry) => (normalize ? normalize(entry) : entry) !== key);
  }
  return [...list, key];
}

function CountryPillGrid({
  selected,
  onChange,
  draft,
  onDraftChange,
  placeholder,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
  draft: string;
  onDraftChange: (value: string) => void;
  placeholder: string;
}) {
  function addDraftCountry() {
    const code = draft.trim().toUpperCase();
    if (!code) return;
    if (selected.includes(code)) {
      onDraftChange("");
      return;
    }
    onChange([...selected, code]);
    onDraftChange("");
  }

  return (
    <>
      <div className="mb-2 flex gap-1.5">
        <FilterInput
          value={draft}
          onChange={(e) => onDraftChange(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addDraftCountry();
            }
          }}
          placeholder={placeholder}
          className="flex-1"
        />
        <button
          type="button"
          onClick={addDraftCountry}
          disabled={!draft.trim()}
          className={filterAddButtonClass}
          aria-label="Add country"
        >
          <PlusIcon className="size-3.5" />
        </button>
      </div>
      {selected.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {selected.map((code) => (
            <FilterChip
              key={code}
              label={DISCOVERY_FILTER_COUNTRIES.find((entry) => entry.code === code)?.label ?? code}
              active
              onToggle={() => onChange(selected.filter((value) => value !== code))}
            />
          ))}
        </div>
      ) : null}
      <ExpandableChipGrid
        items={DISCOVERY_FILTER_COUNTRIES}
        previewCount={6}
        getKey={({ code }) => code}
        isHighlighted={({ code }) => selected.includes(code)}
        renderChip={({ code, label }) => (
          <FilterChip
            label={label}
            active={selected.includes(code)}
            onToggle={() => onChange(toggleInList(selected, code))}
          />
        )}
      />
    </>
  );
}

function LanguagePillGrid({
  selected,
  onChange,
  draft,
  onDraftChange,
  placeholder,
  label,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
  draft: string;
  onDraftChange: (value: string) => void;
  placeholder: string;
  label?: string;
}) {
  function addDraftLanguage() {
    const code = draft.trim().toLowerCase();
    if (!code) return;
    if (selected.some((entry) => entry.toLowerCase() === code)) {
      onDraftChange("");
      return;
    }
    onChange([...selected, code]);
    onDraftChange("");
  }

  return (
    <>
      <div className="mb-2 flex gap-1.5">
        <FilterInput
          value={draft}
          onChange={(e) => onDraftChange(e.target.value.toLowerCase())}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addDraftLanguage();
            }
          }}
          placeholder={placeholder}
          className="flex-1"
          aria-label={label ?? "Language code"}
        />
        <button
          type="button"
          onClick={addDraftLanguage}
          disabled={!draft.trim()}
          className={filterAddButtonClass}
          aria-label="Add language"
        >
          <PlusIcon className="size-3.5" />
        </button>
      </div>
      {selected.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {selected.map((code) => (
            <FilterChip
              key={code}
              label={
                DISCOVERY_FILTER_LANGUAGES.find((entry) => entry.code === code)?.label ?? code
              }
              active
              onToggle={() => onChange(selected.filter((value) => value !== code))}
            />
          ))}
        </div>
      ) : null}
      <ExpandableChipGrid
        items={DISCOVERY_FILTER_LANGUAGES}
        previewCount={6}
        getKey={({ code }) => code}
        isHighlighted={({ code }) => selected.includes(code)}
        renderChip={({ code, label: langLabel }) => (
          <FilterChip
            label={langLabel}
            active={selected.includes(code)}
            onToggle={() => onChange(toggleInList(selected, code, (value) => value.toLowerCase()))}
          />
        )}
      />
    </>
  );
}

export function ContentSearchField({ filters, onChange }: FieldProps) {
  const [draftTag, setDraftTag] = useState("");
  const [draftContentLanguage, setDraftContentLanguage] = useState("");

  function addDraftTag() {
    const value = draftTag.trim().replace(/^#+/, "");
    if (!value) return;
    if (filters.contentTags.some((tag) => tag.toLowerCase() === value.toLowerCase())) {
      setDraftTag("");
      return;
    }
    onChange({ ...filters, contentTags: [...filters.contentTags, value] });
    setDraftTag("");
  }

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <FieldLabel className="mb-0">Advanced search</FieldLabel>
        <button
          type="button"
          role="switch"
          aria-checked={filters.advancedSearch}
          onClick={() => onChange({ ...filters, advancedSearch: !filters.advancedSearch })}
          className={cn(
            "relative inline-flex h-5 w-9 shrink-0 rounded-full border transition-colors",
            filters.advancedSearch
              ? "border-[#0057FF] bg-[#0057FF]"
              : "border-[rgba(0,87,255,0.14)] dark:border-[rgba(0,87,255,0.24)] bg-[#f1f5f9] dark:bg-muted"
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform",
              filters.advancedSearch ? "translate-x-4" : "translate-x-0.5"
            )}
          />
        </button>
      </div>

      <FieldGroup label="Keyword / hashtag" className="mt-3">
        <FilterInput
          value={filters.contentKeyword}
          onChange={(e) => onChange({ ...filters, contentKeyword: e.target.value })}
          placeholder="e.g. travel, #beauty"
        />
        <div className="mt-2">
          <ExpandableChipGrid
            items={CONTENT_TAG_SUGGESTIONS}
            previewCount={3}
            getKey={(tag) => tag}
            isHighlighted={(tag) =>
              filters.contentTags.some((selected) => selected.toLowerCase() === tag.toLowerCase())
            }
            renderChip={(tag) => (
              <FilterChip
                label={tag.startsWith("#") ? tag : `#${tag}`}
                active={filters.contentTags.some(
                  (selected) => selected.toLowerCase() === tag.toLowerCase()
                )}
                onToggle={() =>
                  onChange({
                    ...filters,
                    contentTags: toggleInList(filters.contentTags, tag, (value) =>
                      value.toLowerCase()
                    ),
                  })
                }
              />
            )}
          />
        </div>
      </FieldGroup>

      {filters.advancedSearch ? (
        <FieldGroup label="Add hashtag">
          <div className="flex gap-1.5">
            <FilterInput
              value={draftTag}
              onChange={(e) => setDraftTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addDraftTag();
                }
              }}
              placeholder="Custom tag…"
              className="flex-1"
            />
            <button
              type="button"
              onClick={addDraftTag}
              disabled={!draftTag.trim()}
              className={filterAddButtonClass}
              aria-label="Add hashtag"
            >
              <PlusIcon className="size-3.5" />
            </button>
          </div>
        </FieldGroup>
      ) : null}

      <FieldGroup
        label="Content language"
        showClear={filters.contentLanguages.length > 0}
        onClear={() => onChange({ ...filters, contentLanguages: [] })}
      >
        <LanguagePillGrid
          selected={filters.contentLanguages}
          onChange={(contentLanguages) => onChange({ ...filters, contentLanguages })}
          draft={draftContentLanguage}
          onDraftChange={setDraftContentLanguage}
          placeholder="ISO code e.g. en"
          label="Content language code"
        />
      </FieldGroup>

    </>
  );
}

export function LastPostField({ filters, onChange }: FieldProps) {
  return (
    <FieldGroup label="Last post within" className="mt-0">
      <FilterSelect
        value={filters.lastPostWithin}
        onChange={(e) => onChange({ ...filters, lastPostWithin: e.target.value })}
        aria-label="Last post within"
      >
        {LAST_POST_WITHIN_OPTIONS.map((option) => (
          <option key={option.value || "any"} value={option.value}>
            {option.label}
          </option>
        ))}
      </FilterSelect>
      <FieldHint>Filters creators with synced recent publication dates when available.</FieldHint>
    </FieldGroup>
  );
}

export function BrandSafetyField({ filters, onChange }: FieldProps) {
  return (
    <FieldGroup label="Min. brand safety score" className="mt-0">
      <FilterInput
        value={filters.minBrandSafety}
        onChange={(e) => onChange({ ...filters, minBrandSafety: e.target.value })}
        type="number"
        placeholder="60"
      />
    </FieldGroup>
  );
}

export function CommercialPricingField({ filters, onChange }: FieldProps) {
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
    </>
  );
}

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
      <ExpandableChipGrid
        items={DISCOVERY_PLATFORMS}
        previewCount={4}
        getKey={(platform) => platform}
        isHighlighted={(platform) => filters.platforms.includes(platform)}
        renderChip={(platform) => (
          <PlatformFilterChip
            platform={platform}
            active={filters.platforms.includes(platform)}
            onToggle={() => toggle(platform)}
          />
        )}
      />
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
  const [draftCountry, setDraftCountry] = useState("");
  const [draftLanguage, setDraftLanguage] = useState("");

  return (
    <>
      <FieldGroup label="Creator country">
        <CountryPillGrid
          selected={filters.countries}
          onChange={(countries) => onChange({ ...filters, countries })}
          draft={draftCountry}
          onDraftChange={setDraftCountry}
          placeholder="ISO code e.g. EG"
        />
      </FieldGroup>
      <FieldGroup
        label="Language"
        showClear={filters.languages.length > 0}
        onClear={() => onChange({ ...filters, languages: [] })}
      >
        <LanguagePillGrid
          selected={filters.languages}
          onChange={(languages) => onChange({ ...filters, languages })}
          draft={draftLanguage}
          onDraftChange={setDraftLanguage}
          placeholder="ISO code e.g. en"
          label="Creator language code"
        />
      </FieldGroup>
      <FieldGroup label="Verification">
        <FilterSelect disabled aria-label="Verification (coming soon)" className="cursor-not-allowed opacity-60">
          <option>Any</option>
          <option>Verified</option>
          <option>Unverified</option>
        </FilterSelect>
      </FieldGroup>
    </>
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
            className={filterAddButtonClass}
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
                className="inline-flex h-6 items-center gap-[5px] rounded-[8px] border border-[rgba(0,87,255,0.24)] bg-[rgba(0,87,255,0.08)] px-2 text-[11px] font-medium text-[#0057FF]"
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
                  className="flex size-3.5 items-center justify-center rounded-full bg-[rgba(0,87,255,0.12)] text-[10px] text-[#0057FF] transition-colors hover:bg-[rgba(0,87,255,0.22)]"
                  aria-label={`Remove ${category}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : null}
        <ExpandableChipGrid
          items={QUICK_CATEGORIES}
          previewCount={4}
          getKey={(category) => category}
          isHighlighted={(category) =>
            filters.categories.some(
              (selected) => selected.toLowerCase() === category.toLowerCase()
            )
          }
          renderChip={(category) => (
            <FilterChip
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
          )}
        />
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
    <span className="inline-flex h-[26px] shrink-0 items-center gap-1 whitespace-nowrap rounded-[20px] border border-[rgba(0,87,255,0.14)] dark:border-[rgba(0,87,255,0.24)] bg-white dark:bg-card px-2.5 text-[11px] font-medium text-[#475569] dark:text-muted-foreground">
      <span>{label}</span>
      <span className="ml-px flex size-3.5 items-center justify-center rounded-full bg-[rgba(0,87,255,0.1)] text-[10px] font-bold text-[#0057FF]">
        +
      </span>
    </span>
  );
}

export function AudienceField({ filters, onChange }: FieldProps) {
  const [draftAudienceCountry, setDraftAudienceCountry] = useState("");
  const [draftInterest, setDraftInterest] = useState("");

  function addDraftInterest() {
    const value = draftInterest.trim();
    if (!value) return;
    if (
      filters.audienceInterestTags.some(
        (tag) => tag.toLowerCase() === value.toLowerCase()
      )
    ) {
      setDraftInterest("");
      return;
    }
    onChange({ ...filters, audienceInterestTags: [...filters.audienceInterestTags, value] });
    setDraftInterest("");
  }

  return (
    <>
      <FieldGroup label="Audience country" className="mt-0">
        <CountryPillGrid
          selected={filters.audienceCountries}
          onChange={(audienceCountries) => onChange({ ...filters, audienceCountries })}
          draft={draftAudienceCountry}
          onDraftChange={setDraftAudienceCountry}
          placeholder="ISO code e.g. AE"
        />
      </FieldGroup>

      <FieldGroup label="Gender">
        <FilterSelect
          value={filters.gender.toLowerCase()}
          onChange={(e) => onChange({ ...filters, gender: e.target.value })}
          aria-label="Audience gender"
        >
          {GENDER_OPTIONS.map((option) => (
            <option key={option.value || "any"} value={option.value}>
              {option.label}
            </option>
          ))}
        </FilterSelect>
        <FieldHint>Applied when audience demographic data is available on the creator.</FieldHint>
      </FieldGroup>

      <FieldGroup label="Age range">
        <div className="flex items-center gap-2">
          <FilterSelect
            value={filters.ageMin}
            onChange={(e) => onChange({ ...filters, ageMin: e.target.value })}
            aria-label="Minimum audience age"
            className="flex-1"
          >
            {AGE_RANGE_OPTIONS.map((option) => (
              <option key={`min-${option.value || "any"}`} value={option.value}>
                {option.label}
              </option>
            ))}
          </FilterSelect>
          <span className="shrink-0 text-xs text-[#94a3b8]">to</span>
          <FilterSelect
            value={filters.ageMax}
            onChange={(e) => onChange({ ...filters, ageMax: e.target.value })}
            aria-label="Maximum audience age"
            className="flex-1"
          >
            {AGE_RANGE_MAX_OPTIONS.map((option) => (
              <option key={`max-${option.value || "any"}`} value={option.value}>
                {option.label}
              </option>
            ))}
          </FilterSelect>
        </div>
        <FieldHint>Requires enriched audience age distribution (future backend filter).</FieldHint>
      </FieldGroup>

      <FieldGroup label="Audience interests">
        <div className="mb-2 flex gap-1.5">
          <FilterInput
            value={draftInterest}
            onChange={(e) => setDraftInterest(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addDraftInterest();
              }
            }}
            placeholder="Add topic…"
            className="flex-1"
          />
          <button
            type="button"
            onClick={addDraftInterest}
            disabled={!draftInterest.trim()}
            className={filterAddButtonClass}
            aria-label="Add audience interest"
          >
            <PlusIcon className="size-3.5" />
          </button>
        </div>
        {filters.audienceInterestTags.length > 0 ? (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {filters.audienceInterestTags.map((interest) => (
              <FilterChip
                key={interest}
                label={interest}
                active
                onToggle={() =>
                  onChange({
                    ...filters,
                    audienceInterestTags: filters.audienceInterestTags.filter(
                      (value) => value !== interest
                    ),
                  })
                }
              />
            ))}
          </div>
        ) : null}
        <ExpandableChipGrid
          items={QUICK_INTERESTS}
          previewCount={4}
          getKey={(interest) => interest}
          isHighlighted={(interest) =>
            filters.audienceInterestTags.some(
              (selected) => selected.toLowerCase() === interest.toLowerCase()
            )
          }
          renderChip={(interest) => (
            <FilterChip
              label={interest}
              active={filters.audienceInterestTags.some(
                (selected) => selected.toLowerCase() === interest.toLowerCase()
              )}
              onToggle={() =>
                onChange({
                  ...filters,
                  audienceInterestTags: toggleInList(
                    filters.audienceInterestTags,
                    interest,
                    (value) => value.toLowerCase()
                  ),
                })
              }
            />
          )}
        />
      </FieldGroup>
    </>
  );
}

export function CommercialField({ filters, onChange }: FieldProps) {
  return (
    <>
      <CommercialPricingField filters={filters} onChange={onChange} />
      <BrandSafetyField filters={filters} onChange={onChange} />
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
