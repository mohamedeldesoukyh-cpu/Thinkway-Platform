/** Validated category allowlist — aligned with Discovery quick categories. */
export const QUICK_CATEGORIES = [
  "Beauty",
  "Fashion",
  "Fitness",
  "Food",
  "Travel",
  "Lifestyle",
  "Health & Wellness",
  "Tech",
  "Gaming",
] as const;

/** Tokens that must never become Discovery category filters. */
export const BAD_CATEGORY_TOKENS = [
  "audience",
  "campaign",
  "duration",
  "objective",
  "deliverables",
  "deliverable",
  "budget",
  "kpi",
  "kpis",
  "platform",
  "platforms",
  "keyword",
  "keywords",
  "timeline",
  "weeks",
  "timeline",
  "requirements",
  "mandatory",
  "preferred",
] as const;

/** Field-label fragments indicating concatenated extraction garbage. */
export const FIELD_LABEL_FRAGMENTS = [
  "campaign duration",
  "campaign objective",
  "audience preferences",
  "social platform",
  "creator type",
  "content keyword",
  "mandatory requirement",
] as const;

export const NICHE_PATTERNS = [
  /^skincare$/i,
  /^makeup$/i,
  /^beauty$/i,
  /^dermatolog/i,
  /^vitamin\s*c$/i,
  /^ugc$/i,
  /^influencer$/i,
  /^micro[\s-]?influencer$/i,
] as const;
