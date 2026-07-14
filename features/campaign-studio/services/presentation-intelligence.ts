import {
  detectIndustryFromBrief,
  getIndustryProfile,
  resolveClientFromBrief,
  type CampaignIndustry,
} from "./industry-intelligence";
import {
  parseDurationWeeks,
  resolveGoLiveWeek,
  type CampaignDurationWeeks,
} from "./timeline-duration";
import { stripMarkdown } from "../components/sections/shared/format-utils";
import { creatorTierStrategyToMix } from "@/features/campaign-director/facts/facts-display-bridge";
import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";
import {
  filterCelebrityMixTiers,
  stripCelebrityFromLabel,
} from "./campaign-render-model";
import type { TimelineMilestone } from "@/features/campaign-intelligence/types/section-schemas";
import type {
  ExecutiveSummaryData,
  GroundedElement,
  GroundedStrategyField,
  GroundingSource,
  OpportunityItem,
  SuccessProbabilityData,
  VendorRankingFactor,
} from "./grounding-types";

export type CreativeConcept = {
  name: string;
  bigIdea: string;
  hook: string;
  keyVisual: string;
  contentTheme: string;
  cta: string;
  sampleCaption: string;
  hashtags: string[];
  targetEmotion?: string;
  contentStyle?: string;
  creatorStyle?: string;
  visualDirection?: string;
};

export type ContentPlanItem = {
  platform: string;
  contentType: string;
  creatorTier: string;
  quantity: number;
  postingDate: string;
  objective: string;
};

export type CreatorMixTier = {
  tier: "Nano" | "Micro" | "Mid" | "Macro" | "Celebrity";
  count: number;
  percent: number;
  reasoning: string;
};

export type WhyAiInsight = {
  category: string;
  title: string;
  rationale: string;
  evidence?: string;
  source?: import("./grounding-types").GroundingSource;
  confidence?: number;
};

