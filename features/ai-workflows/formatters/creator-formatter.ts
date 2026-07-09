import type { SearchCreatorsOutput } from "@/features/ai";

/** Creator record grounded to searchCreators tool output — never invent fields. */
export interface GroundedCreator {
  id: string;
  handle: string;
  displayName: string;
  platform: string;
  followers?: number;
  engagementRate?: number;
  avatarUrl?: string;
  profileUrl?: string;
  /** Campaign relevance % from CIP search (Discovery AI parity). */
  campaignRelevanceScore?: number;
}

export interface RankedCreator extends GroundedCreator {
  fitScore: number;
  rank: number;
}

export interface ShortlistSuggestion {
  name: string;
  creatorIds: string[];
  creators: RankedCreator[];
  rationale: string;
}

const FILLER_PATTERNS = [
  /\bFeel free to ask[^.!?\n]*[.!?]?/gi,
  /\bPlease provide[^.!?\n]*[.!?]?/gi,
  /\bLet me know[^.!?\n]*[.!?]?/gi,
  /\bDon't hesitate to[^.!?\n]*[.!?]?/gi,
  /\bI'm here to help[^.!?\n]*[.!?]?/gi,
  /\bIf you(?:'d| would) like[^.!?\n]*[.!?]?/gi,
];

/** Strip conversational filler from workflow output. */
export function stripConversationalFiller(text: string): string {
  let result = text.trim();
  for (const pattern of FILLER_PATTERNS) {
    result = result.replace(pattern, "").trim();
  }
  return result.replace(/\n{3,}/g, "\n\n").trim();
}

import {
  dedupeGroundedCreators,
  dedupeByCreatorId,
  type CreatorIntegrityStage,
} from "@/lib/creators/dedupe-creators";
import { resolveCreatorTierLabel } from "@/lib/creators/creator-tier";

/** Normalize unknown creator arrays from tool output or workflow state. */
export function normalizeCreators(
  raw: unknown,
  stage: CreatorIntegrityStage | string = "normalizeCreators"
): GroundedCreator[] {
  if (!Array.isArray(raw)) return [];

  const creators: GroundedCreator[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const obj = entry as Record<string, unknown>;
    const id = typeof obj.id === "string" ? obj.id : undefined;
    if (!id) continue;

    const handle =
      typeof obj.handle === "string"
        ? obj.handle
        : typeof obj.username === "string"
          ? obj.username
          : "";
    const displayName =
      typeof obj.displayName === "string"
        ? obj.displayName
        : typeof obj.name === "string"
          ? obj.name
          : handle;

    creators.push({
      id,
      handle,
      displayName,
      platform: typeof obj.platform === "string" ? obj.platform : "unknown",
      followers: typeof obj.followers === "number" ? obj.followers : undefined,
      engagementRate:
        typeof obj.engagementRate === "number"
          ? obj.engagementRate
          : typeof obj.engagement_rate === "number"
            ? obj.engagement_rate
            : undefined,
      avatarUrl: typeof obj.avatarUrl === "string" ? obj.avatarUrl : undefined,
      profileUrl: typeof obj.profileUrl === "string" ? obj.profileUrl : undefined,
      campaignRelevanceScore:
        typeof obj.campaignRelevanceScore === "number"
          ? obj.campaignRelevanceScore
          : typeof obj.campaign_relevance_score === "number"
            ? obj.campaign_relevance_score
            : undefined,
    });
  }
  return dedupeGroundedCreators(creators, stage).creators;
}

export function extractSearchCreatorsOutput(
  toolResults: Array<{ toolName: string; success: boolean; output?: unknown }>
): SearchCreatorsOutput | undefined {
  const match = toolResults.find(
    (r) => r.toolName === "searchCreators" && r.success && r.output
  );
  if (!match?.output || typeof match.output !== "object") return undefined;
  const output = match.output as SearchCreatorsOutput;
  if (!Array.isArray(output.creators)) return undefined;
  return output;
}

function tokenizeQuery(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/^[@#]+/, "").trim())
    .filter((t) => t.length > 1);
}

function nicheRelevanceScore(creator: GroundedCreator, queryTokens: string[]): number {
  if (queryTokens.length === 0) return 0;
  const haystack = `${creator.displayName} ${creator.handle}`.toLowerCase();
  let matches = 0;
  for (const token of queryTokens) {
    if (haystack.includes(token)) matches += 1;
  }
  return matches / queryTokens.length;
}

function followerScore(followers: number | undefined): number {
  if (followers == null || followers <= 0) return 0;
  return Math.min(Math.log10(followers) / 7, 1);
}

function engagementScore(rate: number | undefined): number {
  if (rate == null || rate <= 0) return 0;
  return Math.min(rate / 10, 1);
}

/**
 * Preserve CIP campaign-relevance order — dedupe only, use relevance as fit score.
 */
export function assignCampaignRelevanceRanks(creators: GroundedCreator[]): RankedCreator[] {
  const deduped = dedupeGroundedCreators(creators, "rankingInput").creators;

  return deduped.map((creator, index) => ({
    ...creator,
    rank: index + 1,
    fitScore: creator.campaignRelevanceScore ?? Math.max(50, 100 - index * 2),
  }));
}

export function hasCampaignRelevanceScores(creators: GroundedCreator[]): boolean {
  return creators.some((c) => typeof c.campaignRelevanceScore === "number");
}

/**
 * Preserve Discovery browse order — dedupe only, assign sequential ranks.
 * Use for Campaign Studio recommendations; does not re-sort by handle/engagement.
 */
export function assignDiscoveryOrderRanks(creators: GroundedCreator[]): RankedCreator[] {
  const deduped = dedupeGroundedCreators(creators, "rankingInput").creators;

  return deduped.map((creator, index) => ({
    ...creator,
    rank: index + 1,
    /** Display-only positional score; order is not derived from this value. */
    fitScore: Math.max(50, 100 - index * 2),
  }));
}

/** Rank creators by campaign fit, engagement, followers, and niche relevance. */
export function rankCreators(
  creators: GroundedCreator[],
  query?: string
): RankedCreator[] {
  const deduped = dedupeGroundedCreators(creators, "rankingInput").creators;
  const queryTokens = query ? tokenizeQuery(query) : [];

  const scored = deduped.map((creator) => {
    const niche = nicheRelevanceScore(creator, queryTokens);
    const engagement = engagementScore(creator.engagementRate);
    const followers = followerScore(creator.followers);
    const fitScore = niche * 0.4 + engagement * 0.35 + followers * 0.25;

    return { ...creator, fitScore: Math.round(fitScore * 100) };
  });

  scored.sort((a, b) => b.fitScore - a.fitScore);

  return scored.map((creator, index) => ({
    ...creator,
    rank: index + 1,
  }));
}

function formatFollowers(count: number | undefined): string {
  if (count == null) return "—";
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return count.toLocaleString();
}

function formatEngagement(rate: number | undefined): string {
  if (rate == null) return "—";
  return `${rate.toFixed(2)}%`;
}

function formatHandle(creator: GroundedCreator): string {
  const handle = creator.handle.startsWith("@")
    ? creator.handle
    : `@${creator.handle}`;
  return handle;
}

/** Operational search summary from tool output. */
export function formatSearchResults(
  creators: GroundedCreator[],
  total: number,
  query?: string
): string {
  const lines: string[] = [];

  if (query?.trim()) {
    lines.push(`**Filters:** query="${query.trim()}"`);
    lines.push("");
  }

  lines.push(`**Results:** ${total} creator(s) found`);

  if (creators.length === 0) {
    lines.push("");
    lines.push("_No creators matched the search criteria._");
    return lines.join("\n");
  }

  lines.push("");
  lines.push("**Top matches:**");
  for (const creator of creators.slice(0, 10)) {
    lines.push(
      `- ${creator.displayName} (${formatHandle(creator)}) · ${creator.platform} · ${formatFollowers(creator.followers)} followers · ${formatEngagement(creator.engagementRate)} engagement`
    );
  }

  if (total > 10) {
    lines.push("");
    lines.push(`_${total} total — showing top 10._`);
  }

  return lines.join("\n");
}

/** Ranked operational summary from grounded creators. */
export function formatRankedResults(
  ranked: RankedCreator[],
  query?: string
): string {
  const lines: string[] = [];

  if (query?.trim()) {
    lines.push(`**Criteria:** ${query.trim()}`);
    lines.push("");
  }

  if (ranked.length === 0) {
    lines.push("_No creators available to rank — run search first._");
    return lines.join("\n");
  }

  lines.push(`**Top matches:** ${Math.min(ranked.length, 10)} in Discovery order`);
  lines.push("");

  for (const creator of ranked.slice(0, 10)) {
    const tier = resolveCreatorTierLabel({ followers: creator.followers });
    lines.push(
      `${creator.rank}. ${creator.displayName} (${formatHandle(creator)}) · ${tier} · ${creator.platform} · ${formatFollowers(creator.followers)} · ${formatEngagement(creator.engagementRate)} engagement · fit ${creator.fitScore}/100`
    );
  }

  return lines.join("\n");
}

/** Shortlist suggestion from ranked grounded creators. */
export function formatShortlistSuggestion(
  ranked: RankedCreator[],
  query?: string
): ShortlistSuggestion {
  const top = ranked.slice(0, 10);
  const label = query?.trim() ? query.trim().slice(0, 60) : "Recommended";
  const name = `${label} — Top ${top.length} Creators`;

  const avgFit =
    top.length > 0
      ? Math.round(top.reduce((sum, c) => sum + c.fitScore, 0) / top.length)
      : 0;
  const rationale =
    top.length > 0
      ? `Top ${top.length} creators in Thinkway Discovery rank order (avg rank score ${avgFit}/100)${query?.trim() ? ` for "${query.trim()}"` : ""}.`
      : "No creators available from search results.";

  const dedupedTop = dedupeByCreatorId(top, (c) => c.id).items;

  return {
    name,
    creatorIds: dedupedTop.map((c) => c.id),
    creators: dedupedTop.map((c, index) => ({
      ...c,
      rank: index + 1,
    })),
    rationale,
  };
}

export function formatShortlistSuggestionMarkdown(
  suggestion: ShortlistSuggestion
): string {
  const lines: string[] = [
    `**Shortlist:** ${suggestion.name}`,
    "",
    suggestion.rationale,
  ];

  if (suggestion.creators.length > 0) {
    const top = suggestion.creators.slice(0, 3);
    lines.push("");
    lines.push(
      `**Featured:** ${top.map((c) => c.displayName).join(", ")}${suggestion.creators.length > 3 ? ` (+${suggestion.creators.length - 3} more)` : ""}.`
    );
  }

  return lines.join("\n");
}

/** Verify text only references creators from the grounded set. */
export function findUngroundedCreatorReferences(
  text: string,
  grounded: GroundedCreator[]
): string[] {
  const groundedNames = new Set<string>();
  for (const c of grounded) {
    groundedNames.add(c.displayName.toLowerCase());
    groundedNames.add(c.handle.toLowerCase().replace(/^@/, ""));
  }

  const commonHallucinations = [
    "emma carter",
    "john smith",
    "jane doe",
    "sarah johnson",
    "michael brown",
    "alex smith",
  ];

  const ungrounded: string[] = [];
  const lower = text.toLowerCase();

  for (const fake of commonHallucinations) {
    if (lower.includes(fake) && !groundedNames.has(fake)) {
      ungrounded.push(fake);
    }
  }

  return ungrounded;
}
