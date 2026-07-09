/** Meta/help prompts that must never trigger operational workflows. */
export const META_HELP_PATTERN =
  /\b(what can thinkway|what is thinkway|how do i use thinkway|explain thinkway)\b/i;

const CAMPAIGN_VERB_PATTERN =
  /\b(?:launch(?:ing)?|create|build|start|run|plan)\b(?:[\s\S]{0,120}\b(?:in|for|across)\b|[\s\S]{0,40}\bcampaign\b)/i;

const CAMPAIGN_NOUN_PATTERN =
  /\b(?:create|build|start|run)\s+(?:a\s+)?(?:new\s+)?campaign\b/i;

const LAUNCH_PRODUCT_PATTERN = /\blaunch(?:ing)?\s+\w/i;

/** Brief fields commonly present in pasted campaign specs. */
const BRIEF_FIELD_PATTERNS = [
  /\b(?:budget|egp|usd|eur|gbp|aed|\$|£|€)\b/i,
  /\b(?:\d+\s*weeks?|\d+\s*months?|campaign\s+duration|duration)\b/i,
  /\bobjective\s*:/i,
  /\b(?:target|audience|mothers|parents|demographic)\b/i,
];

/**
 * Detect long-form operational campaign briefs, e.g.
 * "Launch [product] in [country]… Budget… Duration… Objective…"
 */
export function isOperationalCampaignBrief(message: string): boolean {
  const normalized = message.trim();
  if (normalized.length < 40 || META_HELP_PATTERN.test(normalized)) {
    return false;
  }

  const hasCampaignIntent =
    CAMPAIGN_VERB_PATTERN.test(normalized) ||
    CAMPAIGN_NOUN_PATTERN.test(normalized) ||
    LAUNCH_PRODUCT_PATTERN.test(normalized);

  if (!hasCampaignIntent) {
    return false;
  }

  const briefFieldCount = BRIEF_FIELD_PATTERNS.filter((pattern) =>
    pattern.test(normalized)
  ).length;

  return briefFieldCount >= 2;
}
