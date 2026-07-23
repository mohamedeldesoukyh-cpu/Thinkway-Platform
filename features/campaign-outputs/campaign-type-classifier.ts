/**
 * Campaign Type Classifier — derives campaign archetype from brief, objective,
 * industry, and market. Drives creative direction tone, weekly objectives, and concepts.
 */

import { detectIndustryFromBrief } from "@/features/campaign-studio/services/industry-intelligence";

export type CampaignType =
  | "product_launch"
  | "brand_awareness"
  | "engagement"
  | "conversion"
  | "seasonal"
  | "ramadan"
  | "retail"
  | "food"
  | "fmcg"
  | "beauty"
  | "telecom"
  | "music"
  | "tourism"
  | "finance"
  | "general";

export type CampaignTypeClassification = {
  primary: CampaignType;
  secondary?: CampaignType;
  confidence: "high" | "medium" | "low";
  signals: string[];
  toneHint: string;
};

type ClassifierInput = {
  briefText: string;
  objective?: string;
  industry?: string;
  marketCountry?: string;
  season?: string;
};

const TYPE_PATTERNS: Array<{ type: CampaignType; patterns: RegExp[]; signal: string }> = [
  {
    type: "ramadan",
    patterns: [/\bramadan\b/i, /\biftar\b/i, /\bsuhoor\b/i, /\beid\b/i, /\bعيد\b/i, /\bرمضان\b/i],
    signal: "Ramadan / Eid cultural moment",
  },
  {
    type: "product_launch",
    patterns: [
      /\bproduct launch\b/i,
      /\bnew product\b/i,
      /\blaunch\b/i,
      /\bintroduc(e|ing)\b/i,
      /\bإطلاق\b/i,
    ],
    signal: "Product launch language",
  },
  {
    type: "conversion",
    patterns: [
      /\bconversion\b/i,
      /\bsales\b/i,
      /\bpurchase\b/i,
      /\bbuy now\b/i,
      /\bdrive revenue\b/i,
      /\bcheckout\b/i,
    ],
    signal: "Conversion / sales objective",
  },
  {
    type: "engagement",
    patterns: [
      /\bengagement\b/i,
      /\bcommunity\b/i,
      /\binteraction\b/i,
      /\bcomments?\b/i,
      /\bshares?\b/i,
    ],
    signal: "Engagement-focused objective",
  },
  {
    type: "brand_awareness",
    patterns: [
      /\bawareness\b/i,
      /\bbrand recall\b/i,
      /\bvisibility\b/i,
      /\breach\b/i,
      /\bconsideration\b/i,
    ],
    signal: "Awareness / reach objective",
  },
  {
    type: "seasonal",
    patterns: [
      /\bseasonal\b/i,
      /\bsummer\b/i,
      /\bwinter\b/i,
      /\bback to school\b/i,
      /\bholiday\b/i,
      /\bchristmas\b/i,
    ],
    signal: "Seasonal campaign timing",
  },
  {
    type: "food",
    patterns: [/\bfood\b/i, /\brestaurant\b/i, /\bcuisine\b/i, /\bsnack\b/i, /\brecipe\b/i, /\bchef\b/i],
    signal: "Food & beverage vertical",
  },
  {
    type: "fmcg",
    patterns: [/\bfmcg\b/i, /\bcpg\b/i, /\bgrocery\b/i, /\bsupermarket\b/i, /\bhousehold\b/i],
    signal: "FMCG / CPG vertical",
  },
  {
    type: "beauty",
    patterns: [/\bbeauty\b/i, /\bskincare\b/i, /\bmakeup\b/i, /\bcosmetic\b/i, /\bfragrance\b/i],
    signal: "Beauty vertical",
  },
  {
    type: "telecom",
    patterns: [/\btelecom\b/i, /\bmobile\b/i, /\b5g\b/i, /\bdata plan\b/i, /\boperator\b/i],
    signal: "Telecom vertical",
  },
  {
    type: "retail",
    patterns: [/\bretail\b/i, /\be-?commerce\b/i, /\bstore\b/i, /\bshop\b/i, /\bmall\b/i],
    signal: "Retail vertical",
  },
  {
    type: "music",
    patterns: [/\bmusic\b/i, /\bsong\b/i, /\btrack\b/i, /\balbum\b/i, /\bartist\b/i],
    signal: "Music / entertainment vertical",
  },
  {
    type: "tourism",
    patterns: [/\btourism\b/i, /\btravel\b/i, /\bdestination\b/i, /\bhotel\b/i, /\bresort\b/i],
    signal: "Tourism vertical",
  },
  {
    type: "finance",
    patterns: [/\bbank\b/i, /\binsurance\b/i, /\bfintech\b/i, /\bcredit card\b/i, /\bloan\b/i],
    signal: "Finance vertical",
  },
];

const TONE_HINTS: Record<CampaignType, string> = {
  product_launch: "Hero the new product with discovery-first storytelling and clear trial CTA",
  brand_awareness: "Maximise memorable brand moments — hook-first, shareable, low-friction viewing",
  engagement: "Invite participation through comments, saves, and creator-led conversation starters",
  conversion: "Drive action with proof points, offer clarity, and frictionless purchase paths",
  seasonal: "Anchor content to the seasonal moment — timely relevance over evergreen messaging",
  ramadan: "Respectful Ramadan tone — community, generosity, and culturally appropriate pacing",
  retail: "Showcase availability, offers, and in-store or online shopping convenience",
  food: "Sensory-led tasting, recipe, or craving triggers with appetite appeal",
  fmcg: "Everyday usage moments — pantry staple integration in authentic household contexts",
  beauty: "Transformation, routine, or GRWM pacing with visible product results",
  telecom: "Connectivity benefits, plan value, and digital lifestyle integration",
  music: "Audio-led hooks — track as hero with native platform sound usage",
  tourism: "Destination aspiration — experience-led discovery and wanderlust triggers",
  finance: "Trust-building clarity — simplify complex offers with credible creator endorsement",
  general: "Platform-native creator storytelling aligned to campaign objective",
};

