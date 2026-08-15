import { formatMoneyKpi } from "@/lib/finance/currency-format";

export function formatCurrency(amount: number, currency: string): string {
  return formatMoneyKpi(amount, currency);
}

/** Approximate FX for benchmark localization when structured data uses non-USD currency. */
const FX_TO_USD: Record<string, number> = {
  EGP: 50,
  AED: 3.67,
  SAR: 3.75,
  EUR: 0.92,
  GBP: 0.79,
};

export function resolveCampaignCurrency(
  budgetCurrency?: string,
  ...textSources: Array<string | undefined>
): string {
  if (budgetCurrency?.trim()) return budgetCurrency.trim().toUpperCase();
  return detectCurrencyFromSources(...textSources);
}

/** Replace USD $ amounts in benchmark strings with the campaign currency. */
export function localizeMoneyString(text: string, currency: string): string {
  const code = currency.toUpperCase();
  if (!text.trim() || code === "USD") return text;

  const rate = FX_TO_USD[code] ?? 1;
  if (rate === 1 && code !== "USD") return text.replace(/\$/g, `${code} `);

  return text.replace(/\$(\d+(?:\.\d+)?)/g, (_, amount) => {
    const value = Math.round(parseFloat(amount) * rate);
    return formatCurrency(value, code);
  });
}