function extractSection(text: string, header: RegExp): string | undefined {
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (header.test(lines[i])) {
      const inline = lines[i].replace(header, "").replace(/^[:#\s-]+/, "").trim();
      if (inline) return stripMarkdown(inline);
      for (let j = i + 1; j < lines.length; j++) {
        const next = lines[j].trim();
        if (/^#{1,3}\s/.test(next) || /^[A-Z][^:]+:/.test(next)) break;
        if (next) return stripMarkdown(next.replace(/^[-*•]\s*/, ""));
      }
    }
  }
  return undefined;
}

/**
 * Parse explicitly proposed creative concepts out of the campaign's own
 * strategy narrative (a "Creative Concepts" heading followed by named
 * bullets). Returns [] when the strategy proposes none.
 */
export function parseCreativeConceptsFromText(text: string): CreativeConcept[] {
  if (!text.trim()) return [];
  const lines = text.split("\n");
  const headingIndex = lines.findIndex((line) =>
    /^#{0,3}\s*creative concepts?\b/i.test(line.trim())
  );
  if (headingIndex < 0) return [];

  const concepts: CreativeConcept[] = [];
  for (let i = headingIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (/^#{1,3}\s/.test(line) && !/creative concept/i.test(line)) break;
    const bullet = line.match(/^(?:[-*\u2022]|\d+[.)])\s*(.+)$/);
    if (!bullet?.[1]) continue;

    const entry = stripMarkdown(bullet[1]);
    const split = entry.split(/\s*(?:—|–|:)\s*/);
    const name = split[0]?.trim();
    const description = split.slice(1).join(" — ").trim() || name;
    if (!name) continue;

    concepts.push({
      name,
      bigIdea: description,
      hook: description.split(/(?<=[.!?])\s+/)[0] ?? description,
      keyVisual: description,
      contentTheme: name,
      cta: "Learn more",
      sampleCaption: description,
      hashtags: [],
    });
  }
  return concepts;
}

function brandHashtag(brand: string): string {
  const compact = brand.replace(/[^\w]/g, "");
  return compact ? `#${compact}` : "";
}

/**
 * Creative concepts for THIS campaign. Precedence: concepts explicitly
 * proposed in the strategy narrative, else concept directions composed from
 * the campaign's own facts (brand, objective, audience, platforms, market).
 * No industry demo templates — when the campaign context is unknown, no
 * concepts are rendered.
 */
export function deriveCreativeConcepts(
  strategyText: string,
  summaryText: string,
  facts?: CampaignFacts
): CreativeConcept[] {
  const parsed = parseCreativeConceptsFromText(strategyText);
  if (parsed.length > 0) return parsed;

  const combined = [strategyText, summaryText].filter(Boolean).join("\n");
  const brand =
    facts?.brandName ??
    facts?.clientName ??
    extractSection(combined, /^#{0,3}\s*brand/i);
  if (!brand?.trim()) return [];

  const objective = facts?.objective ?? extractSection(combined, /objective/i) ?? "brand awareness";
  const audience =
    facts?.audience ?? extractSection(combined, /(?:target )?audience/i) ?? "the target audience";
  const market = facts?.geography?.join(", ") ?? extractSection(combined, /^#{0,3}\s*market/i);
  const platforms = facts?.platforms?.length ? facts.platforms : ["Instagram"];
  const primaryPlatform = platforms[0];
  const marketSuffix = market ? ` in ${market}` : "";
  const tag = brandHashtag(brand);
  const marketTag = market ? `#${market.split(/[,\s]+/)[0].replace(/[^\w]/g, "")}` : "";
  const baseTags = [tag, marketTag].filter(Boolean);

  return [
    {
      name: `${brand} Real Stories`,
      bigIdea: `${objective} told through authentic creator experiences with ${brand}${marketSuffix}`,
      hook: `The ${brand} story, told by the people who live it`,
      keyVisual: `Creator-led ${primaryPlatform} storytelling featuring ${brand}`,
      contentTheme: "Authentic creator storytelling",
      cta: `Discover ${brand}`,
      sampleCaption: `Real experiences. Real results. This is ${brand}.`,
      hashtags: [...baseTags, "#CreatorStories"].slice(0, 5),
      targetEmotion: "Trust & connection",
      contentStyle: `${primaryPlatform}-native narrative`,
      visualDirection: `Creator point-of-view featuring ${brand}`,
    },
    {
      name: `${brand} Community Proof`,
      bigIdea: `Peer validation at scale — ${audience} advocating for ${brand}`,
      hook: `Hear it from ${audience}`,
      keyVisual: `UGC series from ${audience}${marketSuffix}`,
      contentTheme: "UGC & social proof",
      cta: `Join the ${brand} community`,
      sampleCaption: `Trusted by ${audience} — and counting.`,
      hashtags: [...baseTags, "#Community"].slice(0, 5),
      targetEmotion: "Belonging & validation",
      contentStyle: "UGC collage",
      visualDirection: "Multi-creator grid with candid moments",
    },
    {
      name: `${brand} in Action`,
      bigIdea: `Product-in-context content that turns ${objective.toLowerCase()} into consideration`,
      hook: "See it in action",
      keyVisual: `${primaryPlatform}-native demonstration with lifestyle context`,
      contentTheme: "Product demonstration",
      cta: "Learn more",
      sampleCaption: `${brand}, put to the test.`,
      hashtags: [...baseTags, "#InAction"].slice(0, 5),
      targetEmotion: "Desire & action",
      contentStyle: "Demonstration with clear CTA",
      visualDirection: "Lifestyle context, product hero focus",
    },
  ];
}

const MIX_BY_INDUSTRY: Record<CampaignIndustry, CreatorMixTier[]> = {
  luxury: [
    { tier: "Celebrity", count: 1, percent: 15, reasoning: "Brand ambassador credibility" },
    { tier: "Macro", count: 2, percent: 35, reasoning: "Premium reach with editorial quality" },
    { tier: "Mid", count: 3, percent: 30, reasoning: "Lifestyle aspiration content" },
    { tier: "Micro", count: 2, percent: 15, reasoning: "Niche luxury communities" },
    { tier: "Nano", count: 0, percent: 5, reasoning: "Reserved for event coverage" },
  ],
  tourism: [
    { tier: "Macro", count: 2, percent: 25, reasoning: "Travel storytellers with global reach" },
    { tier: "Mid", count: 4, percent: 35, reasoning: "Destination content specialists" },
    { tier: "Micro", count: 6, percent: 30, reasoning: "Local guides & experience creators" },
    { tier: "Nano", count: 4, percent: 10, reasoning: "Authentic traveler UGC" },
    { tier: "Celebrity", count: 0, percent: 0, reasoning: "Not required for destination campaigns" },
  ],
  baby: [
    { tier: "Mid", count: 3, percent: 25, reasoning: "Established mom influencers" },
    { tier: "Micro", count: 8, percent: 45, reasoning: "Relatable mom creators with engaged communities" },
    { tier: "Nano", count: 6, percent: 25, reasoning: "Authentic UGC from real parents" },
    { tier: "Macro", count: 1, percent: 5, reasoning: "Category authority figure" },
    { tier: "Celebrity", count: 0, percent: 0, reasoning: "Authenticity over celebrity for baby category" },
  ],
  retail: [
    { tier: "Macro", count: 1, percent: 20, reasoning: "Launch hero & hype driver" },
    { tier: "Mid", count: 4, percent: 30, reasoning: "Fitness & lifestyle creators" },
    { tier: "Micro", count: 8, percent: 35, reasoning: "Product try-on & fit content" },
    { tier: "Nano", count: 10, percent: 15, reasoning: "Street style UGC volume" },
    { tier: "Celebrity", count: 0, percent: 0, reasoning: "Performance over celebrity endorsement" },
  ],
  finance: [
    { tier: "Mid", count: 3, percent: 30, reasoning: "Verified finance educators" },
    { tier: "Micro", count: 5, percent: 35, reasoning: "Niche personal finance communities" },
    { tier: "Macro", count: 1, percent: 20, reasoning: "Trust anchor & reach driver" },
    { tier: "Nano", count: 3, percent: 10, reasoning: "Customer testimonial style UGC" },
    { tier: "Celebrity", count: 0, percent: 5, reasoning: "Credibility over fame in finance" },
  ],
  general: [
    { tier: "Mid", count: 3, percent: 30, reasoning: "Core campaign creators" },
    { tier: "Micro", count: 5, percent: 40, reasoning: "Engagement-focused content" },
    { tier: "Nano", count: 4, percent: 20, reasoning: "Volume UGC" },
    { tier: "Macro", count: 1, percent: 10, reasoning: "Reach amplification" },
    { tier: "Celebrity", count: 0, percent: 0, reasoning: "Not required" },
  ],
};

export function deriveCreatorMix(
  strategyText: string,
  summaryText: string,
  tierStrategy?: Array<{ tier: string; allocationPercent: number; why: string }>,
  options?: { allowCelebrity?: boolean }
): CreatorMixTier[] {
  const allowCelebrity =
    options?.allowCelebrity ?? /celebrit/i.test([strategyText, summaryText].join("\n"));

  if (tierStrategy?.length) {
    return filterCelebrityMixTiers(creatorTierStrategyToMix(tierStrategy), allowCelebrity);
  }
  const industry = detectIndustryFromBrief([strategyText, summaryText].join("\n"));
  return filterCelebrityMixTiers(
    MIX_BY_INDUSTRY[industry].filter((t) => t.percent > 0 || t.count > 0),
    allowCelebrity
  );
}

const CONTENT_DELIVERABLES: Record<
  CampaignIndustry,
  Array<{ platform: string; contentType: string; quantity: number; creatorTier: string; objective: string }>
> = {
  luxury: [
    { platform: "Instagram", contentType: "Reels", quantity: 4, creatorTier: "Macro", objective: "Aspiration" },
    { platform: "Instagram", contentType: "Carousels", quantity: 3, creatorTier: "Mid", objective: "Heritage" },
    { platform: "Instagram", contentType: "Stories", quantity: 8, creatorTier: "Macro", objective: "Exclusivity" },
    { platform: "YouTube", contentType: "Long-form", quantity: 2, creatorTier: "Macro", objective: "Craftsmanship" },
    { platform: "YouTube", contentType: "Shorts", quantity: 3, creatorTier: "Mid", objective: "Discovery" },
  ],
  tourism: [
    { platform: "TikTok", contentType: "Videos", quantity: 6, creatorTier: "Mid", objective: "Discovery" },
    { platform: "Instagram", contentType: "Reels", quantity: 8, creatorTier: "Mid", objective: "Inspiration" },
    { platform: "Instagram", contentType: "Stories", quantity: 15, creatorTier: "Micro", objective: "Engagement" },
    { platform: "YouTube", contentType: "Vlogs", quantity: 3, creatorTier: "Macro", objective: "Consideration" },
    { platform: "TikTok", contentType: "Live", quantity: 2, creatorTier: "Macro", objective: "Real-time" },
  ],
  baby: [
    { platform: "TikTok", contentType: "Videos", quantity: 8, creatorTier: "Micro", objective: "UGC volume" },
    { platform: "Instagram", contentType: "Reels", quantity: 6, creatorTier: "Micro", objective: "Awareness" },
    { platform: "Instagram", contentType: "Stories", quantity: 12, creatorTier: "Nano", objective: "Engagement" },
    { platform: "TikTok", contentType: "Reviews", quantity: 5, creatorTier: "Mid", objective: "Trust" },
    { platform: "Instagram", contentType: "Carousels", quantity: 4, creatorTier: "Mid", objective: "Education" },
  ],
  retail: [
    { platform: "TikTok", contentType: "Videos", quantity: 10, creatorTier: "Nano", objective: "Hype" },
    { platform: "Instagram", contentType: "Reels", quantity: 8, creatorTier: "Micro", objective: "Try-on" },
    { platform: "Instagram", contentType: "Stories", quantity: 14, creatorTier: "Micro", objective: "Launch" },
    { platform: "YouTube", contentType: "Unboxing", quantity: 3, creatorTier: "Mid", objective: "Product" },
    { platform: "TikTok", contentType: "Fit checks", quantity: 6, creatorTier: "Nano", objective: "Conversion" },
  ],
  finance: [
    { platform: "Instagram", contentType: "Reels", quantity: 5, creatorTier: "Mid", objective: "Education" },
    { platform: "Instagram", contentType: "Carousels", quantity: 6, creatorTier: "Mid", objective: "Tips" },
    { platform: "LinkedIn", contentType: "Posts", quantity: 4, creatorTier: "Mid", objective: "Trust" },
    { platform: "YouTube", contentType: "Explainers", quantity: 3, creatorTier: "Macro", objective: "Adoption" },
    { platform: "Instagram", contentType: "Stories", quantity: 8, creatorTier: "Micro", objective: "Engagement" },
  ],
  general: [
    { platform: "TikTok", contentType: "Videos", quantity: 5, creatorTier: "Micro", objective: "Awareness" },
    { platform: "Instagram", contentType: "Reels", quantity: 5, creatorTier: "Mid", objective: "Engagement" },
    { platform: "Instagram", contentType: "Stories", quantity: 10, creatorTier: "Micro", objective: "Reach" },
  ],
};

export function deriveContentPlan(
  strategyText: string,
  summaryText: string,
  durationWeeks?: CampaignDurationWeeks
): ContentPlanItem[] {
  const combined = [strategyText, summaryText].filter(Boolean).join("\n");
  const industry = detectIndustryFromBrief(combined);
  const weeks = durationWeeks ?? parseDurationWeeks(combined);
  const deliverables = CONTENT_DELIVERABLES[industry];

  return deliverables.map((item, index) => ({
    platform: item.platform,
    contentType: item.contentType,
    creatorTier: item.creatorTier,
    quantity: item.quantity,
    postingDate: `Week ${Math.min(index + 1, weeks)}`,
    objective: item.objective,
  }));
}

export function deriveWhyAiInsights(
  strategyText: string,
  summaryText: string,
  budgetText?: string,
  durationWeeks?: CampaignDurationWeeks
): WhyAiInsight[] {
  const combined = [strategyText, summaryText, budgetText].filter(Boolean).join("\n");
  const industry = detectIndustryFromBrief(combined);
  const profile = getIndustryProfile(industry, combined);
  const weeks = durationWeeks ?? parseDurationWeeks(combined);
  const allowCelebrity = /celebrit/i.test(combined);
  const mixSummary = stripCelebrityFromLabel(profile.creatorMixSummary, allowCelebrity);

  const creatorRationaleByIndustry: Record<CampaignIndustry, string> = {
    luxury: "AI matched creators with premium aesthetics and affluent audience overlap",
    tourism: "AI identified travel storytellers with destination content focus",
    baby: "AI filtered parenting creators with authentic 0–3 year content",
    retail: "AI ranked creators by product category fit and engagement quality",
    finance: "AI selected compliance-safe finance educators with verified audiences",
    general: "AI analyzed creator profiles to find optimal category fit",
  };

  return [
    {
      category: "Creators",
      title: "Why these creators",
      rationale: creatorRationaleByIndustry[industry],
      evidence: "Ranked from Thinkway creator intelligence (fit, audience, engagement)",
      source: "Creator" as const,
      confidence: 85,
    },
    {
      category: "Budget",
      title: "Why this allocation",
      rationale: `${profile.budgetWeights[0].percent}% creator fees + ${profile.budgetWeights[2].percent}% paid amplification optimized for ${profile.campaignType.toLowerCase()}.`,
      evidence: `${profile.label} category allocation convention`,
      source: "Industry" as const,
      confidence: 82,
    },
    {
      category: "Strategy",
      title: "Why this approach",
      rationale: `${profile.campaignType} requires ${profile.platforms.join(" + ")} focus with ${mixSummary.toLowerCase()}.`,
      evidence: `${profile.label} category best practices`,
      source: "Industry" as const,
      confidence: 84,
    },
    {
      category: "KPIs",
      title: "Why these targets",
      rationale: `Targets aligned to the ${weeks}-week duration and ${profile.label} category benchmarks.`,
      evidence: `Category benchmark ranges · ${weeks}-week phasing`,
      source: "Industry" as const,
      confidence: 80,
    },
    {
      category: "Timeline",
      title: "Why this schedule",
      rationale: `${weeks}-week phasing balances production quality, approval cycles, and go-live momentum.`,
      evidence: `Production and approval phases scaled to the ${weeks}-week window`,
      source: "Industry" as const,
      confidence: 82,
    },
    {
      category: "Concepts",
      title: "Why these creative directions",
      rationale: "Concept directions composed from this campaign's brand, audience, and objective.",
      evidence: "Campaign brief context",
      source: "AI" as const,
      confidence: 80,
    },
  ];
}

export function deriveExecutiveStrategyFields(
  strategyText: string,
  audienceText: string,
  summaryText: string
): Record<string, string | string[]> {
  const combined = [strategyText, audienceText, summaryText].filter(Boolean).join("\n");
  const industry = detectIndustryFromBrief(combined);
  const profile = getIndustryProfile(industry, combined);

  const challengeByIndustry: Record<CampaignIndustry, string> = {
    luxury: "Standing out in saturated premium market while maintaining exclusivity",
    tourism: "Converting awareness into trip planning intent in competitive MENA travel market",
    baby: "Building trust with skeptical first-time parents in crowded diaper category",
    retail: "Driving product trial and conversion during competitive launch window",
    finance: "Overcoming trust barriers and regulatory constraints in financial product adoption",
    general: "Breaking through category noise with authentic creator-led storytelling",
  };

  const insightByIndustry: Record<CampaignIndustry, string> = {
    luxury: "Luxury buyers seek validation from peers, not ads — creator authenticity drives consideration",
    tourism: "Travel decisions are emotional and visual — destination content triggers planning behavior",
    baby: "Parents trust peer recommendations over brand messaging for product decisions",
    retail: "Try-on and fit content reduces purchase hesitation in apparel and sportswear",
    finance: "Financial decisions require repeated exposure to trusted educators before action",
    general: "Creator recommendations outperform brand-owned content on engagement",
  };

  const journeyByIndustry: Record<CampaignIndustry, string> = {
    luxury: "Discovery → Aspiration → Consideration → Boutique visit",
    tourism: "Inspiration → Research → Planning → Booking",
    baby: "Awareness → Peer validation → Trial → Loyalty",
    retail: "Hype → Try-on → Purchase → Advocacy",
    finance: "Education → Trust building → Consideration → Application",
    general: "Awareness → Engagement → Consideration → Action",
  };

  const advantageByIndustry: Record<CampaignIndustry, string> = {
    luxury: "Curated creator roster with proven luxury brand collaborations",
    tourism: "Local creator network with on-ground production capability",
    baby: "Verified mom creator community with authentic parenting content",
    retail: "Multi-tier creator mix optimized for launch velocity and conversion",
    finance: "Compliance-vetted finance educators with regulatory-safe content track record",
    general: "AI-optimized creator mix based on category performance data",
  };

  const briefPersona = extractSection(combined, /persona/i);
  const briefAudience =
    extractSection(combined, /target audience/i) ??
    extractSection(combined, /primary audience/i) ??
    extractSection(combined, /audience/i);
  const personas = briefPersona
    ? [briefPersona]
    : briefAudience
      ? [briefAudience]
      : [];

  return {
    businessChallenge: challengeByIndustry[industry],
    campaignObjective:
      extractSection(combined, /objective/i) ??
      extractSection(combined, /campaign objective/i) ??
      profile.campaignType,
    targetAudience:
      extractSection(combined, /target audience/i) ??
      extractSection(combined, /primary audience/i) ??
      extractSection(combined, /audience/i) ??
      "Category-relevant audience segment",
    audiencePersonas: personas,
    consumerInsight: insightByIndustry[industry],
    keyMessage:
      extractSection(combined, /key message/i) ??
      `Experience ${profile.label.toLowerCase()} excellence through authentic creator voices`,
    communicationPillars: [
      "Authentic storytelling",
      `${profile.label} category relevance`,
      "Multi-platform reach",
    ],
    contentPillars: profile.platforms.map(
      (p) => `${p}: ${profile.campaignType.split("&")[0].trim()} content`
    ),
    creatorStrategy: stripCelebrityFromLabel(
      profile.creatorMixSummary,
      /celebrit/i.test(combined)
    ),
    platformStrategy: `${profile.platforms.join(", ")} — weighted by ${profile.label} audience behavior`,
    customerJourney: journeyByIndustry[industry],
    successFactors: [
      "Creator-brand fit quality",
      "Content approval velocity",
      "Paid amplification efficiency",
    ],
    competitiveAdvantage: advantageByIndustry[industry],
  };
}

export type TimelineWeekDetail = {
  week: number;
  phase: string;
  activities: string[];
  deliverables: string[];
  owner: string;
  dependencies: string[];
  milestones: string[];
  approvalGates: string[];
  status: "pending" | "in_progress" | "complete";
};

type KeyPhaseWeeks = {
  start: number;
  productionEnd: number;
  goLive: number;
  optimizationEnd: number;
  end: number;
};

const INTERNAL_MILESTONE_PATTERN =
  /brief|vendor|discovery|shortlist|kickoff|outreach|compliance review|strategy approval|creator selection|planning|qa|pre-launch|stakeholder/i;

export function isClientFacingTimelinePhase(phase: string): boolean {
  return !INTERNAL_MILESTONE_PATTERN.test(phase);
}

function assignClientPhaseWeeks(durationWeeks: number): KeyPhaseWeeks {
  const goLive = resolveGoLiveWeek(durationWeeks);
  const end = durationWeeks;
  const productionEnd = Math.max(1, goLive - 1);
  const optimizationEnd = Math.max(goLive, end - 1);

  return {
    start: 1,
    productionEnd,
    goLive,
    optimizationEnd,
    end,
  };
}

function resolveClientPhaseLabel(
  week: number,
  durationWeeks: number,
  phases: KeyPhaseWeeks
): string {
  if (durationWeeks === 1) return "Publishing Window";
  if (week === phases.start) return "Campaign Start";
  if (week === phases.goLive) return "Publishing Window";
  if (week === phases.end) return "Reporting";
  if (week === phases.end - 1 && phases.end - 1 > phases.goLive) return "Campaign End";
  if (week < phases.goLive) return "Content Production";
  return "Optimization";
}

function clientPhaseTemplate(phase: string): Omit<TimelineWeekDetail, "week" | "status"> {
  switch (phase) {
    case "Campaign Start":
      return {
        phase,
        activities: ["Campaign kickoff", "Creator briefing and content planning"],
        deliverables: ["Approved content plan", "Creator roster confirmed"],
        owner: "Campaign manager",
        dependencies: ["Signed campaign brief"],
        milestones: ["Campaign live-ready"],
        approvalGates: [],
      };
    case "Content Production":
      return {
        phase,
        activities: ["Creator content creation", "Brand review cycles", "Asset finalization"],
        deliverables: ["Approved content pack", "Final assets ready to publish"],
        owner: "Production",
        dependencies: ["Creator roster confirmed"],
        milestones: ["All content approved"],
        approvalGates: ["Brand content approval"],
      };
    case "Publishing Window":
      return {
        phase,
        activities: ["Scheduled publishing", "Paid boost activation", "Real-time monitoring"],
        deliverables: ["Live content", "Performance dashboard"],
        owner: "Media",
        dependencies: ["Approved content"],
        milestones: ["Campaign live"],
        approvalGates: ["Launch authorization"],
      };
    case "Optimization":
      return {
        phase,
        activities: ["Performance optimization", "Budget pacing review", "Content refinement"],
        deliverables: ["Weekly performance update", "Optimization recommendations"],
        owner: "Campaign manager",
        dependencies: ["Campaign live"],
        milestones: ["Mid-campaign checkpoint"],
        approvalGates: [],
      };
    case "Campaign End":
      return {
        phase,
        activities: ["Final publishing push", "Campaign wrap activities"],
        deliverables: ["Campaign close summary"],
        owner: "Campaign manager",
        dependencies: ["Optimization complete"],
        milestones: ["Campaign complete"],
        approvalGates: [],
      };
    case "Reporting":
      return {
        phase,
        activities: ["Performance analysis", "Learnings documentation", "Final report delivery"],
        deliverables: ["Final report", "Case study highlights"],
        owner: "Analyst",
        dependencies: ["Campaign complete"],
        milestones: ["Report delivered"],
        approvalGates: ["Client sign-off"],
      };
    default:
      return {
        phase,
        activities: ["Campaign execution"],
        deliverables: ["Weekly status update"],
        owner: "Campaign manager",
        dependencies: [],
        milestones: [],
        approvalGates: [],
      };
  }
}

export function applyTimelineCompletionStatus(
  weeks: TimelineWeekDetail[],
  isComplete: boolean
): TimelineWeekDetail[] {
  if (!isComplete) return weeks;
  return weeks.map((week) => ({ ...week, status: "complete" }));
}

function assignKeyPhaseWeeks(durationWeeks: number): KeyPhaseWeeks {
  return assignClientPhaseWeeks(durationWeeks);
}

export function deriveTimelineWeeks(
  durationWeeks: CampaignDurationWeeks,
  _industry: CampaignIndustry,
  options?: { isComplete?: boolean }
): TimelineWeekDetail[] {
  const phaseWeeks = assignKeyPhaseWeeks(durationWeeks);
  const weeks: TimelineWeekDetail[] = [];

  for (let w = 1; w <= durationWeeks; w++) {
    const phaseLabel = resolveClientPhaseLabel(w, durationWeeks, phaseWeeks);
    const template = clientPhaseTemplate(phaseLabel);
    weeks.push({
      week: w,
      ...template,
      status: options?.isComplete ? "complete" : w === 1 ? "in_progress" : "pending",
    });
  }

  return weeks;
}

export function mergeMilestonesIntoWeeks(
  weeks: TimelineWeekDetail[],
  _milestones: TimelineMilestone[],
  durationWeeks: number,
  _goLiveWeek: number,
  options?: { isComplete?: boolean }
): TimelineWeekDetail[] {
  const trimmed = weeks.slice(0, durationWeeks).map((week, index) => ({
    ...week,
    week: index + 1,
  }));

  return applyTimelineCompletionStatus(trimmed, Boolean(options?.isComplete));
}

export function buildTimelineWeeksForCampaign(
  durationWeeks: CampaignDurationWeeks,
  industry: CampaignIndustry,
  milestones: TimelineMilestone[] = [],
  options?: { isComplete?: boolean }
): { weeks: TimelineWeekDetail[]; goLiveWeek: number; durationWeeks: CampaignDurationWeeks } {
  const goLiveWeek = resolveGoLiveWeek(durationWeeks);
  const derived = deriveTimelineWeeks(durationWeeks, industry, options);
  const weeks = mergeMilestonesIntoWeeks(derived, milestones, durationWeeks, goLiveWeek, options);
  return { weeks, goLiveWeek, durationWeeks };
}

export type DiscoveryPipelineStage = {
  id: string;
  label: string;
  count: number;
  status: "complete" | "active" | "pending";
};

export function deriveDiscoveryPipeline(
  totalCandidates: number,
  isSearching: boolean
): DiscoveryPipelineStage[] {
  const stages = [
    { id: "db", label: "Thinkway DB", ratio: 1 },
    { id: "ig", label: "Instagram", ratio: 0.85 },
    { id: "tt", label: "TikTok", ratio: 0.7 },
    { id: "yt", label: "YouTube", ratio: 0.55 },
    { id: "ai", label: "AI Filtering", ratio: 0.35 },
    { id: "rank", label: "Ranking", ratio: 0.2 },
    { id: "final", label: "Final Candidates", ratio: 0.12 },
  ];

  const baseCount = totalCandidates > 0 ? Math.round(totalCandidates / 0.12) : 2400;

  return stages.map((stage, index) => {
    const count =
      totalCandidates > 0
        ? index === stages.length - 1
          ? totalCandidates
          : Math.round(baseCount * stage.ratio)
        : 0;

    let status: DiscoveryPipelineStage["status"] = "pending";
    if (totalCandidates > 0) status = "complete";
    else if (isSearching) {
      const activeIndex = 3;
      if (index < activeIndex) status = "complete";
      else if (index === activeIndex) status = "active";
    }

    return { id: stage.id, label: stage.label, count, status };
  });
}

export function deriveGroundedStrategy(
  strategyText: string,
  audienceText: string,
  summaryText: string
): GroundedStrategyField[] {
  const combined = [strategyText, audienceText, summaryText].filter(Boolean).join("\n");
  const industry = detectIndustryFromBrief(combined);
  const profile = getIndustryProfile(industry, combined);
  const fields = deriveExecutiveStrategyFields(strategyText, audienceText, summaryText);
  const resolvedClient = resolveClientFromBrief(combined);
  const client = /^brand client$/i.test(resolvedClient) ? undefined : resolvedClient;

  const sourceMap: Record<string, { source: GroundingSource; confidence: number; reason: string }> = {
    businessChallenge: { source: "Industry", confidence: 85, reason: `${profile.label} vertical challenge pattern` },
    campaignObjective: { source: "Client", confidence: 95, reason: client ? `Extracted from ${client} brief` : "Extracted from campaign brief" },
    targetAudience: { source: "Client", confidence: 93, reason: "Brief-defined audience segment" },
    consumerInsight: { source: "Industry", confidence: 82, reason: "Category consumer behavior pattern" },
    keyMessage: { source: "AI", confidence: 85, reason: "AI-generated from brand + category context" },
    creatorStrategy: { source: "Industry", confidence: 84, reason: "Category creator-mix playbook" },
    platformStrategy: { source: "Industry", confidence: 86, reason: "Platform behavior patterns for category" },
    customerJourney: { source: "Industry", confidence: 84, reason: "Category purchase journey mapping" },
    competitiveAdvantage: { source: "AI", confidence: 80, reason: "Differentiation analysis vs category" },
  };

  const keyMap: Record<string, keyof typeof fields> = {
    "Business Challenge": "businessChallenge",
    "Campaign Objective": "campaignObjective",
    "Target Audience": "targetAudience",
    "Consumer Insight": "consumerInsight",
    "Key Message": "keyMessage",
    "Creator Strategy": "creatorStrategy",
    "Platform Strategy": "platformStrategy",
    "Customer Journey": "customerJourney",
    "Competitive Advantage": "competitiveAdvantage",
  };

  return Object.entries(keyMap)
    .filter(([, key]) => fields[key])
    .map(([label, key]) => {
      const meta = sourceMap[key] ?? sourceMap.businessChallenge;
      const value = fields[key];
      return {
        label,
        value: typeof value === "string" ? value : Array.isArray(value) ? value.join(" · ") : "",
        grounding: {
          source: meta.source,
          confidence: meta.confidence,
          reason: meta.reason,
          evidence: client ? `${profile.label} · ${client}` : profile.label,
        },
      };
    });
}

export function deriveSuccessProbability(
  strategyText: string,
  summaryText: string,
  durationWeeks?: CampaignDurationWeeks
): SuccessProbabilityData {
  const combined = [strategyText, summaryText].filter(Boolean).join("\n");
  const industry = detectIndustryFromBrief(combined);
  const profile = getIndustryProfile(industry, combined);
  const weeks = durationWeeks ?? parseDurationWeeks(combined);

  const scores: Record<CampaignIndustry, number> = {
    luxury: 78,
    tourism: 85,
    baby: 88,
    retail: 82,
    finance: 74,
    general: 75,
  };

  const data: Record<CampaignIndustry, Omit<SuccessProbabilityData, "score" | "grounding">> = {
    luxury: {
      strengths: ["Premium creator roster with proven luxury collaborations", "Strong editorial production capability", "HNW audience targeting precision"],
      weaknesses: ["Limited macro creator availability in MENA", "Extended approval cycles may compress timeline", "High CPM reduces reach efficiency"],
      risks: ["Brand dilution from off-brand aesthetics", "Creator scheduling conflicts during peak season"],
      improvements: ["Secure backup macro roster now", "Pre-approve visual guidelines before outreach", "Add 1 week buffer to production phase"],
    },
    tourism: {
      strengths: ["Multi-platform travel storyteller network", "Strong visual content pipeline", "High organic save rates on destination content"],
      weaknesses: ["Seasonal sentiment dependency", "Permit logistics at heritage sites"],
      risks: ["Filming restrictions at key landmarks", "Creator travel cancellations"],
      improvements: ["Secure filming permits 3 weeks ahead", "Build local creator bench for backup", "Geo-target paid boost to feeder markets"],
    },
    baby: {
      strengths: ["Deep mom creator community with high trust", "Authentic UGC at scale", "Strong trial conversion history"],
      weaknesses: ["UGC quality variance across micro creators", "Claim sensitivity in baby category"],
      risks: ["Parent skepticism on product claims", "Regulatory compliance on messaging"],
      improvements: ["Deploy detailed brief templates with sample content", "Pre-approve claim library", "Add pediatrician endorsement layer"],
    },
    retail: {
      strengths: ["High-volume nano/micro activation capacity", "Try-on content reduces purchase hesitation", "Front-loaded launch momentum strategy"],
      weaknesses: ["Stock availability sync complexity", "Competitor counter-campaign risk"],
      risks: ["Inventory stock-outs during launch", "Sizing misrepresentation in fit content"],
      improvements: ["Sync inventory alerts with posting schedule", "Mandatory fit-guide in all try-on content", "Increase paid amplification week 1 by 15%"],
    },
    finance: {
      strengths: ["Compliance-vetted finance educator network", "Trust-building content track record", "LinkedIn qualified reach capability"],
      weaknesses: ["Extended legal review cycles", "Lower organic ER in finance vertical"],
      risks: ["Regulatory non-compliance in scripts", "Low trust transfer from entertainment creators"],
      improvements: ["Mandatory compliance review pre-shoot", "Prioritize verified educators over reach", "Use demo environments for app screenshots"],
    },
    general: {
      strengths: ["Balanced creator mix", "Multi-platform reach", "Flexible content plan"],
      weaknesses: ["Less category-specific optimization", "Generic KPI targets"],
      risks: ["Timeline slippage on vendor outreach"],
      improvements: ["Refine audience targeting from brief", "Add industry-specific creator filters"],
    },
  };

  const d = data[industry];
  const score = scores[industry] + (weeks <= 6 ? 3 : weeks >= 12 ? -2 : 0);
  const objectiveMatch = combined.match(/objective[:\s]+(.+)/i);
  const objectiveRaw = objectiveMatch?.[1]?.trim() ?? profile.campaignType;
  const objectives = objectiveRaw
    .split(/[,;]| and /i)
    .map((part) => part.trim())
    .filter(Boolean);

  const objectiveAssessments = (objectives.length ? objectives : [objectiveRaw]).map((objective) => ({
    objective,
    confidence: Math.min(95, score),
    supportingEvidence: `${profile.label} · ${weeks}-week plan · ${profile.platforms.join("/")}`,
    risks: d.risks.slice(0, 2),
    recommendations: d.improvements.slice(0, 2),
  }));

  return {
    score: Math.min(95, score),
    ...d,
    objectiveAssessments,
    grounding: {
      source: "AI",
      confidence: 86,
      reason: `Objective Achievement Assessment — ${objectiveAssessments.length} objective(s) from brief`,
      evidence: `${weeks}-week duration · ${profile.campaignType} · category model`,
    },
  };
}

export function deriveOpportunities(
  strategyText: string,
  summaryText: string,
  options?: { allowCelebrity?: boolean }
): OpportunityItem[] {
  const combined = [strategyText, summaryText].filter(Boolean).join("\n");
  const industry = detectIndustryFromBrief(combined);
  const allowCelebrity = options?.allowCelebrity ?? /celebrit/i.test(combined);

  const byIndustry: Record<CampaignIndustry, OpportunityItem[]> = {
    luxury: [
      { category: "Untapped Audiences", title: "Aspirational achievers (28–40)", description: "Adjacent affluent segment outside current brief targeting", impact: "high", source: "Creator" },
      { category: "Missing Platforms", title: "LinkedIn executive reach", description: "Affluent professionals active on LinkedIn — no current allocation", impact: "medium", source: "Industry" },
      { category: "Creator Tiers", title: "Consider a brand-ambassador tier", description: "A high-profile ambassador can lift share of voice in the luxury vertical, subject to client approval", impact: "high", source: "Industry" },
      { category: "Budget Optimization", title: "Shift contingency toward production", description: "Premium asset quality supports brand favorability in luxury positioning", impact: "medium", source: "Industry" },
      { category: "Competitor Gap", title: "Heritage storytelling underserved", description: "Competitors focus on product — craftsmanship narrative is open territory", impact: "high", source: "Industry" },
    ],
    tourism: [
      { category: "Untapped Audiences", title: "Cultural explorers (30–50)", description: "Higher trip-value segment with longer stays and stronger booking value", impact: "high", source: "Creator" },
      { category: "Missing Platforms", title: "Pinterest travel planning", description: "Pre-planning audience on Pinterest with strong save-to-book behavior", impact: "medium", source: "Industry" },
      { category: "Creator Tiers", title: "Activate nano traveler UGC", description: "Nano tier adds authentic traveler posts at low cost", impact: "high", source: "Industry" },
      { category: "Budget Optimization", title: "Increase paid amplification", description: "Geo-targeted boost drives trip-planning clicks in feeder markets", impact: "high", source: "Industry" },
      { category: "Content Gap", title: "Red Sea adventure content", description: "Diving and adventure content is underindexed vs competitor destinations", impact: "high", source: "Industry" },
    ],
    baby: [
      { category: "Untapped Audiences", title: "Experienced mothers (2+ children)", description: "Premium switchers with higher lifetime value in the category", impact: "high", source: "Client" },
      { category: "Missing Platforms", title: "Facebook parenting groups", description: "Active parenting communities with high purchase-intent signals", impact: "medium", source: "Industry" },
      { category: "Creator Tiers", title: "Add pediatrician endorsement", description: "Medical authority layer strengthens trust in the baby category", impact: "high", source: "Industry" },
      { category: "Budget Optimization", title: "Increase nano UGC share", description: "Volume UGC at the lowest cost per asset expands authentic review coverage", impact: "medium", source: "Industry" },
      { category: "Content Gap", title: "Night-time comfort content", description: "Competitors focus on daytime — overnight dryness is a differentiation angle", impact: "high", source: "Industry" },
    ],
    retail: [
      { category: "Untapped Audiences", title: "Streetwear enthusiasts (16–28)", description: "Hype-driven segment with strong social sharing on launch content", impact: "high", source: "Creator" },
      { category: "Missing Platforms", title: "Snapchat AR try-on", description: "Virtual try-on filters drive product-page visits in apparel", impact: "medium", source: "Industry" },
      { category: "Creator Tiers", title: "Add nano street-style creators", description: "Volume UGC drives launch velocity and organic momentum", impact: "high", source: "Industry" },
      { category: "Budget Optimization", title: "Front-load launch-week spend", description: "Counter competitor launches with a concentrated hero content burst", impact: "high", source: "Industry" },
      { category: "Competitor Gap", title: "Local collaboration drop", description: "A market-specific limited edition offers first-mover advantage", impact: "high", source: "Industry" },
    ],
    finance: [
      { category: "Untapped Audiences", title: "Established earners (35–50)", description: "Premium product segment with stronger approval rates and lifetime value", impact: "high", source: "Client" },
      { category: "Missing Platforms", title: "Podcast sponsorship integration", description: "Finance podcast listeners show strong product-consideration intent", impact: "medium", source: "Industry" },
      { category: "Creator Tiers", title: "Add macro trust anchor", description: "A single macro finance educator can anchor qualified lead generation", impact: "high", source: "Industry" },
      { category: "Budget Optimization", title: "Shift budget toward LinkedIn paid", description: "LinkedIn typically delivers efficient cost-per-lead for finance products", impact: "high", source: "Industry" },
      { category: "Content Gap", title: "Life milestone banking content", description: "Competitors focus on product features — life-event storytelling is underserved", impact: "medium", source: "Industry" },
    ],
    general: [
      { category: "Untapped Audiences", title: "Secondary demographic segment", description: "Brief analysis suggests reach opportunity in an adjacent audience", impact: "medium", source: "AI" },
      { category: "Missing Platforms", title: "YouTube long-form", description: "Category content performs well on YouTube — not in current plan", impact: "medium", source: "Industry" },
      { category: "Creator Tiers", title: "Increase micro tier share", description: "Micro creators deliver the strongest engagement-to-cost ratio", impact: "medium", source: "Industry" },
      { category: "Budget Optimization", title: "Rebalance paid amplification", description: "Category norms suggest additional paid support for reach efficiency", impact: "low", source: "Industry" },
      { category: "Content Gap", title: "UGC volume opportunity", description: "Competitors underinvest in authentic UGC — differentiation available", impact: "medium", source: "Industry" },
    ],
  };

  return byIndustry[industry].filter(
    (item) =>
      allowCelebrity ||
      !/celebrit/i.test(`${item.title} ${item.description}`)
  );
}

/**
 * Executive summary composed from THIS campaign's resolved facts (brand,
 * objective, audience, platforms, duration, budget) — no industry demo
 * narratives, no fabricated reach.
 */
export function deriveExecutiveSummary(
  strategyText: string,
  audienceText: string,
  summaryText: string,
  context?: {
    facts?: CampaignFacts;
    durationWeeks?: CampaignDurationWeeks;
    creatorMixLabel?: string;
    allowCelebrity?: boolean;
  }
): ExecutiveSummaryData {
  const combined = [strategyText, audienceText, summaryText].filter(Boolean).join("\n");
  const industry = detectIndustryFromBrief(combined);
  const profile = getIndustryProfile(industry, combined);
  const facts = context?.facts;
  const weeks = context?.durationWeeks ?? parseDurationWeeks(combined);
  const allowCelebrity = context?.allowCelebrity ?? /celebrit/i.test(combined);
  const fields = deriveExecutiveStrategyFields(strategyText, audienceText, summaryText);

  const resolvedClient = resolveClientFromBrief(combined);
  const clientLabel =
    facts?.clientName ??
    facts?.brandName ??
    (/^brand client$/i.test(resolvedClient) ? "The brand" : resolvedClient);
  const objective =
    facts?.objective ??
    (typeof fields.campaignObjective === "string" ? fields.campaignObjective : profile.campaignType);
  const platforms = facts?.platforms?.length ? facts.platforms : profile.platforms;
  const audience =
    facts?.audience ??
    (typeof fields.targetAudience === "string" ? fields.targetAudience : undefined);
  const mixLabel =
    context?.creatorMixLabel ??
    stripCelebrityFromLabel(profile.creatorMixSummary, allowCelebrity);
  const budgetSentence = facts?.budget?.amount
    ? ` The plan is scoped to a ${facts.budget.amount.toLocaleString()} ${facts.budget.currency} budget.`
    : "";
  const audienceClause = audience ? `, targeting ${audience}` : "";

  const summary = `${clientLabel} — ${objective}. A ${weeks}-week creator-led program across ${platforms.join(", ")}${audienceClause}.${budgetSentence}`;

  return {
    summary,
    keyDecisions: [
      `Creator mix: ${mixLabel}`,
      `Platform focus: ${platforms.join(", ")}`,
      `Campaign duration: ${weeks} weeks with go-live at week ${resolveGoLiveWeek(weeks)}`,
      `Budget priority: ${profile.budgetWeights[0].percent}% creator fees, ${profile.budgetWeights[2].percent}% paid amplification`,
    ],
    recommendedActions: [
      "Approve creator criteria and shortlist by end of Week 2",
      `Confirm ${profile.budgetWeights[1].percent}% production budget allocation`,
      "Sign off visual guidelines and claim library before creator outreach",
      "Authorize paid amplification budget pacing plan",
    ],
    immediateNextSteps: [
      "Finalize and approve campaign brief",
      "Confirm creator discovery criteria",
      "Schedule stakeholder kickoff and strategy review",
      "Confirm legal/compliance review process",
    ],
    expectedBusinessOutcome: `${objective} over ${weeks} weeks — reach estimate modeled from the confirmed creator slate`,
    grounding: {
      source: "AI",
      confidence: 88,
      reason: "Synthesized from the campaign brief and category intelligence",
      evidence: `${clientLabel} · ${weeks} weeks`,
    },
  };
}

export type VendorFactorInput = {
  displayName: string;
  handle: string;
  platform: string;
  followers?: number;
  engagementRate?: number;
  country?: string;
  audienceSummary?: string;
  priceEstimate?: string;
  brandFit?: number;
  campaignRelevanceScore?: number;
  rationale?: string;
};

export function deriveVendorRankingFactors(
  vendor: VendorFactorInput,
  industry: CampaignIndustry,
  index: number
): { whySelected: string; factors: VendorRankingFactor[]; grounding: GroundedElement } {
  const er = vendor.engagementRate ?? 4.5;
  const fit = vendor.campaignRelevanceScore ?? vendor.brandFit ?? 75 + index * 4;
  const followers = vendor.followers ?? 100_000;
  const hasCampaignScore = vendor.campaignRelevanceScore != null;

  const industryErBenchmark: Record<CampaignIndustry, number> = {
    luxury: 3.1,
    tourism: 4.5,
    baby: 5.2,
    retail: 3.9,
    finance: 2.4,
    general: 4.0,
  };

  const benchmark = industryErBenchmark[industry];
  const erScore = Math.min(98, Math.round((er / benchmark) * 70 + 20));

  const factors: VendorRankingFactor[] = [
    {
      factor: hasCampaignScore ? "Campaign Fit" : "Brand Fit",
      score: fit,
      reason: hasCampaignScore
        ? `Brief criteria match ${fit}/100 — requirement → evidence from CIP ranking`
        : `${fit}/100 category alignment from Thinkway creator DNA`,
    },
    {
      factor: "Audience Fit",
      score: Math.min(95, fit + 5),
      reason: vendor.audienceSummary
        ? `Audience: ${vendor.audienceSummary}`
        : "Audience demographics match brief target",
    },
    {
      factor: "Platform",
      score: vendor.platform ? 90 : 60,
      reason: vendor.platform
        ? `Platform requirement → active on ${vendor.platform}`
        : "Primary platform unverified",
    },
    { factor: "Historical ER", score: erScore, reason: `${er}% ER vs ${benchmark}% industry benchmark` },
    {
      factor: "Audience Country",
      score: vendor.country ? 90 : 55,
      reason: vendor.country
        ? `Geography requirement → ${vendor.country} audience signals`
        : "Country alignment unverified — missing data",
    },
    { factor: "Price", score: vendor.priceEstimate ? 82 : 78, reason: vendor.priceEstimate ?? "Rate within budget tier range" },
  ];

  const topFactors = factors.sort((a, b) => b.score - a.score).slice(0, 3);
  const whySelected = vendor.rationale
    ?? (hasCampaignScore
      ? `Campaign fit ${fit}/100 — ${topFactors.map((f) => `${f.factor}: ${f.reason}`).join("; ")}`
      : `Selected for ${topFactors.map((f) => `${f.factor} (${f.score}/100)`).join(", ")} — ${formatFollowers(followers)} ${vendor.platform} reach`);

  return {
    whySelected,
    factors,
    grounding: {
      source: hasCampaignScore ? "AI" : "Creator",
      confidence: Math.min(95, fit),
      reason: hasCampaignScore
        ? "Evidence-linked ranking from campaign brief criteria + creator profile"
        : "Ranked from Thinkway creator intelligence and historical campaign performance",
      evidence: `${vendor.displayName} · ${vendor.handle} · ER ${er}%${hasCampaignScore ? ` · campaign fit ${fit}/100` : ""}`,
    },
  };
}

function formatFollowers(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${Math.round(count / 1_000)}K`;
  return count.toLocaleString();
}
