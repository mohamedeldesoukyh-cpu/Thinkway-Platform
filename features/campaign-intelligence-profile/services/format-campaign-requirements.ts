import { fixBrandDisplayName } from "./discovery-search-mapping/enrich-brief-search-signals";
import { countryLabel } from "./normalization/validators";
import { getValidatedIntelligence } from "./get-validated-intelligence";
import type { CampaignIntelligenceProfile } from "../types/profile";

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  twitter: "X",
};

export type CampaignRequirementRow = {
  id: string;
  label: string;
  value: string;
};

function line(label: string, value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? `${label} : ${trimmed}` : null;
}

function lineList(label: string, values?: string[]): string | null {
  const items = (values ?? []).map((v) => v.trim()).filter(Boolean);
  return items.length ? `${label} : ${items.join(", ")}` : null;
}

/** Structured rows for IDH-style sidebar display (no raw document dump). */
export function getCampaignRequirementRows(
  profile: CampaignIntelligenceProfile
): CampaignRequirementRow[] {
  const rows: CampaignRequirementRow[] = [];

  const push = (id: string, label: string, value?: string | null) => {
    const trimmed = value?.trim();
    if (trimmed) rows.push({ id, label, value: trimmed });
  };

  const pushList = (id: string, label: string, values?: string[]) => {
    const joined = (values ?? []).map((v) => v.trim()).filter(Boolean).join(", ");
    if (joined) rows.push({ id, label, value: joined });
  };

  push("brand", "Client / Brand Name", profile.brandName ?? profile.clientName);
  push("campaign", "Campaign Name", profile.campaignName);
  push("market", "Campaign Country", profile.market ?? profile.geography?.[0]);
  pushList("objectives", "Campaign Objectives", profile.objectives);
  push(
    "duration",
    "Campaign Duration",
    profile.durationWeeks ? `${profile.durationWeeks} weeks` : null
  );
  pushList("platforms", "Social Platforms", profile.platforms);

  const creatorPrefs = [
    ...(profile.creatorCategories ?? []),
    ...(profile.creatorNiches ?? []),
    ...(profile.contentStyle ?? []),
  ];
  pushList("creators", "Creator Type Preferences", creatorPrefs);

  const audienceParts: string[] = [];
  if (profile.audienceDetail?.gender) audienceParts.push(profile.audienceDetail.gender);
  if (profile.audienceDetail?.ageMin != null || profile.audienceDetail?.ageMax != null) {
    audienceParts.push(
      `ages ${profile.audienceDetail.ageMin ?? "?"}–${profile.audienceDetail.ageMax ?? "?"}`
    );
  }
  if (profile.audience?.trim()) audienceParts.push(profile.audience.trim());
  if (profile.audienceDetail?.countries?.length) {
    audienceParts.push(profile.audienceDetail.countries.join(", "));
  } else if (profile.geography?.length) {
    audienceParts.push(profile.geography.join(", "));
  }
  push("audience", "Audience Preferences", audienceParts.join(" · "));

  const keywords = [
    ...(profile.products ?? []),
    ...(profile.toneOfVoice ?? []),
    ...(profile.kpis ?? []),
  ];
  pushList("keywords", "Content Keywords", keywords);
  pushList("deliverables", "Deliverables", profile.deliverables);

  if (profile.budget?.amount) {
    push("budget", "Budget", `${profile.budget.amount} ${profile.budget.currency}`);
  }

  pushList("mandatory", "Mandatory Requirements", profile.requirements?.mandatory);
  pushList("constraints", "Constraints", profile.constraints);

  return rows;
}

export function serializeRequirementRows(rows: CampaignRequirementRow[]): string {
  return rows.map((row) => `${row.label} : ${row.value}`).join("\n\n");
}

/** IDH-style plain text (structured fields only — never raw PDF dump). */
export function formatCampaignRequirements(
  profile: CampaignIntelligenceProfile,
  _fullText?: string | null
): string {
  const rows = getCampaignRequirementRows(profile);
  if (rows.length > 0) return serializeRequirementRows(rows);

  const fallback = [
    line("Brand", profile.brandName),
    line("Market", profile.market),
    line("Audience", profile.audience),
    lineList("Platforms", profile.platforms),
  ].filter(Boolean) as string[];

  return fallback.join("\n\n");
}

/** IDH-style one-line summary for Discovery Search (validatedIntelligence SSOT). */
export function buildCampaignRequirementsSummary(
  profile: CampaignIntelligenceProfile
): string | null {
  const v = getValidatedIntelligence(profile);
  if (!v) {
    const fallback = formatCampaignRequirements(profile).replace(/\n\n/g, ". ").trim();
    return fallback || null;
  }

  const parts: string[] = [];

  const brand = fixBrandDisplayName(v.brand.brandName?.trim() || profile.brandName?.trim() || "");
  if (brand) parts.push(brand);

  const market =
    v.market.countryLabel?.trim() ||
    (v.market.countryCode ? countryLabel(v.market.countryCode) : null) ||
    profile.market?.trim();
  if (market) parts.push(market);

  const platforms = v.platforms
    .map((p) => PLATFORM_LABELS[p.toLowerCase()] ?? p)
    .filter(Boolean);
  if (platforms.length) parts.push(platforms.join(", "));

  const audienceCountries = v.audience.countries
    .map((code) => countryLabel(code))
    .filter(Boolean);
  if (audienceCountries.length) {
    parts.push(`Audience: ${audienceCountries.join(", ")}`);
  }

  if (v.audience.gender && v.audience.gender !== "any") {
    parts.push(`${v.audience.gender} audience`);
  }

  if (v.audience.ageMin != null || v.audience.ageMax != null) {
    parts.push(`ages ${v.audience.ageMin ?? "?"}–${v.audience.ageMax ?? "?"}`);
  }

  const categories = [...v.categories, ...v.creator.niches].filter(Boolean);
  if (categories.length) parts.push(`Categories: ${categories.join(", ")}`);

  const keywords = v.keywords.filter(Boolean);
  if (keywords.length) parts.push(`Keywords: ${keywords.join(", ")}`);

  if (profile.objectives?.length) {
    parts.push(`Objective: ${profile.objectives.join("; ")}`);
  }

  if (parts.length === 0) return null;
  return `${parts.join(". ")}.`;
}
