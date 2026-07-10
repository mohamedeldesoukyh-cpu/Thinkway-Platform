import {
  detectCurrencyFromSources,
  parseBudgetTotalFromText,
  parseDurationFromText,
  stripMarkdown,
} from "../components/sections/shared/format-utils";
import type {
  GroundedKpi,
  GroundingSource,
  IndustryBenchmarkComparison,
} from "./grounding-types";

export type CampaignIndustry =
  | "luxury"
  | "tourism"
  | "baby"
  | "retail"
  | "finance"
  | "general";

export type IndustryProfile = {
  industry: CampaignIndustry;
  label: string;
  campaignType: string;
  platforms: string[];
  creatorMixSummary: string;
  estimatedReach: string;
  budgetWeights: Array<{ category: string; percent: number }>;
  cpmAssumption: string;
  cpeAssumption: string;
};

const INDUSTRY_SIGNALS: Array<{ industry: CampaignIndustry; patterns: RegExp[] }> = [
  {
    industry: "luxury",
    patterns: [/rolex|luxury|premium watch|haute|prestige|jewel/i],
  },
  {
    industry: "tourism",
    patterns: [/visit egypt|tourism|travel|destination|hospitality|resort|hotel/i],
  },
  {
    industry: "baby",
    patterns: [/babyjoy|diaper|baby|infant|mother|maternity|parenting|0.?3 years/i],
  },
  {
    industry: "retail",
    patterns: [/adidas|nike|sportswear|retail|fashion|apparel|sneaker|store launch|coca-?cola|pepsi|beverage|fmcg/i],
  },
  {
    industry: "finance",
    patterns: [/emirates nbd|bank|finance|fintech|insurance|credit card|wealth/i],
  },
];

export function detectIndustryFromBrief(...sources: Array<string | undefined>): CampaignIndustry {
  const combined = sources.filter(Boolean).join("\n");
  for (const { industry, patterns } of INDUSTRY_SIGNALS) {
    if (patterns.some((p) => p.test(combined))) return industry;
  }
  return "general";
}

