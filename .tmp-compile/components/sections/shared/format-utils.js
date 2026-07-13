export function formatCurrency(amount, currency) {
    try {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: currency.length === 3 ? currency : "USD",
            maximumFractionDigits: 0,
        }).format(amount);
    }
    catch {
        return `${amount.toLocaleString()} ${currency}`;
    }
}
/** Approximate FX for benchmark localization when structured data uses non-USD currency. */
const FX_TO_USD = {
    EGP: 50,
    AED: 3.67,
    SAR: 3.75,
    EUR: 0.92,
    GBP: 0.79,
};
export function resolveCampaignCurrency(budgetCurrency, ...textSources) {
    if (budgetCurrency?.trim())
        return budgetCurrency.trim().toUpperCase();
    return detectCurrencyFromSources(...textSources);
}
/** Replace USD $ amounts in benchmark strings with the campaign currency. */
export function localizeMoneyString(text, currency) {
    const code = currency.toUpperCase();
    if (!text.trim() || code === "USD")
        return text;
    const rate = FX_TO_USD[code] ?? 1;
    if (rate === 1 && code !== "USD")
        return text.replace(/\$/g, `${code} `);
    return text.replace(/\$(\d+(?:\.\d+)?)/g, (_, amount) => {
        const value = Math.round(parseFloat(amount) * rate);
        return formatCurrency(value, code);
    });
}
/** Remove internal search query metadata from client-facing markdown. */
export function stripInternalSearchMetadata(text) {
    return text
        .replace(/^\*\*Filters:\*\*.*$/gim, "")
        .replace(/^\*\*Criteria:\*\*.*$/gim, "")
        .replace(/^Query:\s*.+$/gim, "")
        .replace(/_No vendors available to recommend — run discovery search first\._/gi, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}
/** Strip markdown formatting for executive card display. */
export function stripMarkdown(text) {
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
export function sanitizeTimelineText(text) {
    if (!text?.trim())
        return "";
    return stripMarkdown(text)
        .replace(/^(\d+\.)\s*:\s*/, "$1 ")
        .replace(/\s*:\s*$/, "")
        .replace(/\s*[—–-]\s*$/g, "")
        .trim();
}
const CURRENCY_CODES = ["EGP", "AED", "SAR", "USD", "EUR", "GBP"];
export function detectCurrencyFromSources(...sources) {
    for (const source of sources) {
        if (!source?.trim())
            continue;
        for (const code of CURRENCY_CODES) {
            if (new RegExp(`\\b${code}\\b`, "i").test(source))
                return code;
        }
        if (/€/.test(source))
            return "EUR";
        if (/£/.test(source))
            return "GBP";
        if (/\$/.test(source))
            return "USD";
    }
    return "USD";
}
const BUDGET_MAGNITUDES = {
    k: 1000,
    thousand: 1000,
    m: 1000000,
    mn: 1000000,
    mm: 1000000,
    million: 1000000,
    bn: 1000000000,
    billion: 1000000000,
};
/** "1M" → 1,000,000 · "250k" → 250,000 · "1,000,000" unchanged. */
function applyBudgetMagnitude(raw, suffix) {
    const value = parseFloat(raw.replace(/,/g, ""));
    if (!Number.isFinite(value))
        return NaN;
    const multiplier = suffix ? BUDGET_MAGNITUDES[suffix.toLowerCase()] ?? 1 : 1;
    return value * multiplier;
}
// Number with optional magnitude suffix: 1M, 1.5 mn, 250k, 2 million, 1,000,000
const BUDGET_AMOUNT = String.raw `([\d,]+(?:\.\d+)?)\s*(k|mm|mn|m|bn|thousand|million|billion)?\b`;
export function parseBudgetTotalFromText(text) {
    const patterns = [
        new RegExp(String.raw `(?:budget|total)(?:\s+of)?[:\s]*[$€£]?\s*${BUDGET_AMOUNT}`, "i"),
        new RegExp(String.raw `(?:budget|total)(?:\s+of)?[:\s]*(?:EGP|AED|SAR|USD|EUR|GBP)?\s*${BUDGET_AMOUNT}`, "i"),
        new RegExp(String.raw `[$€£]\s*${BUDGET_AMOUNT}`, "i"),
        new RegExp(String.raw `\b(?:EGP|AED|SAR|USD|EUR|GBP)\s*${BUDGET_AMOUNT}`, "i"),
        new RegExp(String.raw `${BUDGET_AMOUNT}\s*(?:EGP|AED|SAR|USD|EUR|GBP)\b`, "i"),
    ];
    for (const pattern of patterns) {
        const match = text.match(pattern);
        const raw = match?.[1];
        if (raw && /^[\d,]+/.test(raw)) {
            const value = applyBudgetMagnitude(raw, match?.[2]);
            if (Number.isFinite(value) && value > 0)
                return value;
        }
    }
    return undefined;
}
export function parseDurationFromText(text) {
    const weeks = text.match(/(\d+)\s*weeks?/i);
    if (weeks?.[1])
        return `${weeks[1]} weeks`;
    const duration = text.match(/duration[:\s]+(\d+\s*weeks?)/i);
    return duration?.[1];
}
export function parseObjectiveFromText(text) {
    const labeled = text.match(/objective[:\s]+(.+?)(?:\n|$)/i);
    if (labeled?.[1])
        return stripMarkdown(labeled[1]);
    if (/awareness/i.test(text) && /ugc/i.test(text))
        return "Awareness and UGC";
    return undefined;
}
export function parseBrandFromText(text) {
    const clientBrand = text.match(/(?:client\s*\/\s*)?brand\s*name\s*(?:->|[:：]|\s+)\s*(.+?)(?:\n|$)/i);
    if (clientBrand?.[1])
        return stripMarkdown(clientBrand[1].trim());
    const knownBrand = text.match(/\b(Coca-Cola|BabyJoy|Adidas|Emirates NBD|Visit Egypt|Rolex|Pepsi|L'Oréal(?:\s+Paris)?)\b/i);
    if (knownBrand?.[1])
        return knownBrand[1];
    if (/babyjoy/i.test(text))
        return "BabyJoy";
    const launch = text.match(/\blaunch\s+([A-Za-z][\w-]*(?:\s+[A-Za-z][\w-]*)?)\s+premium/i);
    if (launch?.[1])
        return stripMarkdown(launch[1].trim());
    const brand = text.match(/\bbrand[:\s]+(.+?)(?:\n|$)/i);
    if (brand?.[1])
        return stripMarkdown(brand[1].replace(/^of\s+/i, ""));
    return undefined;
}
export function parseProductFromText(text) {
    const product = text.match(/(?:premium\s+)?([A-Za-z][\w\s-]*?\s+diapers?)/i);
    if (product?.[1])
        return stripMarkdown(product[1].trim());
    const labeled = text.match(/product[:\s]+(.+?)(?:\n|$)/i);
    if (labeled?.[1])
        return stripMarkdown(labeled[1]);
    return undefined;
}
export function parseMarketFromText(text) {
    const inCountry = text.match(/\bin\s+(Egypt|Saudi Arabia|UAE|Jordan|Kuwait|Qatar|Bahrain|Oman|MENA)\b/i);
    if (inCountry?.[1])
        return inCountry[1];
    const market = text.match(/market[:\s]+(.+?)(?:\n|$)/i);
    if (market?.[1])
        return stripMarkdown(market[1]);
    return undefined;
}
export function parseAudienceFromText(text) {
    const primary = text.match(/primary audience[:\s]+(.+?)(?:\n|$)/i);
    if (primary?.[1])
        return stripMarkdown(primary[1]);
    const target = text.match(/target[:\s]+(.+?)(?:\n|$)/i);
    if (target?.[1])
        return stripMarkdown(target[1]);
    const mothers = text.match(/mothers?\s+with\s+babies?\s+[\d–-]+\s+years?/i);
    if (mothers?.[0])
        return stripMarkdown(mothers[0]);
    return undefined;
}
export function formatFollowers(count) {
    if (count == null)
        return "—";
    if (count >= 1000000)
        return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000)
        return `${(count / 1000).toFixed(1)}K`;
    return count.toLocaleString();
}
export function formatEngagement(rate) {
    if (rate == null)
        return "—";
    return `${rate.toFixed(2)}%`;
}
export function parseMetricProgress(target) {
    const match = target.match(/([\d.]+)\s*%/);
    if (match?.[1])
        return Math.min(parseFloat(match[1]), 100);
    if (/tbd|confirm|benchmark/i.test(target))
        return 35;
    return 60;
}
export function severityColor(severity) {
    switch (severity) {
        case "low":
            return "bg-[#1D9E75]/15 text-[#1D9E75] border-[#1D9E75]/30";
        case "medium":
            return "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800";
        case "high":
            return "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800";
    }
}