function detectFromObjective(objective?: string): CampaignType | undefined {
  if (!objective?.trim()) return undefined;
  const lower = objective.toLowerCase();
  if (/\bconversion|sales|purchase|revenue\b/.test(lower)) return "conversion";
  if (/\bengagement|community|ugc\b/.test(lower)) return "engagement";
  if (/\bawareness|reach|visibility|recall\b/.test(lower)) return "brand_awareness";
  if (/\blaunch|introduc/.test(lower)) return "product_launch";
  return undefined;
}

function detectFromIndustry(industry?: string): CampaignType | undefined {
  if (!industry?.trim()) return undefined;
  const detected = detectIndustryFromBrief(industry);
  const map: Record<string, CampaignType> = {
    beauty: "beauty",
    telecom: "telecom",
    retail: "retail",
    tourism: "tourism",
    finance: "finance",
    music: "music",
    food: "food",
  };
  return map[detected] ?? undefined;
}

/** Classify campaign type from brief + objective + industry + market signals. */
export function classifyCampaignType(input: ClassifierInput): CampaignTypeClassification {
  const combined = `${input.objective ?? ""}\n${input.briefText}\n${input.season ?? ""}\n${input.marketCountry ?? ""}`;
  const signals: string[] = [];
  const matches: CampaignType[] = [];

  for (const entry of TYPE_PATTERNS) {
    if (entry.patterns.some((pattern) => pattern.test(combined))) {
      matches.push(entry.type);
      signals.push(entry.signal);
    }
  }

  const fromObjective = detectFromObjective(input.objective);
  if (fromObjective && !matches.includes(fromObjective)) {
    matches.unshift(fromObjective);
    signals.unshift(`Objective: ${fromObjective.replace(/_/g, " ")}`);
  }

  const fromIndustry = detectFromIndustry(input.industry);
  if (fromIndustry && !matches.includes(fromIndustry)) {
    matches.push(fromIndustry);
    signals.push(`Industry: ${fromIndustry.replace(/_/g, " ")}`);
  }

  const primary = matches[0] ?? "general";
  const secondary = matches.find((type) => type !== primary);
  const confidence: CampaignTypeClassification["confidence"] =
    matches.length >= 2 ? "high" : matches.length === 1 ? "medium" : "low";

  return {
    primary,
    secondary,
    confidence,
    signals: signals.slice(0, 4),
    toneHint: TONE_HINTS[primary],
  };
}

export function campaignTypeLabel(type: CampaignType): string {
  return type
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/** Whether creative formats should emphasise participation mechanics for this type. */
export function campaignTypeSuggestsParticipation(type: CampaignType): boolean {
  return type === "engagement" || type === "music";
}

const CAMPAIGN_PHASE_SEQUENCES: Partial<Record<CampaignType, string[]>> = {
  product_launch: ["Reveal", "Trial", "Proof", "Convert"],
  brand_awareness: ["Introduce", "Amplify", "Sustain", "Recall"],
  engagement: ["Invite", "Participate", "Amplify", "Sustain"],
  conversion: ["Tease", "Offer", "Urgency", "Close"],
  seasonal: ["Tease", "Peak", "Sustain", "Close"],
  ramadan: ["Pre-Ramadan", "Ramadan Peak", "Eid Lift", "Close"],
  retail: ["Tease", "Offer", "Peak", "Last Call"],
  food: ["Crave", "Taste", "Share", "Repeat"],
  beauty: ["Reveal", "Routine", "Proof", "Convert"],
  music: ["Tease", "Drop", "Viral", "Sustain"],
  tourism: ["Dream", "Discover", "Plan", "Book"],
  telecom: ["Announce", "Demo", "Proof", "Switch"],
  finance: ["Educate", "Compare", "Trust", "Apply"],
  fmcg: ["Introduce", "Trial", "Habit", "Restock"],
  general: ["Launch", "Amplify", "Momentum", "Wrap-up"],
};

/**
 * Map generic weight-derived phase to campaign-type-specific label.
 * Ties weekly objectives to executive summary / campaign classifier — not generic Launch/Maintain only.
 */
export function campaignTypeWeeklyPhase(
  campaignType: CampaignType,
  genericPhase: string,
  weekIndex: number,
  totalWeeks: number
): string {
  const sequence = CAMPAIGN_PHASE_SEQUENCES[campaignType] ?? CAMPAIGN_PHASE_SEQUENCES.general!;
  if (totalWeeks <= 1) return sequence[0] ?? genericPhase;

  const ratio = weekIndex / Math.max(1, totalWeeks - 1);
  const slot =
    ratio <= 0.2 ? 0 : ratio <= 0.45 ? 1 : ratio <= 0.75 ? 2 : Math.min(3, sequence.length - 1);

  const typePhase = sequence[slot] ?? genericPhase;

  if (genericPhase === "Wrap-up" && slot < sequence.length - 1) {
    return sequence[sequence.length - 1]!;
  }
  if (genericPhase === "Maintain" && slot >= 2) {
    return sequence[2] ?? typePhase;
  }

  return typePhase;
}