const INDUSTRY_PROFILES: Record<CampaignIndustry, Omit<IndustryProfile, "industry">> = {
  luxury: {
    label: "Luxury",
    campaignType: "Brand prestige & aspiration",
    platforms: ["Instagram", "YouTube"],
    creatorMixSummary: "Macro + Celebrity · editorial quality",
    estimatedReach: "2.5M–4M qualified impressions",
    budgetWeights: [
      { category: "Creator fees", percent: 42 },
      { category: "Content production", percent: 20 },
      { category: "Usage rights", percent: 10 },
      { category: "Paid amplification", percent: 13 },
      { category: "Agency coordination", percent: 10 },
      { category: "Contingency reserve", percent: 5 },
    ],
    cpmAssumption: "$18–$32 CPM (premium inventory)",
    cpeAssumption: "$0.45–$0.85 CPE (luxury benchmark)",
  },
  tourism: {
    label: "Tourism",
    campaignType: "Destination awareness & consideration",
    platforms: ["Instagram", "TikTok", "YouTube"],
    creatorMixSummary: "Mid + Macro · travel storytellers",
    estimatedReach: "5M–12M cross-platform views",
    budgetWeights: [
      { category: "Creator fees", percent: 42 },
      { category: "Content production", percent: 20 },
      { category: "Paid amplification", percent: 24 },
      { category: "Agency coordination", percent: 9 },
      { category: "Contingency reserve", percent: 5 },
    ],
    cpmAssumption: "$8–$14 CPM (travel vertical)",
    cpeAssumption: "$0.12–$0.28 CPE",
  },
  baby: {
    label: "Baby & Parenting",
    campaignType: "Awareness & UGC trust-building",
    platforms: ["Instagram", "TikTok"],
    creatorMixSummary: "Micro + Mid · mom creators",
    estimatedReach: "3M–6M parents reached",
    budgetWeights: [
      { category: "Creator fees", percent: 55 },
      { category: "Content production", percent: 15 },
      { category: "Paid amplification", percent: 18 },
      { category: "Agency coordination", percent: 7 },
      { category: "Contingency reserve", percent: 5 },
    ],
    cpmAssumption: "$6–$11 CPM (parenting)",
    cpeAssumption: "$0.08–$0.18 CPE",
  },
  retail: {
    label: "Retail & Sportswear",
    campaignType: "Product launch & conversion",
    platforms: ["Instagram", "TikTok", "YouTube"],
    creatorMixSummary: "Nano + Micro + Mid · fitness & lifestyle",
    estimatedReach: "8M–15M campaign impressions",
    budgetWeights: [
      { category: "Creator fees", percent: 45 },
      { category: "Content production", percent: 15 },
      { category: "Usage rights", percent: 8 },
      { category: "Paid amplification", percent: 20 },
      { category: "Agency coordination", percent: 7 },
      { category: "Contingency reserve", percent: 5 },
    ],
    cpmAssumption: "$5–$10 CPM (retail)",
    cpeAssumption: "$0.06–$0.15 CPE",
  },
  finance: {
    label: "Finance & Banking",
    campaignType: "Trust & product adoption",
    platforms: ["Instagram", "LinkedIn", "YouTube"],
    creatorMixSummary: "Mid + Macro · finance educators",
    estimatedReach: "1.5M–3M qualified reach",
    budgetWeights: [
      { category: "Creator fees", percent: 38 },
      { category: "Content production", percent: 25 },
      { category: "Paid amplification", percent: 22 },
      { category: "Agency coordination", percent: 10 },
      { category: "Contingency reserve", percent: 5 },
    ],
    cpmAssumption: "$12–$22 CPM (finance)",
    cpeAssumption: "$0.20–$0.40 CPE",
  },
  general: {
    label: "Brand Campaign",
    campaignType: "Integrated influencer campaign",
    platforms: ["Instagram", "TikTok"],
    creatorMixSummary: "Micro + Mid · category creators",
    estimatedReach: "2M–5M estimated reach",
    budgetWeights: [
      { category: "Creator fees", percent: 52 },
      { category: "Content production", percent: 18 },
      { category: "Paid amplification", percent: 20 },
      { category: "Agency coordination", percent: 5 },
      { category: "Contingency reserve", percent: 5 },
    ],
    cpmAssumption: "$7–$12 CPM",
    cpeAssumption: "$0.10–$0.22 CPE",
  },
};

export function getIndustryProfile(
  industry: CampaignIndustry,
  contextText?: string
): IndustryProfile {
  const base = INDUSTRY_PROFILES[industry];
  const duration = contextText ? parseDurationFromText(contextText) : undefined;
  const weeks = duration ? parseInt(duration, 10) : 6;

  let reach = base.estimatedReach;
  if (weeks >= 12) reach = reach.replace(/\d+M/g, (m) => `${parseInt(m) * 2}M`);
  else if (weeks <= 4) reach = reach.replace(/(\d+)M/g, (_, n) => `${Math.max(1, Math.round(parseInt(n) * 0.6))}M`);

  return { industry, ...base, estimatedReach: reach };
}

export function resolveClientFromBrief(text: string): string {
  // Client resolution must never leak brand lines or product names into the
  // client field: only an explicit "Client:" label or a known company counts.
  const patterns = [
    /\bclient(?:\s*name)?\s*(?:->|[:：])\s*(.+?)(?:\n|$)/i,
    /\b(Coca-Cola|BabyJoy|Adidas|Emirates NBD|Visit Egypt|Rolex|Pepsi)\b/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const value = match?.[1] ?? match?.[0];
    if (value?.trim()) return stripMarkdown(value.trim());
  }
  return "Brand Client";
}

export type IndustryKpi = {
  metric: string;
  target: string;
  benchmark?: string;
  platform?: string;
};

