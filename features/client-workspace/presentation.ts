import type { ClientReviewSource } from "./constants";
import {
  clientSafeFitCopy,
  clientSafeParagraph,
  formatCompactCount,
  formatPlatformLabel,
  normalizeClientEngagementRate,
} from "./format";
import type {
  ClientAudienceSlice,
  ClientCreatorCard,
  ClientMediaPlanSummary,
  ClientOverview,
  ClientWorkspaceView,
} from "./types";

export const CLIENT_SOURCE_LABEL: Record<ClientReviewSource, string> = {
  studio: "Studio recommendation",
  shortlist: "Approved shortlist",
  quotation: "Quotation",
};

export function proposedCreatorCount(creators: Array<{ creatorId: string }>): number {
  return creators.length;
}

export function proposalSubtitle(): string {
  return "Influencer marketing proposal";
}

export function rosterHeadline(count: number): string {
  const noun = count === 1 ? "creator" : "creators";
  return `${count} ${noun} proposed`;
}

export function rosterSourceLine(source: ClientReviewSource): string {
  return `Source: ${CLIENT_SOURCE_LABEL[source]}`;
}

export type StrategicPillar = {
  title: string;
  body: string;
};

function isGenericShortlistCopy(text: string): boolean {
  return /^creator shortlist for /i.test(text.trim()) || /^commercial proposal /i.test(text.trim());
}

export function strategicPillars(input: {
  overview: Pick<
    ClientOverview,
    "objective" | "audience" | "market" | "platforms" | "whyThisApproach" | "creatorCount"
  >;
  strategyBody?: string;
  activityMix: ClientMediaPlanSummary["activityMix"];
  categories: string[];
}): StrategicPillar[] {
  const pillars: StrategicPillar[] = [];
  const strategy = input.strategyBody
    ?.split(/\n+/)
    .map((part) => clientSafeParagraph(part) ?? clientSafeFitCopy(part))
    .filter((part): part is string => Boolean(part));
  if (strategy && strategy.length > 0) {
    const titles = ["Recommended approach", "Audience relevance", "Content role", "Campaign alignment", "Creator mix"];
    for (let index = 0; index < Math.min(5, strategy.length); index += 1) {
      pillars.push({ title: titles[index] ?? "Approach", body: strategy[index]! });
    }
  }

  if (input.overview.objective?.trim()) {
    pushUnique(pillars, "Campaign objective", input.overview.objective.trim());
  }
  if (input.overview.audience?.trim()) {
    pushUnique(pillars, "Audience relevance", input.overview.audience.trim());
  }
  if (input.overview.market?.trim()) {
    pushUnique(pillars, "Market relevance", input.overview.market.trim());
  }
  if (input.overview.platforms.length > 0) {
    pushUnique(
      pillars,
      "Platform mix",
      input.overview.platforms.map((platform) => formatPlatformLabel(platform) ?? platform).join(", ")
    );
  }
  if (input.activityMix.length > 0) {
    pushUnique(
      pillars,
      "Content role",
      input.activityMix.map((item) => `${item.count} ${item.label}`).join(" · ")
    );
  }
  if (input.categories.length > 0) {
    pushUnique(pillars, "Creator mix", input.categories.slice(0, 6).join(" · "));
  }

  const why = input.overview.whyThisApproach?.trim();
  if (why && !isGenericShortlistCopy(why) && pillars.length < 3) {
    pushUnique(pillars, "Why this approach", why);
  }

  return pillars.slice(0, 5);
}

function pushUnique(pillars: StrategicPillar[], title: string, body: string) {
  if (!body.trim()) return;
  if (pillars.some((pillar) => pillar.body.toLowerCase() === body.trim().toLowerCase())) return;
  if (pillars.some((pillar) => pillar.title === title)) return;
  pillars.push({ title, body: body.trim() });
}

export type CreatorMixSlice = {
  label: string;
  count: number;
};

