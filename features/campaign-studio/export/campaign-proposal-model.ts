import type { CampaignObject } from "@/features/campaign-intelligence";
import {
  buildKpiFramework,
  estimateSlateReach,
  filterCelebrityMixTiers,
  resolveCelebrityAllowed,
  sanitizeClientBrandLabel,
  sanitizeClientFacingText,
  type SlateCreatorInput,
} from "../services/campaign-render-model";
import {
  resolveBudgetData,
  resolveCampaignObjectDurationWeeks,
  resolveCampaignSummary,
  resolveCreativeConcepts,
  resolveCreatorMix,
  resolveExecutiveSummaryData,
  resolveGroundedKpis,
  resolveGroundedStrategyFields,
  resolvePresentationCompletion,
  resolvePresentationData,
  resolveTimelineData,
} from "../services/section-data-resolver";
import { formatFollowers } from "../components/sections/shared/format-utils";

/**
 * One document model for every client export. The PDF (HTML) renderer and the
 * PowerPoint renderer both consume this model, so the two deliverables — and
 * the Studio surfaces feeding them — cannot diverge on campaign facts.
 * Every string in the model is client-safe (internal reasoning stripped).
 */

export type ProposalKeyValueSection = {
  kind: "keyValue";
  id: string;
  title: string;
  items: Array<{ label: string; value: string }>;
};

