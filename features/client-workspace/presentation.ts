import type { ClientReviewSource } from "./constants";
import { clientSafeFitCopy, clientSafeParagraph, formatPlatformLabel } from "./format";
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
  return { tiers, markets, categories, genders };
}

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

export function proposalSubtitle(): string {
  return "Influencer Marketing Proposal";
}

export function viewRosterMeta(view: Pick<ClientWorkspaceView, "review" | "creators">) {
  const count = proposedCreatorCount(view.creators);
  return {
    count,
    headline: rosterHeadline(count),
    sourceLine: rosterSourceLine(view.review.source),
  };
}
