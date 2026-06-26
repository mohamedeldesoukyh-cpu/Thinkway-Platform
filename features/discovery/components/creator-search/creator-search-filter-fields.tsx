"use client";

import { PlusIcon, XIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { DISCOVERY_PLATFORMS } from "@/lib/discovery/types";
import { cn } from "@/lib/utils";

import type { CreatorSearchFilters } from "./creator-search-types";

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

export function FieldLabel({ children }: { children: ReactNode }) {
  return <p className="text-[11px] font-medium text-muted-foreground">{children}</p>;
}

export function TogglePill({
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
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
        active
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border bg-card text-muted-foreground hover:border-primary/40"
      )}
    >
      <span className="capitalize">{label}</span>
      {active ? (
        <XIcon className="size-3" />
      ) : (
        <PlusIcon className="size-3 opacity-50" />
      )}
    </button>
  );
}

function ClearLink({ onClear }: { onClear: () => void }) {
  return (
    <button
      type="button"
      onClick={onClear}
      className="text-[11px] font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
    >
      Clear
    </button>
  );
}

const fieldInput = "h-8 border-border bg-card text-xs";

/* ---------------------------------- groups --------------------------------- */

export function PlatformField({ filters, onChange }: FieldProps) {
  function toggle(platform: string) {
    const set = new Set(filters.platforms);
    if (set.has(platform)) set.delete(platform);
    else set.add(platform);
    onChange({ ...filters, platforms: [...set] });
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <FieldLabel>Social platform</FieldLabel>
        {filters.platforms.length > 0 ? (
          <ClearLink onClear={() => onChange({ ...filters, platforms: [] })} />
        ) : null}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {DISCOVERY_PLATFORMS.map((platform) => (
          <TogglePill
            key={platform}
            label={PLATFORM_LABELS[platform] ?? platform}
            active={filters.platforms.includes(platform)}
            onToggle={() => toggle(platform)}
          />
        ))}
      </div>
    </div>
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
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <FieldLabel>Follower range</FieldLabel>
        {filters.minFollowers || filters.maxFollowers ? (
          <ClearLink onClear={() => onChange({ ...filters, minFollowers: "", maxFollowers: "" })} />
        ) : null}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {FOLLOWER_PRESETS.map((preset) => (
          <TogglePill
            key={preset.id}
            label={preset.label}
            active={activePreset?.id === preset.id}
            onToggle={() => applyPreset(preset)}
          />
        ))}
      </div>
      <div className="flex items-center gap-1">
        <Input
          value={filters.minFollowers}
          onChange={(e) => onChange({ ...filters, minFollowers: e.target.value })}
          placeholder="Min"
          type="number"
          className={fieldInput}
        />
        <span className="text-[10px] text-muted-foreground">–</span>
        <Input
          value={filters.maxFollowers}
          onChange={(e) => onChange({ ...filters, maxFollowers: e.target.value })}
          placeholder="Max"
          type="number"
          className={fieldInput}
        />
      </div>
    </div>
  );
}