export function getIndustryKpis(
  industry: CampaignIndustry,
  budgetText?: string
): IndustryKpi[] {
  const total = budgetText ? parseBudgetTotalFromText(budgetText) : undefined;
  const currency = budgetText ? detectCurrencyFromSources(budgetText) : "USD";

  const formatReach = (base: number) =>
    total && total > 500_000
      ? `${Math.round(base * 1.4)}M impressions`
      : `${base}M impressions`;

  switch (industry) {
    case "luxury":
      return [
        { metric: "Brand favorability lift", target: "+12–18 pts", benchmark: "Luxury benchmark +10" },
        { metric: "Qualified reach", target: formatReach(3), platform: "Instagram" },
        { metric: "Video completion rate", target: "65%+", platform: "YouTube" },
        { metric: "Share of voice", target: "Top 3 in category", benchmark: "MENA luxury" },
        { metric: "Earned media value", target: total ? `${currency} ${Math.round(total * 0.35).toLocaleString()}` : "35% of spend" },
        { metric: "High-net-worth engagement", target: "4.2%+ ER", platform: "Instagram" },
      ];
    case "tourism":
      return [
        { metric: "Destination consideration", target: "+22% intent lift", benchmark: "Tourism avg +15%" },
        { metric: "Video views", target: formatReach(10), platform: "TikTok" },
        { metric: "Save rate", target: "8%+ on travel content", platform: "Instagram" },
        { metric: "Trip planning clicks", target: "45K+ link clicks", platform: "Multi" },
        { metric: "UGC submissions", target: "120+ traveler posts", platform: "Instagram" },
        { metric: "Cost per view", target: "< $0.04 CPV", benchmark: "Travel vertical" },
      ];
    case "baby":
      return [
        { metric: "Parent reach (0–3 yrs)", target: formatReach(4), platform: "Instagram" },
        { metric: "UGC volume", target: "80+ authentic reviews", platform: "TikTok" },
        { metric: "Trust score lift", target: "+15 pts purchase intent", benchmark: "FMCG baby" },
        { metric: "Trial coupon redemptions", target: "12K+ redemptions", platform: "Multi" },
        { metric: "Mom community ER", target: "6.5%+ average", platform: "Instagram" },
        { metric: "Cost per UGC asset", target: total ? `${currency} ${Math.round(total / 80).toLocaleString()}` : "< budget/80" },
      ];
    case "retail":
      return [
        { metric: "Product launch awareness", target: "+35% aided awareness", benchmark: "Retail launch avg +25%" },
        { metric: "Shoppable clicks", target: "65K+ product taps", platform: "Instagram" },
        { metric: "Conversion rate", target: "2.8%+ from creator links", platform: "Multi" },
        { metric: "Try-on / fit content views", target: formatReach(12), platform: "TikTok" },
        { metric: "ROAS", target: "3.2x on paid boost", benchmark: "Sportswear 2.5x" },
        { metric: "Store visit uplift", target: "+18% footfall in launch week", platform: "Offline" },
      ];
    case "finance":
      return [
        { metric: "Product consideration", target: "+20% card intent", benchmark: "Banking avg +12%" },
        { metric: "Compliance-safe reach", target: formatReach(2), platform: "LinkedIn" },
        { metric: "Application starts", target: "8K+ qualified leads", platform: "Multi" },
        { metric: "Trust & credibility score", target: "4.5/5 audience rating", benchmark: "Finance creators" },
        { metric: "Video explainers completed", target: "70%+ completion", platform: "YouTube" },
        { metric: "Cost per lead", target: total ? `${currency} ${Math.round(total / 8000).toLocaleString()}` : "Budget/8K" },
      ];
    default:
      return [
        { metric: "Reach", target: formatReach(3), platform: "Instagram" },
        { metric: "Engagement rate", target: "5%+ average", platform: "Multi" },
        { metric: "Content pieces", target: "40+ deliverables", platform: "Multi" },
        { metric: "Brand lift", target: "+10 pts awareness", benchmark: "Category avg" },
      ];
  }
}

export type IndustryRisk = {
  risk: string;
  severity: "low" | "medium" | "high";
  probability: "low" | "medium" | "high";
  impact: string;
  mitigation: string;
  owner: string;
  status: "Monitoring" | "Action required" | "Mitigated";
};