export function creatorMixFromRoster(creators: ClientCreatorCard[]): {
  tiers: CreatorMixSlice[];
  markets: CreatorMixSlice[];
  categories: CreatorMixSlice[];
  genders: CreatorMixSlice[];
  platforms: CreatorMixSlice[];
} {
  const tiers = countLabels(creators.map((creator) => displayTier(creator.tier)));
  const markets = countLabels(
    creators.map((creator) => creator.country?.trim()).filter((value): value is string => Boolean(value))
  );
  const categories = countLabels(
    creators.flatMap((creator) =>
      creator.categories?.length
        ? creator.categories
        : creator.category
          ? [creator.category]
          : creator.niche
            ? [creator.niche]
            : []
    )
  );
  const genders = countLabels(
    creators.flatMap((creator) => genderLabels(creator.audience?.genders ?? []))
  );
  const platforms = countLabels(
    creators.flatMap((creator) => {
      const accounts = creator.platformAccounts?.map((row) => row.platform) ?? [];
      if (accounts.length > 0) return accounts;
      return creator.platform ? [creator.platform] : [];
    }).map((platform) => formatPlatformLabel(platform) ?? platform)
  );
  return { tiers, markets, categories, genders, platforms };
}

export const MIX_BAR_COLORS = [
  "#0057FF",
  "#12B76A",
  "#F79009",
  "#7A5AF8",
  "#EE46BC",
  "#0BA5EC",
  "#F04438",
  "#17B26A",
];

function displayTier(tier?: string): string | undefined {
  if (!tier || tier === "Unknown") return undefined;
  return tier;
}

function genderLabels(slices: ClientAudienceSlice[]): string[] {
  return slices
    .filter((slice) => slice.percent != null && slice.percent > 0)
    .map((slice) => slice.label);
}

