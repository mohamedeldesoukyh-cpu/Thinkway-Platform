import {
  stripConversationalFiller,
  type GroundedCreator,
  type RankedCreator,
  rankCreators,
  normalizeCreators,
} from "./creator-formatter";
import { workflowTrace } from "@/lib/creators/search-trace";

/** Canonical 8-section executive report structure. */
export const EXECUTIVE_REPORT_SECTIONS = [
  { id: "executive-summary", title: "Executive Summary" },
  { id: "campaign-objective", title: "Campaign Objective" },
  { id: "search-criteria", title: "Search Criteria" },
  { id: "creator-analysis", title: "Creator Analysis" },
  { id: "audience-insights", title: "Audience Insights" },
  { id: "top-recommendations", title: "Top Recommendations" },
  { id: "risks-observations", title: "Risks & Observations" },
  { id: "next-steps", title: "Next Steps" },
] as const;

export type ExecutiveReportSectionId = (typeof EXECUTIVE_REPORT_SECTIONS)[number]["id"];

export interface ExecutiveReportSection {
  id: ExecutiveReportSectionId;
  title: string;
  content: string;
}

export interface FindCreatorsReportInput {
  userMessage: string;
  searchCriteria?: string;
  creators: GroundedCreator[];
  totalResults?: number;
  searchQuery?: string;
  shortlistRationale?: string;
}

const FILLER_PHRASES = [
  /\bFeel free to ask[^.!?\n]*[.!?]?/gi,
  /\bPlease provide[^.!?\n]*[.!?]?/gi,
  /\bLet me know[^.!?\n]*[.!?]?/gi,
  /\bDon't hesitate to[^.!?\n]*[.!?]?/gi,
  /\bI'm here to help[^.!?\n]*[.!?]?/gi,
  /\bIf you(?:'d| would) like[^.!?\n]*[.!?]?/gi,
  /\bHappy to help[^.!?\n]*[.!?]?/gi,
  /\bI hope this helps[^.!?\n]*[.!?]?/gi,
];

/** Strip AI filler phrases from report text. */
export function stripReportFiller(text: string): string {
  let result = text.trim();
  for (const pattern of FILLER_PHRASES) {
    result = result.replace(pattern, "").trim();
  }
  return stripConversationalFiller(result);
}

/** Remove duplicate sentences (case-insensitive, normalized whitespace). */
export function dedupeSentences(text: string): string {
  const parts = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const unique: string[] = [];

  for (const sentence of parts) {
    const normalized = sentence.toLowerCase().replace(/\s+/g, " ").replace(/[^\w\s%@.-]/g, "");
    if (normalized.length < 8) {
      unique.push(sentence);
      continue;
    }
    if (!seen.has(normalized)) {
      seen.add(normalized);
      unique.push(sentence);
    }
  }

  return unique.join(" ").replace(/\s{2,}/g, " ").trim();
}

/** Remove duplicate bullet lines from markdown content. */
export function dedupeBulletLines(text: string): string {
  const lines = text.split("\n");
  const seen = new Set<string>();
  const result: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("- ") && !trimmed.startsWith("* ")) {
      result.push(line);
      continue;
    }
    const normalized = trimmed.toLowerCase().replace(/\s+/g, " ");
    if (!seen.has(normalized)) {
      seen.add(normalized);
      result.push(line);
    }
  }

  return result.join("\n");
}