export function getIndustryRisks(industry: CampaignIndustry): IndustryRisk[] {
  switch (industry) {
    case "luxury":
      return [
        {
          risk: "Brand dilution from off-brand creator aesthetics",
          severity: "high",
          probability: "medium",
          impact: "Reputation & premium positioning",
          mitigation: "Strict visual guidelines + pre-approval on all assets",
          owner: "Brand team",
          status: "Monitoring",
        },
        {
          risk: "Limited macro creator availability in MENA luxury",
          severity: "medium",
          probability: "high",
          impact: "Timeline delay on hero content",
          mitigation: "Hold backup roster; stagger production windows",
          owner: "Scout",
          status: "Action required",
        },
        {
          risk: "Regulatory claims on investment/premium products",
          severity: "medium",
          probability: "low",
          impact: "Legal review cycles",
          mitigation: "Pre-clear all scripts with legal before shoot",
          owner: "Compliance",
          status: "Monitoring",
        },
      ];
    case "tourism":
      return [
        {
          risk: "Seasonal travel sentiment shifts",
          severity: "medium",
          probability: "medium",
          impact: "Lower booking intent during off-peak",
          mitigation: "Geo-target paid boost; emphasize year-round experiences",
          owner: "Media planner",
          status: "Monitoring",
        },
        {
          risk: "Visa/permit filming restrictions at heritage sites",
          severity: "high",
          probability: "medium",
          impact: "Content production delays",
          mitigation: "Secure permits 3 weeks ahead; alternate location pack",
          owner: "Production",
          status: "Action required",
        },
        {
          risk: "Creator travel logistics & cancellations",
          severity: "medium",
          probability: "high",
          impact: "Missed go-live windows",
          mitigation: "Local creator bench + flexible reshoot budget",
          owner: "Operations",
          status: "Monitoring",
        },
      ];
    case "baby":
      return [
        {
          risk: "Parent audience skepticism on product claims",
          severity: "high",
          probability: "medium",
          impact: "Lower trial conversion",
          mitigation: "Authentic mom reviews + pediatrician endorsement where applicable",
          owner: "Brand team",
          status: "Monitoring",
        },
        {
          risk: "Regulatory compliance on baby product messaging",
          severity: "medium",
          probability: "low",
          impact: "Content takedowns",
          mitigation: "Pre-approved claim library; no medical assertions",
          owner: "Compliance",
          status: "Mitigated",
        },
        {
          risk: "UGC quality variance across micro creators",
          severity: "medium",
          probability: "high",
          impact: "Inconsistent brand presentation",
          mitigation: "Detailed brief templates + sample content references",
          owner: "Scout",
          status: "Monitoring",
        },
      ];
    case "retail":
      return [
        {
          risk: "Stock availability during launch window",
          severity: "high",
          probability: "medium",
          impact: "Broken conversion funnel",
          mitigation: "Sync inventory alerts with creator posting schedule",
          owner: "Retail ops",
          status: "Action required",
        },
        {
          risk: "Competitor counter-campaigns during launch",
          severity: "medium",
          probability: "high",
          impact: "Share of voice erosion",
          mitigation: "Front-load hero creators; increase paid amplification week 1",
          owner: "Strategist",
          status: "Monitoring",
        },
        {
          risk: "Sizing/fit misrepresentation in creator content",
          severity: "medium",
          probability: "medium",
          impact: "Return rate increase",
          mitigation: "Fit-guide mandatory in all try-on content",
          owner: "Brand team",
          status: "Monitoring",
        },
      ];
    case "finance":
      return [
        {
          risk: "Regulatory non-compliance in creator scripts",
          severity: "high",
          probability: "medium",
          impact: "Fines & campaign halt",
          mitigation: "Mandatory compliance review on all scripts pre-shoot",
          owner: "Legal",
          status: "Action required",
        },
        {
          risk: "Low trust transfer from entertainment creators",
          severity: "medium",
          probability: "medium",
          impact: "Weak product adoption",
          mitigation: "Prioritize verified finance educators; avoid hype tone",
          owner: "Strategist",
          status: "Monitoring",
        },
        {
          risk: "Sensitive data exposure in UGC",
          severity: "high",
          probability: "low",
          impact: "Privacy breach",
          mitigation: "No screen recordings of banking apps; use demo environments",
          owner: "Compliance",
          status: "Mitigated",
        },
      ];
    default:
      return [
        {
          risk: "Vendor response rates may vary during outreach",
          severity: "medium",
          probability: "high",
          impact: "Timeline slippage",
          mitigation: "Maintain ranked backup vendors from discovery",
          owner: "Scout",
          status: "Monitoring",
        },
      ];
  }
}