/** Remove internal search query metadata from client-facing markdown. */
export function stripInternalSearchMetadata(text: string): string {
  return text
    .replace(/^\*\*Filters:\*\*.*$/gim, "")
    .replace(/^\*\*Criteria:\*\*.*$/gim, "")
    .replace(/^Query:\s*.+$/gim, "")
    .replace(/_No vendors available to recommend — run discovery search first\._/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Strip markdown formatting for executive card display. */
export function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\*\*([^*]*)\*\*/g, "$1")
    .replace(/\*\*/g, "")
    .replace(/\*([^*]*)\*/g, "$1")
    .replace(/\*/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[-*•]\s+/gm, "")
    .replace(/_([^_]*)_/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/** Clean timeline phase/activity strings for card display (no raw markdown). */
export function sanitizeTimelineText(text: string): string {
  if (!text?.trim()) return "";
  return stripMarkdown(text)
    .replace(/^(\d+\.)\s*:\s*/, "$1 ")
    .replace(/\s*:\s*$/, "")
    .replace(/\s*[—–-]\s*$/g, "")
    .trim();
}

const CURRENCY_CODES = ["EGP", "AED", "SAR", "USD", "EUR", "GBP"] as const;

export function detectCurrencyFromSources(...sources: Array<string | undefined>): string {
  for (const source of sources) {
    if (!source?.trim()) continue;
    for (const code of CURRENCY_CODES) {
      if (new RegExp(`\\b${code}\\b`, "i").test(source)) return code;
    }
    if (/€/.test(source)) return "EUR";
    if (/£/.test(source)) return "GBP";
    if (/\$/.test(source)) return "USD";
  }
  return "USD";
}

const BUDGET_MAGNITUDES: Record<string, number> = {
  k: 1_000,
  thousand: 1_000,
  m: 1_000_000,
  mn: 1_000_000,
  mm: 1_000_000,
  million: 1_000_000,
  bn: 1_000_000_000,
  billion: 1_000_000_000,
};

/** "1M" → 1,000,000 · "250k" → 250,000 · "1,000,000" unchanged. */
function applyBudgetMagnitude(raw: string, suffix?: string): number {
  const value = parseFloat(raw.replace(/,/g, ""));
  if (!Number.isFinite(value)) return NaN;
  const multiplier = suffix ? BUDGET_MAGNITUDES[suffix.toLowerCase()] ?? 1 : 1;
  return value * multiplier;
}

// Number with optional magnitude suffix: 1M, 1.5 mn, 250k, 2 million, 1,000,000
const BUDGET_AMOUNT = String.raw`([\d,]+(?:\.\d+)?)\s*(k|mm|mn|m|bn|thousand|million|billion)?\b`;

export function parseBudgetTotalFromText(text: string): number | undefined {
  const patterns = [
    new RegExp(String.raw`(?:budget|total)(?:\s+of)?[:\s]*[$€£]?\s*${BUDGET_AMOUNT}`, "i"),
    new RegExp(
      String.raw`(?:budget|total)(?:\s+of)?[:\s]*(?:EGP|AED|SAR|USD|EUR|GBP)?\s*${BUDGET_AMOUNT}`,
      "i"
    ),
    new RegExp(String.raw`[$€£]\s*${BUDGET_AMOUNT}`, "i"),
    new RegExp(String.raw`\b(?:EGP|AED|SAR|USD|EUR|GBP)\s*${BUDGET_AMOUNT}`, "i"),
    new RegExp(String.raw`${BUDGET_AMOUNT}\s*(?:EGP|AED|SAR|USD|EUR|GBP)\b`, "i"),
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const raw = match?.[1];
    if (raw && /^[\d,]+/.test(raw)) {
      const value = applyBudgetMagnitude(raw, match?.[2]);
      if (Number.isFinite(value) && value > 0) return value;
    }
  }
  return undefined;
}

export function parseDurationFromText(text: string): string | undefined {
  const weeks = text.match(/(\d+)\s*weeks?/i);
  if (weeks?.[1]) return `${weeks[1]} weeks`;
  const months = text.match(/(\d+)\s*months?/i);
  if (months?.[1]) {
    const weeksFromMonths = Math.round(Number(months[1]) * 4);
    if (Number.isFinite(weeksFromMonths) && weeksFromMonths > 0) {
      return `${weeksFromMonths} weeks`;
    }
  }
  const labeledWeeks = text.match(/duration[:\s]+(\d+\s*weeks?)/i);
  if (labeledWeeks?.[1]) return labeledWeeks[1];
  const labeledMonths = text.match(/duration[:\s]+(\d+\s*months?)/i);
  if (labeledMonths?.[1]) {
    const count = parseInt(labeledMonths[1], 10);
    if (Number.isFinite(count) && count > 0) return `${count * 4} weeks`;
  }
  return undefined;
}

/**
 * Next labeled brief field (single-line briefs: "Brand: X. Client: Y. Market: Z").
 * Also stops before imperative continuations ("Need 3 creators…").
 */
const BRIEF_FIELD_BOUNDARY =
  String.raw`(?=\s*(?:[.,;]\s*)?(?:brand|client|market|budget|platforms?|category|objective|audience|duration|timeline|product|kpis?|instagram|tiktok)(?:\s*name)?\s*(?:->|[:：])|\s*(?:[.,;]\s*)?(?:need\s+\d|please\b)|\s*[,;]|$|\n)`;

/** Parse an explicitly labeled brief value without swallowing adjacent fields. */
export function parseLabeledBriefValue(
  text: string,
  label: string
): string | undefined {
  const pattern = new RegExp(
    String.raw`\b${label}(?:\s*name)?\s*(?:->|[:：])\s*(.+?)${BRIEF_FIELD_BOUNDARY}`,
    "i"
  );
  const match = text.match(pattern);
  const raw = match?.[1]?.trim().replace(/[.,;:\s]+$/g, "").trim();
  if (!raw) return undefined;
  return stripMarkdown(raw);
}

export function parseObjectiveFromText(text: string): string | undefined {
  const labeled = parseLabeledBriefValue(text, "objective");
  if (labeled) return labeled;
  if (/awareness/i.test(text) && /ugc/i.test(text)) return "Awareness and UGC";
  return undefined;
}

/** Entity token for brand capture — never include '.' (it starts the next labeled field). */
const BRIEF_ENTITY_TOKEN = String.raw`[A-Za-z0-9][\w&+'’-]*`;
const BRIEF_ENTITY_CAPTURE = String.raw`(${BRIEF_ENTITY_TOKEN}(?:\s+${BRIEF_ENTITY_TOKEN}){0,3})`;

export function parseBrandFromText(text: string): string | undefined {
  const labeled = parseLabeledBriefValue(text, "brand");
  if (labeled) return labeled.replace(/^of\s+/i, "");

  const knownBrand = text.match(
    /\b(Coca-Cola|BabyJoy|Adidas|Emirates NBD|Visit Egypt|Rolex|Pepsi|L'Oréal(?:\s+Paris)?|e&)\b/i
  );
  if (knownBrand?.[1]) return knownBrand[1];
  if (/babyjoy/i.test(text)) return "BabyJoy";
  const launch = text.match(/\blaunch\s+([A-Za-z][\w-]*(?:\s+[A-Za-z][\w-]*)?)\s+premium/i);
  if (launch?.[1]) return stripMarkdown(launch[1].trim());
  // Stop at the next brief field so "Brand e&, market Egypt, budget…" does not swallow the line.
  const brand = text.match(
    new RegExp(String.raw`\bbrand[:\s]+${BRIEF_ENTITY_CAPTURE}${BRIEF_FIELD_BOUNDARY}`, "i")
  );
  if (brand?.[1]) return stripMarkdown(brand[1].replace(/^of\s+/i, ""));
  return undefined;
}

export function parseProductFromText(text: string): string | undefined {
  const product = text.match(/(?:premium\s+)?([A-Za-z][\w\s-]*?\s+diapers?)/i);
  if (product?.[1]) return stripMarkdown(product[1].trim());
  const labeled = text.match(/product[:\s]+(.+?)(?:\n|$)/i);
  if (labeled?.[1]) return stripMarkdown(labeled[1]);
  return undefined;
}

export function parseMarketFromText(text: string): string | undefined {
  const inCountry = text.match(/\bin\s+(Egypt|Saudi Arabia|UAE|Jordan|Kuwait|Qatar|Bahrain|Oman|MENA)\b/i);
  if (inCountry?.[1]) return inCountry[1];
  const market = text.match(
    /market[:\s]+(Egypt|Saudi Arabia|UAE|United Arab Emirates|Jordan|Kuwait|Qatar|Bahrain|Oman|MENA|GCC)\b/i
  );
  if (market?.[1]) {
    const label = stripMarkdown(market[1]);
    return /^united arab emirates$/i.test(label) ? "UAE" : label;
  }
  return undefined;
}

export function parseAudienceFromText(text: string): string | undefined {
  const primary = text.match(/primary audience[:\s]+(.+?)(?:\n|$)/i);
  if (primary?.[1]) return stripMarkdown(primary[1]);
  const target = text.match(/target[:\s]+(.+?)(?:\n|$)/i);
  if (target?.[1]) return stripMarkdown(target[1]);
  const mothers = text.match(/mothers?\s+with\s+babies?\s+[\d–-]+\s+years?/i);
  if (mothers?.[0]) return stripMarkdown(mothers[0]);
  return undefined;
}

export function formatFollowers(count: number | undefined): string {
  if (count == null) return "—";
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return count.toLocaleString();
}

export function formatEngagement(rate: number | undefined): string {
  if (rate == null) return "—";
  return `${rate.toFixed(2)}%`;
}

export function parseMetricProgress(target: string): number {
  const match = target.match(/([\d.]+)\s*%/);
  if (match?.[1]) return Math.min(parseFloat(match[1]), 100);
  if (/tbd|confirm|benchmark/i.test(target)) return 35;
  return 60;
}

export function severityColor(severity: "low" | "medium" | "high"): string {
  switch (severity) {
    case "low":
      return "bg-[#1D9E75]/15 text-[#1D9E75] border-[#1D9E75]/30";
    case "medium":
      return "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800";
    case "high":
      return "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800";
  }
}