export type ProposalTextSection = {
  kind: "text";
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

export type ProposalTableSection = {
  kind: "table";
  id: string;
  title: string;
  headers: string[];
  rows: string[][];
  note?: string;
};

export type ProposalCardsSection = {
  kind: "cards";
  id: string;
  title: string;
  cards: Array<{ title: string; lines: string[] }>;
};

export type ProposalSection =
  | ProposalKeyValueSection
  | ProposalTextSection
  | ProposalTableSection
  | ProposalCardsSection;

export type CampaignProposalModel = {
  campaignName: string;
  preparedForLine: string;
  dateLabel: string;
  version: string;
  confidentialityNote: string;
  sections: ProposalSection[];
};

function clean(value?: string): string {
  return sanitizeClientFacingText(value);
}

/** Strategy labels suitable for a client document — internal deliberation labels are excluded. */
const CLIENT_STRATEGY_LABELS = new Set([
  "Business Challenge",
  "Campaign Objective",
  "Chosen Strategy",
  "Why This Strategy Wins",
  "Target Audience",
  "Consumer Insight",
  "Key Message",
  "Creator Strategy",
  "Platform Strategy",
  "Customer Journey",
  "Competitive Advantage",
  "Success Conditions",
]);

export function buildCampaignProposalModel(
  campaignObject: CampaignObject,
  hydratedVendors: SlateCreatorInput[] = [],
  options?: { dateLabel?: string }
): CampaignProposalModel {
  const summary = resolveCampaignSummary(campaignObject);
  const presentation = resolvePresentationData(campaignObject);
  const completion = resolvePresentationCompletion(campaignObject);
  const executive = resolveExecutiveSummaryData(campaignObject);
  const budget = resolveBudgetData(campaignObject);
  const timeline = resolveTimelineData(campaignObject);
  const durationWeeks = resolveCampaignObjectDurationWeeks(campaignObject);
  const concepts = resolveCreativeConcepts(campaignObject);
  const allowCelebrity = resolveCelebrityAllowed(campaignObject);
  const creatorMix = filterCelebrityMixTiers(resolveCreatorMix(campaignObject), allowCelebrity);
  const kpiFramework = buildKpiFramework(resolveGroundedKpis(campaignObject));
  const reach = estimateSlateReach(hydratedVendors);

  const brand =
    sanitizeClientBrandLabel(presentation?.brandName) ??
    sanitizeClientBrandLabel(summary?.brand) ??
    sanitizeClientBrandLabel(summary?.client);
  const storedCampaignName = sanitizeClientBrandLabel(presentation?.campaignName);
  const campaignName =
    storedCampaignName && storedCampaignName !== brand
      ? storedCampaignName
      : brand
        ? `${brand} Campaign Proposal`
        : "Campaign Proposal";
  const dateLabel =
    options?.dateLabel ??
    new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  const sections: ProposalSection[] = [];

  // Campaign overview — the same resolved facts the Studio summary cards show.
  const overviewItems = [
    { label: "Client", value: clean(summary?.client ?? brand) },
    { label: "Brand", value: clean(summary?.brand ?? brand) },
    { label: "Objective", value: clean(summary?.objective) },
    { label: "Target Audience", value: clean(summary?.targetAudience) },
    { label: "Market", value: clean(summary?.market) },
    { label: "Platforms", value: clean(summary?.platforms) },
    { label: "Duration", value: `${durationWeeks} weeks` },
    {
      label: "Budget",
      value: budget?.total
        ? `${budget.currency ?? "USD"} ${budget.total.toLocaleString()}`
        : clean(summary?.budget) || "To be confirmed with client",
    },
    {
      label: "Estimated Reach",
      value: reach
        ? reach.formattedRange
        : summary?.estimatedReach ?? "Modeled once the creator slate is confirmed",
    },
  ].filter((item) => item.value.trim());

  sections.push({
    kind: "keyValue",
    id: "overview",
    title: "Campaign Overview",
    items: overviewItems,
  });

  // Executive summary.
  const executiveParagraphs = [clean(executive?.summary)].filter(Boolean);
  const executiveBullets = [
    ...(executive?.keyDecisions ?? []).map(clean),
    ...(executive?.recommendedActions ?? []).map(clean),
  ].filter(Boolean);
  if (executiveParagraphs.length > 0 || executiveBullets.length > 0) {
    sections.push({
      kind: "text",
      id: "executive-summary",
      title: "Executive Summary",
      paragraphs: executiveParagraphs,
      bullets: executiveBullets,
    });
  }

  // Strategy — the same resolved fields Studio renders, filtered to
  // client-appropriate labels (internal deliberation labels excluded).
  const strategyBullets = resolveGroundedStrategyFields(campaignObject)
    .filter((field) => CLIENT_STRATEGY_LABELS.has(field.label))
    .map((field) => {
      const value = clean(field.value);
      return value ? `${field.label}: ${value}` : "";
    })
    .filter(Boolean);
  if (strategyBullets.length > 0) {
    sections.push({
      kind: "text",
      id: "strategy",
      title: "Strategy",
      paragraphs: [],
      bullets: strategyBullets,
    });
  }

  // Creative concepts — only the campaign's actual proposed concepts.
  if (concepts.length > 0) {
    sections.push({
      kind: "cards",
      id: "creative-concepts",
      title: "Creative Concepts",
      cards: concepts.map((concept) => ({
        title: clean(concept.name) || concept.name,
        lines: [
          clean(concept.bigIdea),
          concept.hook ? `Hook: ${clean(concept.hook)}` : "",
          concept.contentTheme ? `Theme: ${clean(concept.contentTheme)}` : "",
          concept.cta ? `Call to action: ${clean(concept.cta)}` : "",
          concept.hashtags.length > 0 ? concept.hashtags.join(" ") : "",
        ].filter(Boolean),
      })),
    });
  }

  // Recommended creator slate.
  const vendorRows = hydratedVendors.map((vendor) => [
    clean(vendor.displayName) || vendor.displayName || "—",
    vendor.handle ? `@${vendor.handle.replace(/^@/, "")}` : "—",
    vendor.platform ?? "—",
    vendor.followers != null ? formatFollowers(vendor.followers) : "—",
    vendor.engagementRate != null ? `${(vendor.engagementRate * 100).toFixed(1)}%` : "—",
  ]);
  sections.push({
    kind: "table",
    id: "creator-slate",
    title: "Recommended Creator Slate",
    headers: ["Creator", "Handle", "Platform", "Followers", "Engagement"],
    rows: vendorRows,
    note:
      vendorRows.length === 0
        ? "Creator slate to be confirmed following discovery and client approval."
        : undefined,
  });

  // Creator mix.
  if (creatorMix.length > 0) {
    sections.push({
      kind: "table",
      id: "creator-mix",
      title: "Creator Mix",
      headers: ["Tier", "Share", "Creators", "Rationale"],
      rows: creatorMix.map((tier) => [
        tier.tier,
        `${tier.percent}%`,
        tier.count > 0 ? String(tier.count) : "—",
        clean(tier.reasoning),
      ]),
    });
  }

  // Budget allocation.
  if (budget && budget.allocations.length > 0) {
    const currency = budget.currency ?? "USD";
    sections.push({
      kind: "table",
      id: "budget",
      title: "Budget Allocation",
      headers: ["Category", "Share", `Amount (${currency})`],
      rows: budget.allocations.map((line) => [
        clean(line.category) || line.category,
        line.percent != null ? `${Math.round(line.percent)}%` : "—",
        line.amount != null ? line.amount.toLocaleString() : "—",
      ]),
      note: budget.total
        ? `Total budget: ${currency} ${budget.total.toLocaleString()}`
        : undefined,
    });
  }

  // Timeline — client-facing phases from the same canonical duration.
  if (timeline && timeline.weeks.length > 0) {
    sections.push({
      kind: "table",
      id: "timeline",
      title: `Campaign Timeline (${durationWeeks} weeks)`,
      headers: ["Week", "Phase", "Key Activities"],
      rows: timeline.weeks.map((week) => [
        `Week ${week.week}`,
        clean(week.phase) || week.phase,
        week.activities.map(clean).filter(Boolean).join("; "),
      ]),
    });
  }

  // Measurement & KPI framework — the client-suitable success-metrics page.
  if (kpiFramework.length > 0) {
    sections.push({
      kind: "table",
      id: "kpi-framework",
      title: "Measurement & KPI Framework",
      headers: ["KPI", "Target", "Why It Matters", "How It Is Measured"],
      rows: kpiFramework.map((row) => [row.metric, row.target, row.rationale, row.measurement]),
    });
  }

  // Estimated reach with documented assumptions.
  sections.push({
    kind: "text",
    id: "reach",
    title: "Estimated Reach",
    paragraphs: reach
      ? [reach.formattedRange]
      : ["A reach estimate will be modeled once the creator slate is confirmed."],
    bullets: reach ? reach.assumptions : undefined,
  });

  return {
    campaignName,
    preparedForLine: brand ? `Prepared for ${brand}` : "Prepared by Thinkway",
    dateLabel,
    version: completion.version,
    confidentialityNote: "Confidential — for client review only",
    sections,
  };
}