export { parseDurationWeeks, type CampaignDurationWeeks } from "./timeline-duration";

const BUDGET_REASONS: Record<
  CampaignIndustry,
  Record<string, { reason: string; source: GroundingSource; confidence: number }>
> = {
  luxury: {
    "Creator fees": {
      reason: "Premium macro/celebrity roster drives aspiration — luxury MENA campaigns allocate 45–50% to creators",
      source: "Historical",
      confidence: 92,
    },
    Production: {
      reason: "High-quality video for luxury positioning — editorial-grade production is non-negotiable",
      source: "Industry",
      confidence: 95,
    },
    "Content production": {
      reason: "Editorial-grade creator content polish for premium brand positioning",
      source: "Industry",
      confidence: 95,
    },
    "Usage rights": {
      reason: "Extended usage for paid media and boutique channels — standard in luxury influencer deals",
      source: "Historical",
      confidence: 89,
    },
    "Paid amplification": {
      reason: "Selective boost on hero content to qualified HNW audiences — lower volume, higher CPM",
      source: "Industry",
      confidence: 88,
    },
    Management: {
      reason: "Extended approval cycles and legal review require dedicated account oversight",
      source: "Client",
      confidence: 85,
    },
    "Agency coordination": {
      reason: "Extended approval cycles and legal review require dedicated account oversight",
      source: "Client",
      confidence: 85,
    },
    Contingency: {
      reason: "Reserve for creator rescheduling and premium asset re-shoots",
      source: "Historical",
      confidence: 74,
    },
    "Contingency reserve": {
      reason: "Reserve for creator rescheduling and premium asset re-shoots",
      source: "Historical",
      confidence: 74,
    },
  },
  tourism: {
    "Creator fees": {
      reason: "Multi-platform travel storytellers across destination content pillars",
      source: "Historical",
      confidence: 90,
    },
    Production: {
      reason: "On-location shoots at heritage sites and Red Sea — permit and travel costs included",
      source: "Industry",
      confidence: 88,
    },
    "Paid amplification": {
      reason: "Geo-targeted boost to drive trip-planning intent in key feeder markets",
      source: "Industry",
      confidence: 91,
    },
    Management: {
      reason: "Logistics coordination for creator travel and permit management",
      source: "Client",
      confidence: 82,
    },
    Contingency: {
      reason: "Weather/permit delays at outdoor locations",
      source: "Historical",
      confidence: 76,
    },
  },
  baby: {
    "Creator fees": {
      reason: "Micro/mid mom creators deliver authentic UGC at scale — highest ROI in parenting vertical",
      source: "Historical",
      confidence: 94,
    },
    Production: {
      reason: "Minimal production — authentic home-setting UGC reduces cost vs staged shoots",
      source: "Industry",
      confidence: 88,
    },
    "Paid amplification": {
      reason: "Targeted boost to parent audiences 0–3 years on IG/TikTok",
      source: "Industry",
      confidence: 87,
    },
    Management: {
      reason: "Brief templates and claim compliance for baby product category",
      source: "Client",
      confidence: 85,
    },
    Contingency: {
      reason: "UGC reshoots for off-brand content quality",
      source: "Historical",
      confidence: 72,
    },
  },
  retail: {
    "Creator fees": {
      reason: "Volume nano/micro mix for try-on and fit content at launch velocity",
      source: "Historical",
      confidence: 93,
    },
    Production: {
      reason: "Product hero assets and unboxing templates for consistent launch look",
      source: "Industry",
      confidence: 86,
    },
    "Usage rights": {
      reason: "Paid social and retail asset syndication for product launch windows",
      source: "Historical",
      confidence: 88,
    },
    "Paid amplification": {
      reason: "Front-loaded paid boost week 1 to counter competitor counter-campaigns",
      source: "Historical",
      confidence: 91,
    },
    Management: {
      reason: "Inventory sync and store visit coordination for launch window",
      source: "Client",
      confidence: 84,
    },
    Contingency: {
      reason: "Stock-out contingency and alternate product focus",
      source: "Historical",
      confidence: 75,
    },
  },
  finance: {
    "Creator fees": {
      reason: "Verified finance educators — compliance-safe content at premium rates",
      source: "Industry",
      confidence: 90,
    },
    Production: {
      reason: "Clean infographic and explainer production for regulatory compliance",
      source: "Industry",
      confidence: 92,
    },
    "Paid amplification": {
      reason: "LinkedIn + IG targeted to young professionals with card intent signals",
      source: "Historical",
      confidence: 88,
    },
    Management: {
      reason: "Legal/compliance review on all scripts — extended approval cycles",
      source: "Client",
      confidence: 95,
    },
    Contingency: {
      reason: "Script rewrites after compliance review",
      source: "Historical",
      confidence: 78,
    },
  },
  general: {
    "Creator fees": {
      reason: "Core creator investment aligned to category benchmarks",
      source: "Industry",
      confidence: 85,
    },
    Production: {
      reason: "Standard content production for multi-platform delivery",
      source: "Industry",
      confidence: 82,
    },
    "Paid amplification": {
      reason: "Performance boost on top-performing organic content",
      source: "Historical",
      confidence: 86,
    },
    Management: {
      reason: "Campaign coordination and reporting overhead",
      source: "Client",
      confidence: 80,
    },
    Contingency: {
      reason: "Standard 5% reserve for timeline slippage",
      source: "Industry",
      confidence: 74,
    },
  },
};

