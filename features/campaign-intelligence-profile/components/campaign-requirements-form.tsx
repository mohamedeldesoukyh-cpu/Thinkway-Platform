"use client";

import { useMemo, useState } from "react";
import {
  CheckIcon,
  CircleAlertIcon,
  Globe2Icon,
  PlusIcon,
  SparklesIcon,
  StarIcon,
  UserIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FieldLabel,
  FilterChip,
  FilterSelect,
} from "@/features/discovery/components/creator-search/creator-search-filter-fields";
import { DISCOVERY_FILTER_COUNTRIES } from "@/features/discovery/components/creator-search/creator-search-filter-constants";
import { DISCOVERY_PLATFORMS } from "@/lib/discovery/types";
import { cn } from "@/lib/utils";

import type { DiscoveryCampaignRequirements } from "../services/discovery-campaign-requirements";
import { discoveryRequirementsToProfile } from "../services/discovery-campaign-requirements";
import { getValidatedIntelligence } from "../services/get-validated-intelligence";
import {
  formatDiscoveryMappedFilterValue,
  mapCampaignIntelligenceToDiscoverySearch,
} from "../services/discovery-search-mapping";
import { MIN_STRICT_CONFIDENCE } from "../services/normalization/validate-normalized-evidence";
import type { EvidenceLevel, FieldProvenance } from "../services/normalization/types";
import { countryLabel } from "../services/normalization/validators";
import type { CampaignIntelligenceProfile } from "../types/profile";

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  twitter: "X",
};

const GENDER_OPTIONS = [
  { value: "", label: "Any" },
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
] as const;

type Props = {
  value: DiscoveryCampaignRequirements;
  onChange: (next: DiscoveryCampaignRequirements) => void;
  baseProfile: CampaignIntelligenceProfile;
  disabled?: boolean;
};

type AddDialogKind =
  | "brand"
  | "market"
  | "platform"
  | "gender"
  | "age"
  | "category"
  | "niche"
  | "keyword"
  | "follower"
  | null;

const EVIDENCE_LABELS: Record<EvidenceLevel, string> = {
  extracted: "Extracted",
  normalized: "Normalized",
  inferred: "Inferred",
};

/** Docx fallback parser often concatenates fields without spaces — detect and split. */
function looksLikeConcatenatedBrief(text: string): boolean {
  return (
    /[a-z][A-Z]/.test(text) ||
    /ParisMarket|EgyptCampaign|WeeksObjective/i.test(text) ||
    (text.length > 80 && /Market\s*:/i.test(text) && /Objective\s*:/i.test(text))
  );
}

function extractInlineField(text: string | null | undefined, label: string): string | null {
  if (!text?.trim()) return null;
  const re = new RegExp(
    `${label}\\s*:\\s*(.+?)(?=\\s*(?:Market|Campaign\\s+Duration|Objective)\\s*:|$)`,
    "i"
  );
  const match = text.match(re);
  return match?.[1]?.trim().replace(/\.$/, "") ?? null;
}

function cleanBrandName(raw: string | null | undefined): string {
  if (!raw?.trim()) return "";
  const trimmed = raw.trim();
  if (!looksLikeConcatenatedBrief(trimmed)) return trimmed;
  const head = trimmed.match(/^(.+?)(?:\s*Market\s*:|\s*Campaign\s+Duration|\s*Objective\s*:)/i);
  return (head?.[1] ?? trimmed).trim().replace(/[.,\s]+$/, "");
}

function formatBrandExtractedDisplay(
  profile: CampaignIntelligenceProfile,
  requirements: DiscoveryCampaignRequirements
): string | null {
  const validated = getValidatedIntelligence(profile);
  const brand =
    cleanBrandName(requirements.brandName) ||
    cleanBrandName(validated?.brand.brandName) ||
    cleanBrandName(profile.brandName);

  if (!brand) return null;

  const parts: string[] = [brand];

  const market =
    (requirements.marketCountry ? countryLabel(requirements.marketCountry) : null) ||
    validated?.market.countryLabel ||
    profile.market ||
    extractInlineField(requirements.brandName, "Market");

  if (market) parts.push(`Market: ${market}`);

  if (profile.durationWeeks) {
    parts.push(`Campaign duration: ${profile.durationWeeks} weeks`);
  } else {
    const duration =
      extractInlineField(requirements.brandName, "Campaign duration") ??
      extractInlineField(requirements.brandName, "Campaign Duration");
    if (duration) parts.push(`Campaign duration: ${duration}`);
  }

  const objectives = profile.objectives?.map((o) => o.trim()).filter(Boolean);
  if (objectives?.length) {
    parts.push(`Objective: ${objectives.join("; ")}`);
  } else {
    const objective = extractInlineField(requirements.brandName, "Objective");
    if (objective) parts.push(`Objective: ${objective}`);
  }

  return `${parts.join(". ")}.`;
}