/** Full deduplication pass for report section content. */
export function dedupeReportContent(text: string): string {
  return dedupeBulletLines(dedupeSentences(stripReportFiller(text)));
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

function followerTier(followers: number | undefined): string {
  if (followers == null) return "unknown reach";
  if (followers >= 500_000) return "macro";
  if (followers >= 100_000) return "mid-tier";
  if (followers >= 10_000) return "micro";
  return "nano";
}

function tokenizeQuery(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/^[@#]+/, "").trim())
    .filter((t) => t.length > 1);
}

function nicheMatchScore(creator: GroundedCreator, tokens: string[]): number {
  if (tokens.length === 0) return 0;
  const haystack = `${creator.displayName} ${creator.handle}`.toLowerCase();
  return tokens.filter((t) => haystack.includes(t)).length / tokens.length;
}

function avg(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function platformBreakdown(creators: GroundedCreator[]): string {
  const counts = new Map<string, number>();
  for (const c of creators) {
    const platform = c.platform || "unknown";
    counts.set(platform, (counts.get(platform) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([platform, count]) => `${platform} (${count})`)
    .join(", ");
}

function summarizeCreatorPatterns(creators: GroundedCreator[], query?: string): string {
  if (creators.length === 0) {
    return "No creators matched the search criteria. Consider broadening niche, geography, or platform filters.";
  }

  const followers = creators.map((c) => c.followers).filter((f): f is number => f != null);
  const engagement = creators.map((c) => c.engagementRate).filter((e): e is number => e != null);
  const avgFollowers = avg(followers);
  const avgEngagement = avg(engagement);

  const tiers = new Map<string, number>();
  for (const c of creators) {
    const tier = followerTier(c.followers);
    tiers.set(tier, (tiers.get(tier) ?? 0) + 1);
  }
  const tierSummary = [...tiers.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([tier, count]) => `${count} ${tier}`)
    .join(", ");

  const lines: string[] = [
    `Found ${creators.length} creator(s) across ${platformBreakdown(creators)}.`,
    `Creator mix skews ${tierSummary}.`,
  ];

  if (avgFollowers != null) {
    lines.push(`Average reach is ${formatFollowers(Math.round(avgFollowers))} followers.`);
  }
  if (avgEngagement != null) {
    lines.push(`Average engagement rate is ${avgEngagement.toFixed(2)}%.`);
  }

  if (query?.trim()) {
    const tokens = tokenizeQuery(query);
    const strongNiche = creators.filter((c) => nicheMatchScore(c, tokens) >= 0.3).length;
    if (strongNiche > 0) {
      lines.push(
        `${strongNiche} creator(s) show direct niche alignment with "${query.trim()}" in profile signals.`
      );
    }
  }

  return dedupeReportContent(lines.join(" "));
}

function buildWhySelected(creator: RankedCreator, query?: string): string {
  const reasons: string[] = [];
  if (creator.fitScore >= 70) reasons.push(`high fit score (${creator.fitScore}/100)`);
  else if (creator.fitScore >= 50) reasons.push(`solid fit score (${creator.fitScore}/100)`);

  if (creator.engagementRate != null && creator.engagementRate >= 3) {
    reasons.push(`strong ${formatEngagement(creator.engagementRate)} engagement`);
  }
  if (creator.followers != null && creator.followers >= 100_000) {
    reasons.push(`${formatFollowers(creator.followers)} reach`);
  }

  if (query?.trim()) {
    const match = nicheMatchScore(creator, tokenizeQuery(query));
    if (match >= 0.3) reasons.push("niche keyword alignment");
  }

  return reasons.length > 0 ? reasons.join("; ") : "balanced metrics across reach and engagement";
}

function buildAudienceFit(creator: RankedCreator): string {
  const tier = followerTier(creator.followers);
  const engagement = creator.engagementRate;
  if (tier === "macro" && engagement != null && engagement < 2) {
    return `${tier} reach with moderate engagement — suited for broad awareness`;
  }
  if (tier === "micro" || tier === "mid-tier") {
    return `${tier} audience with typically higher trust and niche affinity`;
  }
  if (engagement != null && engagement >= 4) {
    return "highly engaged community — strong for conversion-focused content";
  }
  return `${tier} audience on ${creator.platform}`;
}

function buildCampaignFit(creator: RankedCreator, query?: string): string {
  if (query?.trim()) {
    const match = nicheMatchScore(creator, tokenizeQuery(query));
    if (match >= 0.5) return `Strong thematic match for "${query.trim()}" campaigns`;
    if (match >= 0.2) return `Partial thematic overlap with "${query.trim()}" — validate content samples`;
  }
  return `Viable for ${creator.platform} content partnerships at ${followerTier(creator.followers)} scale`;
}

function buildPotentialRisks(creator: RankedCreator, allCreators: RankedCreator[]): string {
  const risks: string[] = [];

  if (creator.engagementRate != null && creator.engagementRate < 2) {
    risks.push("below-average engagement — verify audience authenticity");
  }
  const platformCount = allCreators.filter((c) => c.platform === creator.platform).length;
  if (platformCount / allCreators.length > 0.7) {
    risks.push("platform concentration in shortlist — diversify for reach");
  }
  if (creator.followers != null && creator.followers >= 500_000) {
    risks.push("macro rates may exceed budget — confirm fee expectations");
  }

  return risks.length > 0 ? risks.join("; ") : "no significant flags from available data";
}

/** Featured creator comparison table with analysis fields. */
export function formatFeaturedCreatorTable(
  ranked: RankedCreator[],
  query?: string,
  limit = 5
): string {
  const featured = ranked.slice(0, limit);
  if (featured.length === 0) return "_No creators available for recommendations._";

  const header =
    "| Name | Platform | Followers | Engagement | Why selected | Audience fit | Campaign fit | Potential risks |";
  const separator = "| --- | --- | --- | --- | --- | --- | --- | --- |";

  const rows = featured.map((c) => {
    const name = c.displayName.replace(/\|/g, "\\|");
    return `| ${name} | ${c.platform} | ${formatFollowers(c.followers)} | ${formatEngagement(c.engagementRate)} | ${buildWhySelected(c, query)} | ${buildAudienceFit(c)} | ${buildCampaignFit(c, query)} | ${buildPotentialRisks(c, ranked)} |`;
  });

  return [header, separator, ...rows].join("\n");
}

function extractObjectiveFromMessage(message: string): string {
  const trimmed = message.trim();
  if (!trimmed) return "Identify and evaluate creators matching the specified search criteria.";
  return `Source creators aligned with: ${trimmed}`;
}

function buildAudienceInsights(creators: GroundedCreator[], query?: string): string {
  if (creators.length === 0) {
    return "Insufficient creator data to derive audience insights. Run a broader search to populate audience signals.";
  }

  const platforms = [...new Set(creators.map((c) => c.platform))];
  const engagementValues = creators.map((c) => c.engagementRate).filter((e): e is number => e != null);
  const avgEng = avg(engagementValues);

  const lines: string[] = [
    `Primary audience channels: ${platforms.join(", ")}.`,
  ];

  if (avgEng != null) {
    const engagementLevel =
      avgEng >= 4 ? "highly engaged" : avgEng >= 2.5 ? "moderately engaged" : "passively engaged";
    lines.push(`Pool averages ${engagementLevel} audiences (${avgEng.toFixed(2)}% mean engagement).`);
  }

  const macroCount = creators.filter((c) => (c.followers ?? 0) >= 500_000).length;
  const microCount = creators.filter(
    (c) => (c.followers ?? 0) >= 10_000 && (c.followers ?? 0) < 100_000
  ).length;

  if (macroCount > microCount) {
    lines.push("Audience profile leans mass-reach — optimize for awareness and brand recall KPIs.");
  } else if (microCount > 0) {
    lines.push("Micro and mid-tier creators present — favorable for niche trust and conversion metrics.");
  }

  if (query?.trim()) {
    lines.push(`Search intent "${query.trim()}" suggests audiences interested in this niche vertical.`);
  }

  return dedupeReportContent(lines.join(" "));
}

function buildRisks(creators: GroundedCreator[], ranked: RankedCreator[]): string {
  if (creators.length === 0) {
    return "No results returned — search filters may be too narrow or data coverage is limited for this niche.";
  }

  const bullets: string[] = [];
  const lowEngagement = creators.filter((c) => (c.engagementRate ?? 0) < 2 && c.engagementRate != null);
  if (lowEngagement.length > creators.length * 0.4) {
    bullets.push(`${lowEngagement.length} creator(s) show engagement below 2% — vet audience quality before outreach.`);
  }

  const platforms = new Set(creators.map((c) => c.platform));
  if (platforms.size === 1) {
    bullets.push(`All results are on ${[...platforms][0]} — consider cross-platform search for balanced reach.`);
  }

  if (ranked.length > 0 && ranked[0].fitScore < 50) {
    bullets.push("Top fit scores are moderate — none strongly match all criteria; manual review recommended.");
  }

  if (creators.some((c) => c.followers == null || c.engagementRate == null)) {
    bullets.push("Some creators lack complete metrics — confirm follower and engagement data before contracting.");
  }

  if (bullets.length === 0) {
    return "No major data gaps identified. Validate content style and brand safety through sample review before final selection.";
  }

  return bullets.map((b) => `- ${b}`).join("\n");
}

function buildNextSteps(ranked: RankedCreator[]): string {
  const steps = [
    "Review the featured creator table and confirm top 3–5 align with budget and content requirements.",
    "Request content samples or recent posts from shortlisted creators to validate brand fit.",
  ];

  if (ranked.length > 0) {
    steps.push("Build a shortlist in Thinkway from the recommended creators for team review.");
  } else {
    steps.push("Refine search criteria and re-run discovery to expand the candidate pool.");
  }

  steps.push("Define outreach priorities by platform and tier before initiating vendor contact.");

  return steps.map((s, i) => `${i + 1}. ${s}`).join("\n");
}

/** Generate the full 8-section executive report for find-creators workflow. */
export function generateFindCreatorsExecutiveReport(
  input: FindCreatorsReportInput
): ExecutiveReportSection[] {
  const query = input.searchQuery ?? input.userMessage;
  const ranked = rankCreators(input.creators, query);
  const total = input.totalResults ?? input.creators.length;
  const criteriaText = input.searchCriteria?.trim() || "Criteria extracted from user request.";
  const objective = extractObjectiveFromMessage(input.userMessage);

  const topNames = ranked
    .slice(0, 3)
    .map((c) => c.displayName)
    .join(", ");

  const executiveSummary = dedupeReportContent(
    total > 0
      ? `Identified ${total} creator(s) matching the search. Top candidates by fit: ${topNames || "pending ranking"}. ` +
          `${platformBreakdown(input.creators)}. Recommend proceeding with featured creator review and shortlist creation.`
      : "Search completed with no matching creators. Broaden filters or adjust platform and geography constraints before re-running discovery."
  );

  const creatorAnalysis = summarizeCreatorPatterns(input.creators, query);
  const audienceInsights = buildAudienceInsights(input.creators, query);
  const featuredTable = formatFeaturedCreatorTable(ranked, query);
  const risks = buildRisks(input.creators, ranked);
  const nextSteps = buildNextSteps(ranked);

  const searchCriteriaContent = dedupeReportContent(
    `${criteriaText}${query ? `\n\n**Query:** ${query.trim()}` : ""}\n\n**Results:** ${total} creator(s) found.`
  );

  return EXECUTIVE_REPORT_SECTIONS.map((section) => {
    let content: string;
    switch (section.id) {
      case "executive-summary":
        content = executiveSummary;
        break;
      case "campaign-objective":
        content = dedupeReportContent(objective);
        break;
      case "search-criteria":
        content = searchCriteriaContent;
        break;
      case "creator-analysis":
        content = creatorAnalysis;
        break;
      case "audience-insights":
        content = audienceInsights;
        break;
      case "top-recommendations":
        content = featuredTable;
        break;
      case "risks-observations":
        content = risks;
        break;
      case "next-steps":
        content = nextSteps;
        break;
      default:
        content = "";
    }
    return { id: section.id, title: section.title, content: content.trim() };
  });
}

/** Render executive report sections as markdown. */
export function renderExecutiveReportMarkdown(sections: ExecutiveReportSection[]): string {
  return sections
    .filter((s) => s.content.trim())
    .map((s) => `### ${s.title}\n\n${s.content}`)
    .join("\n\n");
}

/** Extract find-creators report input from workflow state fragments. */
export function buildFindCreatorsReportInput(
  state: {
    data: Record<string, unknown>;
    taskResults: Record<string, { content?: string; status?: string } | undefined>;
  },
  userMessage = ""
): FindCreatorsReportInput {
  const creators = normalizeCreators(state.data.searchResults);
  const criteriaResult = state.taskResults["parse-criteria"];
  const searchCriteria =
    criteriaResult?.status === "completed" ? criteriaResult.content?.trim() : undefined;

  workflowTrace("9_executiveReport_input", { data: state.data }, "executiveReportInput", {
    searchResultsLen: Array.isArray(state.data.searchResults)
      ? state.data.searchResults.length
      : null,
    normalizedCreatorsLen: creators.length,
    searchTotal: state.data.searchTotal ?? null,
  });

  const shortlistResult = state.taskResults["shortlist-option"];
  const shortlistRationale =
    shortlistResult?.status === "completed" ? shortlistResult.content?.trim() : undefined;

  return {
    userMessage: userMessage || "Find creators",
    searchCriteria,
    creators,
    totalResults: (state.data.searchTotal as number | undefined) ?? creators.length,
    searchQuery: typeof state.data.searchQuery === "string" ? state.data.searchQuery : userMessage,
    shortlistRationale,
  };
}

/** Check report contains all required sections with content. */
export function validateExecutiveReportStructure(
  sections: ExecutiveReportSection[]
): { valid: boolean; missing: string[] } {
  const requiredTitles = EXECUTIVE_REPORT_SECTIONS.map((s) => s.title);
  const presentTitles = sections.filter((s) => s.content.trim()).map((s) => s.title);
  const missing = requiredTitles.filter((t) => !presentTitles.includes(t));
  return { valid: missing.length === 0, missing };
}

/** Detect filler phrases in report content. */
export function containsReportFiller(text: string): boolean {
  const lower = text.toLowerCase();
  return [
    "feel free to ask",
    "let me know",
    "please provide",
    "don't hesitate",
    "i'm here to help",
    "happy to help",
    "i hope this helps",
  ].some((phrase) => lower.includes(phrase));
}