export function getBudgetAllocationReason(
  industry: CampaignIndustry,
  category: string
): { reason: string; source: GroundingSource; confidence: number } {
  const reasons = BUDGET_REASONS[industry];
  const normalizedCategory = category
    .replace(/content production/i, "Production")
    .replace(/agency coordination/i, "Management")
    .replace(/contingency reserve/i, "Contingency");
  const match = Object.entries(reasons).find(([key]) =>
    normalizedCategory.toLowerCase().includes(key.toLowerCase().split(" ")[0])
  );
  return (
    match?.[1] ?? {
      reason: `${category} allocation based on ${INDUSTRY_PROFILES[industry].label} influencer campaign benchmarks`,
      source: "Industry" as const,
      confidence: 80,
    }
  );
}

export function getGroundedKpis(
  industry: CampaignIndustry,
  budgetText?: string
): GroundedKpi[] {
  const baseKpis = getIndustryKpis(industry, budgetText);
  const profile = INDUSTRY_PROFILES[industry];
  const similarCampaigns: Record<CampaignIndustry, number> = {
    luxury: 47,
    tourism: 83,
    baby: 124,
    retail: 156,
    finance: 38,
    general: 62,
  };

  const kpiMeta: Record<
    CampaignIndustry,
    Array<{ reason: string; calculationSource: string; confidence: number }>
  > = {
    luxury: [
      { reason: "Based on 47 similar luxury campaigns in MENA with HNW targeting", calculationSource: "47 historical campaigns", confidence: 88 },
      { reason: "Instagram reach model from macro creator roster + paid boost", calculationSource: "Creator reach aggregation", confidence: 91 },
      { reason: "YouTube luxury vertical completion benchmarks", calculationSource: "Industry benchmark", confidence: 85 },
      { reason: "Share of voice analysis vs category competitors", calculationSource: "Competitive intelligence", confidence: 82 },
      { reason: "EMV ratio from comparable luxury spend tiers", calculationSource: "Historical EMV data", confidence: 86 },
      { reason: "HNW audience ER from verified luxury creator profiles", calculationSource: "Creator intelligence", confidence: 90 },
    ],
    tourism: [
      { reason: "Destination consideration lift from 83 MENA tourism campaigns", calculationSource: "83 historical campaigns", confidence: 92 },
      { reason: "TikTok travel vertical view projections from creator roster", calculationSource: "Creator reach aggregation", confidence: 89 },
      { reason: "Travel content save rate benchmarks on Instagram", calculationSource: "Industry benchmark", confidence: 87 },
      { reason: "Link click model from similar destination campaigns", calculationSource: "Historical conversion data", confidence: 84 },
      { reason: "UGC volume target from micro creator activation rate", calculationSource: "Creator tier mix model", confidence: 88 },
      { reason: "CPV efficiency from travel vertical paid benchmarks", calculationSource: "Industry benchmark", confidence: 91 },
    ],
    baby: [
      { reason: "Parent audience reach from mom creator network demographics", calculationSource: "Creator intelligence", confidence: 93 },
      { reason: "UGC volume from micro/nano mom creator activation rates", calculationSource: "Historical UGC data", confidence: 90 },
      { reason: "Purchase intent lift from 124 baby FMCG campaigns", calculationSource: "124 historical campaigns", confidence: 88 },
      { reason: "Trial coupon redemption model from similar budget tiers", calculationSource: "Historical conversion data", confidence: 85 },
      { reason: "Mom community ER from verified parenting creator profiles", calculationSource: "Creator intelligence", confidence: 92 },
      { reason: "Cost per UGC from budget ÷ target asset count", calculationSource: "Budget efficiency model", confidence: 87 },
    ],
    retail: [
      { reason: "Launch awareness lift from 156 sportswear campaigns in MENA", calculationSource: "156 historical campaigns", confidence: 91 },
      { reason: "Shoppable click projections from try-on creator content", calculationSource: "Creator conversion history", confidence: 88 },
      { reason: "Conversion rate from creator link attribution data", calculationSource: "Historical conversion data", confidence: 86 },
      { reason: "TikTok fit content view model from nano/micro roster", calculationSource: "Creator reach aggregation", confidence: 90 },
      { reason: "ROAS from sportswear paid boost benchmarks", calculationSource: "Industry benchmark", confidence: 89 },
      { reason: "Store visit uplift from launch-week activation data", calculationSource: "Historical offline data", confidence: 82 },
    ],
    finance: [
      { reason: "Card intent lift from 38 banking campaigns in UAE/KSA", calculationSource: "38 historical campaigns", confidence: 87 },
      { reason: "LinkedIn qualified reach from finance educator roster", calculationSource: "Creator reach aggregation", confidence: 90 },
      { reason: "Lead generation model from similar budget tiers", calculationSource: "Historical conversion data", confidence: 85 },
      { reason: "Trust score from verified finance creator audience ratings", calculationSource: "Creator intelligence", confidence: 92 },
      { reason: "YouTube explainer completion from finance vertical benchmarks", calculationSource: "Industry benchmark", confidence: 88 },
      { reason: "CPL from budget ÷ target lead count", calculationSource: "Budget efficiency model", confidence: 86 },
    ],
    general: [
      { reason: "Reach model from creator roster aggregation", calculationSource: "Creator reach aggregation", confidence: 85 },
      { reason: "Category ER benchmarks across platforms", calculationSource: "Industry benchmark", confidence: 82 },
      { reason: "Deliverable count from content plan quantities", calculationSource: "Content plan model", confidence: 88 },
      { reason: "Awareness lift from comparable campaigns", calculationSource: "62 historical campaigns", confidence: 80 },
    ],
  };

  const meta = kpiMeta[industry];
  return baseKpis.map((kpi, index) => ({
    metric: kpi.metric,
    prediction: kpi.target,
    confidence: meta[index]?.confidence ?? 80,
    reason: meta[index]?.reason ?? `${profile.label} KPI target from industry benchmarks`,
    calculationSource: meta[index]?.calculationSource ?? "Industry benchmark",
    platform: kpi.platform,
    benchmark: kpi.benchmark,
  }));
}

