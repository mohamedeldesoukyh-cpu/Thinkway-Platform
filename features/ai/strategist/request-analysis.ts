import type { AiContext, AiRequest } from "../types";

export type StrategistRequestAnalysis = {
  brandId?: string;
  brandName?: string;
  clientId?: string;
  clientName?: string;
  campaignId?: string;
  campaignName?: string;
  objective?: string;
  budget?: number;
  currency?: string;
  audience?: string;
  timeline?: string;
  platforms?: string[];
  searchQuery?: string;
  campaignTitle?: string;
};

const BRAND_PATTERNS = [
  /\bfor\s+([A-Za-z0-9&'.\-\s]{2,40}?)(?:\s+campaign|\s+brand|\s*$|[,.])/i,
  /\bbrand[:\s]+([A-Za-z0-9&'.\-\s]{2,40})/i,
];

const OBJECTIVE_KEYWORDS: Record<string, string> = {
  awareness: "brand awareness",
  launch: "product launch",
  engagement: "engagement",
  conversion: "conversion",
  traffic: "traffic",
  sales: "sales",
  consideration: "consideration",
  reach: "reach",
  tourism: "tourism promotion",
  restaurant: "restaurant promotion",
  footfall: "footfall and visits",
  bookings: "bookings",
};

const PLATFORM_KEYWORDS = ["instagram", "tiktok", "youtube", "snapchat", "twitter", "x"];

const TIMELINE_PATTERNS = [
  /\b(q[1-4]\s*20\d{2})\b/i,
  /\b(\d+\s*(?:week|month)s?)\b/i,
  /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s*20\d{2}\b/i,
  /\bby\s+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b/i,
];

function extractBrandName(message: string): string | undefined {
  const lower = message.toLowerCase();
  const knownBrands = [
    { key: "baby joy", name: "BabyJoy" },
    { key: "babyjoy", name: "BabyJoy" },
    { key: "coca-cola", name: "Coca-Cola" },
    { key: "coca cola", name: "Coca-Cola" },
    { key: "l'oréal", name: "L'Oréal" },
    { key: "loreal", name: "L'Oréal" },
    { key: "visit riyadh", name: "Visit Riyadh" },
  ];

  for (const brand of knownBrands) {
    if (lower.includes(brand.key)) {
      return brand.name;
    }
  }

  for (const pattern of BRAND_PATTERNS) {
    const match = message.match(pattern);
    const candidate = match?.[1]?.trim();
    if (!candidate || candidate.length < 2) {
      continue;
    }
    if (/^\d+\s*(week|month)/i.test(candidate)) {
      continue;
    }
    if (/^(local|travel|gen|millennial|new parents)/i.test(candidate)) {
      continue;
    }
    return candidate.replace(/\s+/g, " ");
  }

  const visitMatch = message.match(/\b(?:visit|promote|promotion for)\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)?)/);
  if (visitMatch?.[1]?.trim()) {
    return visitMatch[1].trim();
  }

  return undefined;
}

function extractBudget(message: string): { budget?: number; currency?: string } {
  const currencyMatch = message.match(
    /\b(?:USD|EUR|GBP|SAR|AED|\$|€|£)\s*([\d,]+(?:\.\d+)?)\s*(k|m|million|thousand)?/i
  );
  const amountMatch = message.match(
    /\b([\d,]+(?:\.\d+)?)\s*(k|m|million|thousand)?\s*(USD|EUR|GBP|SAR|AED|\$|€|£)?/i
  );
  const match = currencyMatch ?? amountMatch;

  if (!match) {
    return {};
  }

  const rawAmount = Number(match[1]?.replace(/,/g, "") ?? 0);
  if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
    return {};
  }

  const multiplierToken = match[2]?.toLowerCase();
  let budget = rawAmount;
  if (multiplierToken === "k" || multiplierToken === "thousand") {
    budget = rawAmount * 1_000;
  } else if (multiplierToken === "m" || multiplierToken === "million") {
    budget = rawAmount * 1_000_000;
  }

  const currencyToken = (match[3] ?? match[0].match(/USD|EUR|GBP|SAR|AED|\$|€|£/i)?.[0] ?? "")
    .toUpperCase()
    .replace("$", "USD")
    .replace("€", "EUR")
    .replace("£", "GBP");

  return {
    budget: Math.round(budget),
    currency: currencyToken || undefined,
  };
}

function extractObjective(message: string): string | undefined {
  const lower = message.toLowerCase();
  const hits = Object.entries(OBJECTIVE_KEYWORDS)
    .filter(([keyword]) => lower.includes(keyword))
    .map(([, label]) => label);

  if (hits.length > 0) {
    return hits.join(", ");
  }

  const objectiveMatch = message.match(
    /\b(?:objective|goal|aim|focus)[:\s]+(.{8,120}?)(?:[.!?\n]|$)/i
  );
  return objectiveMatch?.[1]?.trim();
}

function extractAudience(message: string): string | undefined {
  const audienceMatch = message.match(
    /\b(?:target(?:ing)?|audience)[:\s]+(.{8,120}?)(?:[.!?\n]|$)/i
  );
  if (audienceMatch?.[1]?.trim()) {
    return audienceMatch[1].trim();
  }

  const lower = message.toLowerCase();
  if (lower.includes("mom") || lower.includes("moms") || lower.includes("parents")) {
    return "Parents and caregivers";
  }
  if (lower.includes("gen z") || lower.includes("gen-z")) {
    return "Gen Z consumers";
  }
  if (lower.includes("millennial")) {
    return "Millennial consumers";
  }
  if (lower.includes("tourist") || lower.includes("travel")) {
    return "Travel-minded consumers and tourists";
  }
  if (lower.includes("foodie") || lower.includes("restaurant")) {
    return "Local diners and food enthusiasts";
  }
  if (lower.includes("beauty")) {
    return "Beauty and skincare enthusiasts";
  }

  return undefined;
}

function extractTimeline(message: string): string | undefined {
  for (const pattern of TIMELINE_PATTERNS) {
    const match = message.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  const timelineMatch = message.match(
    /\b(?:timeline|duration|period|launch)[:\s]+(.{4,60}?)(?:[.!?\n]|$)/i
  );
  return timelineMatch?.[1]?.trim();
}

function extractPlatforms(message: string): string[] {
  const lower = message.toLowerCase();
  return PLATFORM_KEYWORDS.filter((platform) => {
    if (platform === "x") {
      return /\bx\b/.test(lower) || lower.includes("twitter");
    }
    return lower.includes(platform);
  });
}

function buildSearchQuery(analysis: StrategistRequestAnalysis, message: string): string {
  if (analysis.audience) {
    return analysis.audience;
  }
  if (analysis.objective) {
    return analysis.objective;
  }
  if (analysis.brandName) {
    return `${analysis.brandName} influencers`;
  }
  return message.slice(0, 120);
}

export function analyzeStrategistRequest(
  request: AiRequest,
  context: AiContext
): StrategistRequestAnalysis {
  const message = request.message.trim();
  const { budget, currency } = extractBudget(message);

  const analysis: StrategistRequestAnalysis = {
    brandId: context.campaign?.brandId ?? context.workspace.brandId,
    brandName: extractBrandName(message),
    clientId: context.client?.id ?? context.campaign?.clientId ?? context.workspace.clientId,
    clientName: context.client?.name,
    campaignId: context.campaign?.id ?? context.workspace.campaignId,
    campaignName: context.campaign?.name,
    objective: extractObjective(message),
    budget: budget ?? context.campaign?.poAmount,
    currency: currency ?? context.campaign?.currency,
    audience: extractAudience(message),
    timeline: extractTimeline(message),
    platforms: extractPlatforms(message),
  };

  analysis.campaignTitle =
    analysis.campaignName ??
    (analysis.brandName && analysis.objective
      ? `${analysis.brandName} — ${analysis.objective}`
      : analysis.brandName
        ? `${analysis.brandName} Campaign`
        : undefined);

  analysis.searchQuery = buildSearchQuery(analysis, message);

  if (!analysis.objective) {
    const lower = message.toLowerCase();
    if (lower.includes("tourism")) {
      analysis.objective = "tourism promotion";
    } else if (lower.includes("restaurant")) {
      analysis.objective = "restaurant promotion and footfall";
    }
  }

  return analysis;
}