function resolveMarketLabel(
  profile: CampaignIntelligenceProfile,
  requirements: DiscoveryCampaignRequirements
): string | null {
  if (requirements.marketCountry) return countryLabel(requirements.marketCountry);
  const validated = getValidatedIntelligence(profile);
  if (validated?.market.countryLabel) return validated.market.countryLabel;
  if (profile.market?.trim()) return profile.market.trim();
  return extractInlineField(requirements.brandName, "Market");
}

function ConfidenceBlock({ provenance }: { provenance?: FieldProvenance }) {
  if (!provenance || provenance.level === "inferred") return null;
  if (provenance.confidence < MIN_STRICT_CONFIDENCE) return null;

  const pct = Math.round(provenance.confidence * 100);
  const label = EVIDENCE_LABELS[provenance.level];

  return (
    <>
      <div className="thinkway-campaign-req-confidence">
        <CheckIcon className="size-3" strokeWidth={2.5} />
        {label} {pct}%
      </div>
      <div className="thinkway-campaign-req-confidence-bar">
        <div className="thinkway-campaign-req-confidence-fill" style={{ width: `${pct}%` }} />
      </div>
    </>
  );
}

function NeedsConfirmationTag() {
  return (
    <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-[var(--camp-amber-text)]">
      <CircleAlertIcon className="size-3" />
      Needs confirmation
    </span>
  );
}