function countLabels(labels: Array<string | undefined>): CreatorMixSlice[] {
  const counts = new Map<string, number>();
  for (const label of labels) {
    const key = label?.trim();
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function allocationSlices(input: {
  creatorInvestment: number;
  feeAmount?: number;
  totalInvestment: number;
}): CreatorMixSlice[] | null {
  const fee = input.feeAmount;
  if (fee == null || !Number.isFinite(fee) || fee <= 0) return null;
  const creator = input.creatorInvestment;
  const total = input.totalInvestment > 0 ? input.totalInvestment : creator + fee;
  if (total <= 0) return null;
  return [
    { label: "Creator investment", count: Math.round((creator / total) * 100) },
    { label: "Services", count: Math.round((fee / total) * 100) },
  ].filter((slice) => slice.count > 0);
}

export function containsInternalTerminology(text: string | undefined): boolean {
  if (!text) return false;
  return /\b(ECI|Apify|DNA|CIP|fingerprint|Campaign Facts|Discovery Engine|Thinkway Score|vendor cost|gross profit|\bGP\b|margin)\b/i.test(
    text
  );
}

export const AVATAR_GRADS = [
  "linear-gradient(135deg,#0057FF,#1A6FFF)",
  "linear-gradient(135deg,#7F77DD,#534AB7)",
  "linear-gradient(135deg,#1D9E75,#0F6E56)",
  "linear-gradient(135deg,#D85A30,#993C1D)",
  "linear-gradient(135deg,#378ADD,#0C447C)",
  "linear-gradient(135deg,#D4537E,#72243E)",
];

export function initialsFromName(name: string): string {
  const latin = name.match(/[A-Za-z]+/g);
  if (latin && latin.length) {
    return (latin[0]![0] + (latin[1]?.[0] ?? latin[0]![1] ?? "")).toUpperCase();
  }
  const arabic = name.match(/[\u0600-\u06FF]+/g);
  if (arabic && arabic.length) {
    return arabic[0]![0] + (arabic[1]?.[0] ?? arabic[0]![1] ?? "");
  }
  return "TW";
}

export function flagFromCountry(value?: string): string {
  if (!value?.trim()) return "";
  const raw = value.trim();
  const named: Record<string, string> = {
    AE: "AE",
    UAE: "AE",
    "United Arab Emirates": "AE",
    KW: "KW",
    Kuwait: "KW",
    SA: "SA",
    "Saudi Arabia": "SA",
    QA: "QA",
    Qatar: "QA",
    EG: "EG",
    Egypt: "EG",
  };
  const code = named[raw] ?? (raw.length === 2 ? raw.toUpperCase() : "");
  if (!/^[A-Z]{2}$/.test(code)) return "";
  return String.fromCodePoint(...[...code].map((char) => 127397 + char.charCodeAt(0)));
}

export function qualityGaugePercent(label?: string): number | undefined {
  if (label === "High Quality") return 88;
  if (label === "Good") return 72;
  if (label === "Monitor") return 48;
  return undefined;
}

export function engagementBadge(rate?: number | null): { className: string; text: string } | undefined {
  const value = normalizeClientEngagementRate(rate);
  if (value == null) return undefined;
  if (value >= 5) return { className: "exc", text: "Excellent" };
  return { className: "avg", text: "Average" };
}

export function engagementGaugePercent(rate?: number | null): number | undefined {
  const value = normalizeClientEngagementRate(rate);
  if (value == null) return undefined;
  if (value <= 0) return 8;
  if (value < 1) return 22;
  if (value < 2) return 38;
  if (value < 3.5) return 55;
  if (value < 5) return 72;
  return 88;
}

export function estimatedReachInsight(input: {
  reach?: number | null;
  followers?: number | null;
}): {
  value: string;
  percent?: number;
  badge?: { className: string; text: string };
  explanation: string;
  gaugePercent?: number;
} | null {
  const reach = input.reach != null && Number.isFinite(input.reach) ? input.reach : undefined;
  if (reach == null) return null;
  const followers =
    input.followers != null && Number.isFinite(input.followers) && input.followers > 0
      ? input.followers
      : undefined;
  const percent = followers != null ? (reach / followers) * 100 : undefined;
  const value = formatCompactCount(reach);
  if (percent == null) {
    return {
      value,
      explanation:
        `Estimated reach for this creator is ${value}, based on available performance for this proposal.`,
    };
  }
  const share = percent >= 10 ? percent.toFixed(1) : percent.toFixed(2);
  if (percent >= 15) {
    return {
      value,
      percent,
      gaugePercent: 88,
      badge: { className: "opt", text: "Optimal" },
      explanation: `Posts are estimated to reach ${share}% of this creator's followers (${value} of ${formatCompactCount(followers)}). That is a strong visibility level for this audience size.`,
    };
  }
  if (percent >= 8) {
    return {
      value,
      percent,
      gaugePercent: 55,
      badge: { className: "avg", text: "Average" },
      explanation: `Posts are estimated to reach ${share}% of this creator's followers (${value} of ${formatCompactCount(followers)}). This is in line with typical reach for this audience size and provides a moderate level of visibility.`,
    };
  }
  return {
    value,
    percent,
    gaugePercent: 28,
    badge: { className: "avg", text: "Average" },
    explanation: `Posts are estimated to reach ${share}% of this creator's followers (${value} of ${formatCompactCount(followers)}). Visibility is more concentrated, so placements should be planned around high-performing content.`,
  };
}

export function qualityBadge(label?: string): { className: string; text: string } | undefined {
  if (label === "High Quality") return { className: "exc", text: "Excellent" };
  if (label === "Good") return { className: "avg", text: "Good" };
  if (label === "Monitor") return { className: "avg", text: "Average" };
  return undefined;
}

export function donutGradient(slices: Array<{ count: number }>): string {
  const total = slices.reduce((sum, slice) => sum + slice.count, 0) || 1;
  let start = 0;
  const stops = slices.map((slice, index) => {
    const end = start + slice.count / total;
    const stop = `${MIX_BAR_COLORS[index % MIX_BAR_COLORS.length]} ${start}turn ${end}turn`;
    start = end;
    return stop;
  });
  return `conic-gradient(${stops.join(",")})`;
}

export function viewRosterMeta(view: Pick<ClientWorkspaceView, "review" | "creators">) {
  const count = proposedCreatorCount(view.creators);
  return {
    count,
    headline: rosterHeadline(count),
    sourceLine: rosterSourceLine(view.review.source),
  };
}