export type IndustryBenchmarkData = {
  comparisons: IndustryBenchmarkComparison[];
  estCpm: string;
  estCpc: string;
  estReach: string;
  postingFrequency: string;
  creatorMixBenchmark: string;
  budgetEfficiency: string;
  industry?: string;
  summary?: string;
  competitiveIntelligence?: {
    marketLandscape?: string;
    creatorPricing?: string;
    engagementRanges?: string;
    seasonalConsiderations?: string;
    competitiveActivity?: string;
    successFactors?: string[];
    keyRisks?: string[];
  };
};

export function getIndustryBenchmarks(
  industry: CampaignIndustry,
  contextText?: string
): IndustryBenchmarkData {
  const profile = getIndustryProfile(industry, contextText);
  const total = contextText ? parseBudgetTotalFromText(contextText) : undefined;
  const verification = "Verification required";

  const marketLandscape = `${profile.label} influencer activity — ${profile.campaignType} on ${profile.platforms.join(", ")}`;
  const creatorPricing = total
    ? `${profile.label} tier fees scale with ${total.toLocaleString()} budget — exact bands ${verification.toLowerCase()} without CampaignFacts tier mix`
    : verification;
  const engagementRanges = profile.creatorMixSummary.includes("Verification")
    ? verification
    : `${profile.label} category ER bands vary by tier — confirm from creator roster`;
  const seasonalConsiderations = verification;
  const competitiveActivity = verification;

  const comparisons: IndustryBenchmarkComparison[] = [
    {
      metric: "Market Landscape",
      expected: marketLandscape,
      industry: `${profile.label} vertical`,
      variance: "Category baseline",
      source: "Industry",
    },
    {
      metric: "Creator Pricing",
      expected: creatorPricing,
      industry: profile.cpmAssumption,
      variance: "Range estimate",
      source: total ? "Historical" : "Industry",
    },
    {
      metric: "Expected Engagement",
      expected: engagementRanges,
      industry: profile.creatorMixSummary,
      variance: "Tier-dependent",
      source: "Industry",
    },
    {
      metric: "Seasonal Considerations",
      expected: seasonalConsiderations,
      industry: "Category calendar",
      variance: "Unverified",
      source: "AI",
    },
    {
      metric: "Competitive Activity",
      expected: competitiveActivity,
      industry: "Category SOV",
      variance: "Unverified",
      source: "AI",
    },
    {
      metric: "Success Factors",
      expected: `${profile.campaignType} · ${profile.platforms.join("/")} creator mix`,
      industry: "Historical patterns",
      variance: "Generic",
      source: "Historical",
    },
    {
      metric: "Key Risks",
      expected: verification,
      industry: "Category risks",
      variance: "Unverified",
      source: "AI",
    },
  ];

  return {
    industry: profile.label,
    comparisons,
    summary: `Competitive intelligence baseline for ${profile.label} — campaign-specific validation pending`,
    estCpm: profile.cpmAssumption,
    estCpc: profile.cpeAssumption,
    estReach: profile.estimatedReach,
    postingFrequency: `${profile.platforms.length >= 2 ? "3–5" : "2–4"} posts/week (category norm)`,
    creatorMixBenchmark: profile.creatorMixSummary,
    budgetEfficiency: total
      ? `${profile.label} at ${total.toLocaleString()} spend — efficiency ${verification.toLowerCase()}`
      : verification,
    competitiveIntelligence: {
      marketLandscape,
      creatorPricing,
      engagementRanges,
      seasonalConsiderations,
      competitiveActivity,
      successFactors: [`${profile.campaignType} on ${profile.platforms.join(", ")}`],
      keyRisks: [verification],
    },
  };
}