export function EngagementField({ filters, onChange }: FieldProps) {
  return (
    <div className="space-y-2">
      <div className="space-y-1.5">
        <FieldLabel>Minimum engagement rate</FieldLabel>
        <div className="flex flex-wrap gap-1.5">
          {ENGAGEMENT_PRESETS.map((value) => (
            <TogglePill
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
        <Input
          value={filters.minEngagement}
          onChange={(e) => onChange({ ...filters, minEngagement: e.target.value })}
          type="number"
          placeholder="Custom %"
          className={fieldInput}
        />
      </div>
      <div className="space-y-1.5">
        <FieldLabel>Minimum average views</FieldLabel>
        <Input
          value={filters.minViews}
          onChange={(e) => onChange({ ...filters, minViews: e.target.value })}
          type="number"
          placeholder="e.g. 10000"
          className={fieldInput}
        />
      </div>
    </div>
  );
}

export function LocationField({ filters, onChange }: FieldProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="space-y-1.5">
        <FieldLabel>Creator country</FieldLabel>
        <Input
          value={filters.country}
          onChange={(e) => onChange({ ...filters, country: e.target.value.toUpperCase() })}
          placeholder="AE"
          className={fieldInput}
        />
      </div>
      <div className="space-y-1.5">
        <FieldLabel>Language</FieldLabel>
        <Input
          value={filters.language}
          onChange={(e) => onChange({ ...filters, language: e.target.value })}
          placeholder="en"
          className={fieldInput}
        />
      </div>
    </div>
  );
}

export function CategoryField({ filters, onChange }: FieldProps) {
  return (
    <div className="space-y-2">
      <div className="space-y-1.5">
        <FieldLabel>Category</FieldLabel>
        <Input
          value={filters.category}
          onChange={(e) => onChange({ ...filters, category: e.target.value })}
          placeholder="Search category…"
          className={fieldInput}
        />
        <div className="flex flex-wrap gap-1.5">
          {QUICK_CATEGORIES.map((category) => (
            <TogglePill
              key={category}
              label={category}
              active={filters.category.toLowerCase() === category.toLowerCase()}
              onToggle={() =>
                onChange({
                  ...filters,
                  category:
                    filters.category.toLowerCase() === category.toLowerCase() ? "" : category,
                })
              }
            />
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <FieldLabel>Audience interests</FieldLabel>
        <Input
          value={filters.audienceInterests}
          onChange={(e) => onChange({ ...filters, audienceInterests: e.target.value })}
          placeholder="beauty, fashion"
          className={fieldInput}
        />
        <div className="flex flex-wrap gap-1.5">
          {QUICK_INTERESTS.map((interest) => (
            <TogglePill
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
      </div>
    </div>
  );
}

export function AudienceField({ filters, onChange }: FieldProps) {
  return (
    <div className="space-y-2">
      <div className="space-y-1.5">
        <FieldLabel>Audience country</FieldLabel>
        <Input
          value={filters.audienceCountry}
          onChange={(e) => onChange({ ...filters, audienceCountry: e.target.value.toUpperCase() })}
          placeholder="AE"
          className={fieldInput}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <FieldLabel>Gender</FieldLabel>
          <Input
            value={filters.gender}
            onChange={(e) => onChange({ ...filters, gender: e.target.value })}
            placeholder="Any"
            className={fieldInput}
          />
        </div>
        <div className="space-y-1.5">
          <FieldLabel>Age range</FieldLabel>
          <div className="flex items-center gap-1">
            <Input
              value={filters.ageMin}
              onChange={(e) => onChange({ ...filters, ageMin: e.target.value })}
              placeholder="18"
              className={fieldInput}
            />
            <span className="text-[10px] text-muted-foreground">–</span>
            <Input
              value={filters.ageMax}
              onChange={(e) => onChange({ ...filters, ageMax: e.target.value })}
              placeholder="35"
              className={fieldInput}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export function CommercialField({ filters, onChange }: FieldProps) {
  return (
    <div className="space-y-2">
      <div className="space-y-1.5">
        <FieldLabel>Estimated cost range</FieldLabel>
        <div className="flex items-center gap-1">
          <Input
            value={filters.minEstimatedCost}
            onChange={(e) => onChange({ ...filters, minEstimatedCost: e.target.value })}
            placeholder="Min"
            type="number"
            className={fieldInput}
          />
          <span className="text-[10px] text-muted-foreground">–</span>
          <Input
            value={filters.maxEstimatedCost}
            onChange={(e) => onChange({ ...filters, maxEstimatedCost: e.target.value })}
            placeholder="Max"
            type="number"
            className={fieldInput}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <FieldLabel>Min. brand safety score</FieldLabel>
        <Input
          value={filters.minBrandSafety}
          onChange={(e) => onChange({ ...filters, minBrandSafety: e.target.value })}
          type="number"
          placeholder="60"
          className={fieldInput}
        />
      </div>
    </div>
  );
}

export function AiField({ filters, onChange }: FieldProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="space-y-1.5">
        <FieldLabel>Min Thinkway AI</FieldLabel>
        <Input
          value={filters.minThinkwayScore}
          onChange={(e) => onChange({ ...filters, minThinkwayScore: e.target.value })}
          type="number"
          placeholder="50"
          className={fieldInput}
        />
      </div>
      <div className="space-y-1.5">
        <FieldLabel>Min brand fit</FieldLabel>
        <Input
          value={filters.minBrandFit}
          onChange={(e) => onChange({ ...filters, minBrandFit: e.target.value })}
          type="number"
          className={fieldInput}
        />
      </div>
      <div className="space-y-1.5">
        <FieldLabel>AI niche match</FieldLabel>
        <Input
          value={filters.aiNiche}
          onChange={(e) => onChange({ ...filters, aiNiche: e.target.value })}
          placeholder="beauty, luxury"
          className={fieldInput}
        />
      </div>
      <div className="space-y-1.5">
        <FieldLabel>Min content quality</FieldLabel>
        <Input
          value={filters.minAiScore}
          onChange={(e) => onChange({ ...filters, minAiScore: e.target.value })}
          type="number"
          className={fieldInput}
        />
      </div>
    </div>
  );
}

export function NameField({ filters, onChange }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <FieldLabel>Search by handle or name</FieldLabel>
      <Input
        value={filters.handle}
        onChange={(e) => onChange({ ...filters, handle: e.target.value })}
        placeholder="@username"
        className={fieldInput}
      />
    </div>
  );
}