function ReqItem({
  label,
  value,
  provenance,
  emptyLabel,
  onAdd,
  disabled,
  extracted,
  chips,
  footerNote,
}: {
  label: string;
  value?: string | null;
  provenance?: FieldProvenance;
  emptyLabel: string;
  onAdd?: () => void;
  disabled?: boolean;
  extracted?: boolean;
  chips?: string[];
  footerNote?: string;
}) {
  const hasValue = Boolean(value?.trim()) || (chips?.length ?? 0) > 0;
  const showCheck =
    hasValue &&
    provenance &&
    provenance.level !== "inferred" &&
    provenance.confidence >= MIN_STRICT_CONFIDENCE;

  return (
    <div className="thinkway-campaign-req-item">
      <span className="thinkway-campaign-req-item-label">
        <span className="inline-flex items-center gap-1.5">
          {label}
          {showCheck ? (
            <CheckIcon className="size-3 text-[var(--camp-green)]" strokeWidth={2.5} />
          ) : null}
        </span>
        {!hasValue && onAdd ? (
          <button
            type="button"
            className="thinkway-campaign-req-add-btn"
            onClick={onAdd}
            disabled={disabled}
          >
            <PlusIcon strokeWidth={3} />
            Add
          </button>
        ) : null}
      </span>
      {chips && chips.length > 0 ? (
        <>
          <div className="thinkway-campaign-req-chip-row">
            {chips.map((chip) => (
              <span key={chip} className="thinkway-campaign-req-mini-chip">
                {chip}
              </span>
            ))}
          </div>
          {footerNote ? (
            <span className="text-[10.5px] font-semibold text-[var(--camp-green-text)]">
              {footerNote}
            </span>
          ) : null}
        </>
      ) : hasValue ? (
        <div
          className={cn(
            "thinkway-campaign-req-item-value",
            extracted && "extracted"
          )}
        >
          {value}
          {extracted ? <ConfidenceBlock provenance={provenance} /> : null}
          {!extracted && provenance ? (
            <div className="mt-1">
              {provenance.confidence >= MIN_STRICT_CONFIDENCE &&
              provenance.level !== "inferred" ? (
                <span className="text-[10.5px] font-semibold text-[var(--camp-green-text)]">
                  {EVIDENCE_LABELS[provenance.level]}{" "}
                  {Math.round(provenance.confidence * 100)}%
                </span>
              ) : (
                <NeedsConfirmationTag />
              )}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="thinkway-campaign-req-item-value empty">{emptyLabel}</div>
      )}
    </div>
  );
}

function ReqCard({
  title,
  icon: Icon,
  children,
  full,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={cn("thinkway-campaign-req-card", full && "full")}>
      <div className="thinkway-campaign-req-card-head">
        <h3>
          <Icon className="size-3.5" />
          {title}
        </h3>
      </div>
      <div className="thinkway-campaign-req-card-body">{children}</div>
    </div>
  );
}

export function CampaignRequirementsForm({
  value,
  onChange,
  baseProfile,
  disabled,
}: Props) {
  const [addKind, setAddKind] = useState<AddDialogKind>(null);
  const [draft, setDraft] = useState("");

  const validated = getValidatedIntelligence(baseProfile);
  const evidence = validated?.fieldEvidence ?? {};

  const patch = (partial: Partial<DiscoveryCampaignRequirements>) =>
    onChange({ ...value, ...partial });

  const searchPreview = useMemo(() => {
    const merged = discoveryRequirementsToProfile(baseProfile, value);
    return mapCampaignIntelligenceToDiscoverySearch(merged).filters.slice(0, 12);
  }, [baseProfile, value]);

  const brandDisplay = useMemo(() => {
    const validated = getValidatedIntelligence(baseProfile);
    return (
      cleanBrandName(validated?.brand.brandName) ||
      cleanBrandName(value.brandName) ||
      cleanBrandName(baseProfile.brandName) ||
      null
    );
  }, [baseProfile, value.brandName]);
  const marketLabel = useMemo(
    () => resolveMarketLabel(baseProfile, value),
    [baseProfile, value]
  );
  const genderLabel =
    value.audienceGender === "female"
      ? "Female"
      : value.audienceGender === "male"
        ? "Male"
        : null;
  const ageLabel =
    value.audienceAgeMin || value.audienceAgeMax
      ? `${value.audienceAgeMin || "?"}–${value.audienceAgeMax || "?"}`
      : null;
  const platformChips = value.platforms.map((p) => PLATFORM_LABELS[p] ?? p);
  const categoryLabel = value.categories.join(", ") || null;
  const nicheLabel = value.creatorNiches.join(", ") || null;
  const keywordLabel = value.keywords.join(", ") || null;
  const followerLabel =
    value.followerMin || value.followerMax
      ? `${value.followerMin || "?"}–${value.followerMax || "?"} followers`
      : null;

  function submitAdd() {
    const trimmed = draft.trim();
    if (!trimmed || !addKind) return;

    switch (addKind) {
      case "brand":
        patch({ brandName: trimmed });
        break;
      case "market":
        patch({ marketCountry: trimmed.toUpperCase(), audienceCountries: [trimmed.toUpperCase()] });
        break;
      case "platform": {
        const platform = trimmed.toLowerCase();
        if (!value.platforms.includes(platform)) {
          patch({ platforms: [...value.platforms, platform] });
        }
        break;
      }
      case "gender":
        patch({ audienceGender: trimmed.toLowerCase() });
        break;
      case "age": {
        const [min, max] = trimmed.split(/[-–—]/).map((s) => s.trim());
        patch({ audienceAgeMin: min ?? "", audienceAgeMax: max ?? "" });
        break;
      }
      case "category":
        if (!value.categories.includes(trimmed)) {
          patch({ categories: [...value.categories, trimmed] });
        }
        break;
      case "niche":
        if (!value.creatorNiches.includes(trimmed)) {
          patch({ creatorNiches: [...value.creatorNiches, trimmed] });
        }
        break;
      case "keyword":
        if (!value.keywords.includes(trimmed)) {
          patch({ keywords: [...value.keywords, trimmed] });
        }
        break;
      case "follower": {
        const [min, max] = trimmed.split(/[-–—]/).map((s) => s.trim());
        patch({ followerMin: min ?? "", followerMax: max ?? "" });
        break;
      }
      default:
        break;
    }

    setDraft("");
    setAddKind(null);
  }

  return (
    <div>
      <div className="thinkway-campaign-req-grid">
        <ReqCard title="Brand & market" icon={StarIcon}>
          <ReqItem
            label="Brand"
            value={brandDisplay}
            provenance={evidence["brand.brandName"]}
            emptyLabel="No brand added yet"
            onAdd={() => setAddKind("brand")}
            disabled={disabled}
            extracted={Boolean(brandDisplay)}
          />
          <ReqItem
            label="Primary market"
            value={marketLabel}
            provenance={evidence["market.countryCode"]}
            emptyLabel="No market added yet"
            onAdd={() => setAddKind("market")}
            disabled={disabled}
          />
        </ReqCard>

        <ReqCard title="Platforms & audience" icon={Globe2Icon}>
          <ReqItem
            label="Social platforms"
            provenance={evidence["platforms"]}
            emptyLabel="Not specified"
            onAdd={() => setAddKind("platform")}
            disabled={disabled}
            chips={platformChips}
            footerNote={
              platformChips.length > 0 &&
              evidence["platforms"] &&
              evidence["platforms"].confidence >= MIN_STRICT_CONFIDENCE
                ? `Normalized ${Math.round(evidence["platforms"].confidence * 100)}%`
                : undefined
            }
          />
          <ReqItem
            label="Gender"
            value={genderLabel}
            provenance={evidence["audience.gender"]}
            emptyLabel="Not specified"
            onAdd={() => setAddKind("gender")}
            disabled={disabled}
          />
          <ReqItem
            label="Age range"
            value={ageLabel}
            provenance={evidence["audience.ageMin"] ?? evidence["audience.ageMax"]}
            emptyLabel="Not specified"
            onAdd={() => setAddKind("age")}
            disabled={disabled}
          />
        </ReqCard>

        <ReqCard title="Creator & keywords" icon={UserIcon} full>
          <div className="grid grid-cols-1 gap-[14px] md:grid-cols-2 md:gap-x-5">
            <ReqItem
              label="Categories"
              value={categoryLabel}
              provenance={evidence["categories"]}
              emptyLabel="Not specified"
              onAdd={() => setAddKind("category")}
              disabled={disabled}
            />
            <ReqItem
              label="Creator types / niches"
              value={nicheLabel}
              provenance={evidence["creator.niches"]}
              emptyLabel="Not specified"
              onAdd={() => setAddKind("niche")}
              disabled={disabled}
            />
            <ReqItem
              label="Follower range"
              value={followerLabel}
              provenance={evidence["creator.followerMin"] ?? evidence["creator.followerMax"]}
              emptyLabel="Not specified"
              onAdd={() => setAddKind("follower")}
              disabled={disabled}
            />
            <ReqItem
              label="Content keywords"
              value={keywordLabel}
              provenance={evidence["keywords"]}
              emptyLabel="Not specified"
              onAdd={() => setAddKind("keyword")}
              disabled={disabled}
            />
          </div>
        </ReqCard>
      </div>

      {addKind ? (
        <div className="mb-4 rounded-lg border border-[var(--camp-green)]/30 bg-[var(--camp-green-bg)] p-4">
          <FieldLabel>
            {addKind === "brand" && "Brand name"}
            {addKind === "market" && "Market country code (e.g. EG)"}
            {addKind === "platform" && "Platform (instagram, tiktok, youtube, twitter)"}
            {addKind === "gender" && "Gender (female / male)"}
            {addKind === "age" && "Age range (e.g. 25-40)"}
            {addKind === "category" && "Category"}
            {addKind === "niche" && "Creator niche"}
            {addKind === "keyword" && "Keyword"}
            {addKind === "follower" && "Follower range (e.g. 20000-500000)"}
          </FieldLabel>
          {addKind === "market" ? (
            <FilterSelect
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={disabled}
              className="mt-2 w-full text-sm"
            >
              <option value="">Select country</option>
              {DISCOVERY_FILTER_COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </FilterSelect>
          ) : addKind === "platform" ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {DISCOVERY_PLATFORMS.map((platform) => (
                <FilterChip
                  key={platform}
                  label={PLATFORM_LABELS[platform] ?? platform}
                  active={value.platforms.includes(platform)}
                  onToggle={() => {
                    patch({
                      platforms: value.platforms.includes(platform)
                        ? value.platforms.filter((p) => p !== platform)
                        : [...value.platforms, platform],
                    });
                    setAddKind(null);
                  }}
                />
              ))}
            </div>
          ) : addKind === "gender" ? (
            <FilterSelect
              value={draft}
              onChange={(e) => {
                patch({ audienceGender: e.target.value });
                setAddKind(null);
              }}
              disabled={disabled}
              className="mt-2 w-full text-sm"
            >
              {GENDER_OPTIONS.map((o) => (
                <option key={o.value || "any"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </FilterSelect>
          ) : (
            <div className="mt-2 flex gap-2">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submitAdd();
                  }
                }}
                disabled={disabled}
                className="h-8 text-xs"
                autoFocus
              />
              <Button
                type="button"
                size="sm"
                className="h-8 bg-[var(--camp-blue)] hover:bg-[var(--camp-blue-hover)]"
                onClick={submitAdd}
                disabled={disabled || !draft.trim()}
              >
                Save
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={() => {
                  setAddKind(null);
                  setDraft("");
                }}
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
      ) : null}

      {searchPreview.length > 0 ? (
        <div className="thinkway-campaign-req-summary-band">
          <div className="thinkway-campaign-req-summary-head">
            <SparklesIcon />
            Thinkway will search for
          </div>
          <div className="thinkway-campaign-req-summary-chips">
            {searchPreview.map((f) => (
              <span key={f.id} className="thinkway-campaign-req-sum-chip">
                <b>{f.label}</b> {formatDiscoveryMappedFilterValue(f)}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
