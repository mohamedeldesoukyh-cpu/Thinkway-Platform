/** Normal Discovery's read-only execution contract. No acquisition or persistence imports. */
import { normalizeDiscoverySearchText } from "./discovery-search-normalize";
import { normalizeDiscoverySearchQuery } from "./creator-search-query";
import { creatorMatchesBrowseCategories } from "@/lib/creators/category-filter";
import { inferCountriesFromProfileSignals, resolveCreatorCountryCodes } from "@/lib/creators/country-inference";
import { resolveCountryCode } from "@/lib/creators/country-code";
import { COUNTRY_OPTIONS } from "@/lib/master-data/constants";
import { passesProductionCreatorGate } from "@/lib/creators/production-filter";
import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import { resolveCreatorSearchFollowerRanges, toBrowseFollowerRanges } from "@/lib/creators/follower-range-filter";
import type { CreatorSearchFilters, CreatorSearchSortState } from "@/features/discovery/components/creator-search/creator-search-types";
import type { UnifiedCreatorResult } from "@/lib/creators/types";

export type RelevanceReason = { dimension: string; outcome: "Match" | "Not available" | "Does not match"; detail?: string };
export type SearchRelevance = { score: number | null; reasons: RelevanceReason[]; methodology: "discovery-v1" };
export type SearchCompleteness = { status: "complete" | "bounded" | "incomplete"; reason?: "work_budget" | "time_budget"; examined: number; matched: number; totalKind: "exact" | "lower_bound" };
export type Candidate = UnifiedCreatorResult & { content_text?: string; last_post_at?: string | null; stored_thinkway_score?: number | null };
export type NormalSearchRequest = { filters: CreatorSearchFilters; sort: CreatorSearchSortState; page: number; pageSize: number; continuation?: string };
export const NORMAL_SEARCH_SORTS = ["relevance", "name", "platform", "followers", "country", "categories", "engagement", "views", "source", "thinkway", "last_synced"] as const;
const norm = (value: string) => normalizeDiscoverySearchText(value).replace(/^@/, "");
const values = (xs: string[]) => xs.map(norm).filter(Boolean);
const num = (s: string) => s.trim() && Number.isFinite(Number(s)) ? Number(s) : null;

/** Disabled controls and old bookmarked values cannot reintroduce proxy semantics. */
export function sanitizeNormalFilters(f: CreatorSearchFilters): CreatorSearchFilters {
  return { ...f, categories: cleanDiscoveryCategories(f.categories), minBrandSafety: "", minAiScore: "", minBrandFit: "", minEstimatedCost: "", maxEstimatedCost: "", audienceInterestTags: [], contentLanguages: [] };
}
export function hasNormalSearchContext(input: CreatorSearchFilters): boolean {
  const f = sanitizeNormalFilters(input);
  return Boolean(f.search.trim() || f.handle.trim() || f.contentKeyword.trim() || f.contentTags.length || f.platforms.length || f.countries.length || f.categories.length || f.languages.length || f.aiNiche.trim() || f.audienceCountries.length || f.gender || f.ageMin || f.ageMax || f.followerRanges.length || f.minFollowers || f.maxFollowers || f.minEngagement || f.minViews || f.minThinkwayScore || f.lastPostWithin);
}
export function normalRetrievalQuery(f: CreatorSearchFilters): string {
  // Keep the existing URL/handle normalization. Preserve raw Arabic for the existing index;
  // in-memory comparisons normalize BOTH operands, rather than only changing the query.
  const q = (f.search.trim() || f.handle.trim());
  return /^https?:\/\//i.test(q) || q.startsWith("@") ? normalizeDiscoverySearchQuery(q) : q;
}
export function cleanDiscoveryCategories(xs: string[]): string[] {
  const codes = new Set<string>(COUNTRY_OPTIONS.map(c => c.value));
  return xs.filter(s => !codes.has(resolveCountryCode(s)));
}

/** Eligibility is tri-state evidence; unknown hard evidence does not qualify or become a mismatch score. */
export function evaluateNormalCandidate(c: Candidate, input: CreatorSearchFilters, now = Date.now()) {
  const f = sanitizeNormalFilters(input);
  const reasons: RelevanceReason[] = [];
  let eligible = passesProductionCreatorGate(c);
  const check = (dimension: string, active: boolean, known: boolean, match: boolean) => {
    if (!active) return;
    reasons.push({ dimension, outcome: !known ? "Not available" : match ? "Match" : "Does not match" });
    if (!known || !match) eligible = false;
  };
  const countries = resolveCreatorCountryCodes({ country_codes: c.country_codes, country_code: c.country_code, estimated_country: c.estimated_country, platformAudienceCountries: c.platforms.map(p => p.audience_country) });
  const inferred = countries.length ? countries : inferCountriesFromProfileSignals({ bio: c.bio, displayName: c.display_name, hashtags: c.hashtags, handle: c.platforms[0]?.handle, city: c.city });
  c = { ...c, country_codes: inferred, country_code: inferred[0] ?? null, categories: cleanDiscoveryCategories(c.categories) };
  check("Creator country", f.countries.length > 0, inferred.length > 0, f.countries.some(v => inferred.includes(resolveCountryCode(v))));
  const ps = new Set(f.platforms.map(canonicalPlatformKey));
  const accounts = c.platforms.filter(p => !ps.size || ps.has(canonicalPlatformKey(p.platform)));
  check("Platform", ps.size > 0, c.platforms.length > 0, accounts.length > 0);
  const ranges = toBrowseFollowerRanges(resolveCreatorSearchFollowerRanges(f));
  const minEr = num(f.minEngagement), minViews = num(f.minViews);
  // All account-scoped requirements must be satisfied by the SAME selected-platform account.
  const qualified = accounts.filter(p =>
    (!ranges.length || (p.follower_count != null && ranges.some(r => p.follower_count! >= r.min && (r.max == null || p.follower_count! <= r.max)))) &&
    (minEr == null || (p.engagement_rate != null && p.engagement_rate >= minEr)) &&
    (minViews == null || (p.avg_views != null && p.avg_views >= minViews)));
  check("Follower range", ranges.length > 0, accounts.some(p => p.follower_count != null), accounts.some(p => p.follower_count != null && ranges.some(r => p.follower_count! >= r.min && (r.max == null || p.follower_count! <= r.max))));
  check("Engagement", minEr != null, accounts.some(p => p.engagement_rate != null), accounts.some(p => p.engagement_rate != null && p.engagement_rate >= (minEr ?? 0)));
  check("Average views", minViews != null, accounts.some(p => p.avg_views != null), accounts.some(p => p.avg_views != null && p.avg_views >= (minViews ?? 0)));
  if ((ranges.length || minEr != null || minViews != null) && !qualified.length) eligible = false;
  const metricAccount = qualified.find(p => p.id === c.default_metrics_platform_account_id) ?? qualified[0] ?? accounts[0];
  if (metricAccount) {
    const metric = (value: number | null | undefined) => ({ value: value ?? null, confidence: "estimated" as const });
    c = { ...c, metrics: { ...c.metrics, followers: metric(metricAccount.follower_count), engagement_rate: metric(metricAccount.engagement_rate), avg_views: metric(metricAccount.avg_views), avg_likes: metric(metricAccount.avg_likes), avg_comments: metric(metricAccount.avg_comments) } };
  }
  check("Category", !!f.categories.length, !!c.categories.length || f.categories.includes("__uncategorized__"), creatorMatchesBrowseCategories(c, f.categories));
  check("Niche", !!f.aiNiche.trim(), !!c.ai_niche, norm(c.ai_niche ?? "").includes(norm(f.aiNiche)));
  check("Creator language", !!f.languages.length, !!c.language_codes.length, values(f.languages).some(v => values(c.language_codes).includes(v)));
  const d = c.audience_demographics;
  const genuine = !!d && d.source !== "unavailable";
  const audienceCountries = genuine ? (d.topCountries ?? []).filter(v => v.percent == null || v.percent > 0).map(v => resolveCountryCode(v.code ?? v.name)) : [];
  check("Audience geography", !!f.audienceCountries.length, audienceCountries.length > 0, f.audienceCountries.some(v => audienceCountries.includes(resolveCountryCode(v))));
  const gender = f.gender === "male" || f.gender === "female" ? f.gender : null;
  const share = gender && genuine ? d.gender[gender] : null;
  check("Audience gender", !!f.gender, share != null, share != null && share >= 50);
  const bands: Record<string, [number, number]> = { "13_17": [13,17], "18_24": [18,24], "25_34": [25,34], "35_44": [35,44], "45_54": [45,54], "55_plus": [55,Infinity] };
  const knownAges = genuine ? Object.entries(d.age).filter((e): e is [string, number] => e[1] != null && e[1] > 0) : [];
  const dominant = knownAges.sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0]))[0];
  const ageRange = dominant ? bands[dominant[0]] : null;
  check("Audience age", !!(f.ageMin || f.ageMax), !!ageRange, !!ageRange && ageRange[1] >= (num(f.ageMin) ?? 0) && ageRange[0] <= (num(f.ageMax) ?? Infinity));
  const days = Number(f.lastPostWithin.replace("d", ""));
  const date = c.last_post_at ? Date.parse(c.last_post_at) : NaN;
  check("Recent activity", !!f.lastPostWithin, Number.isFinite(date), date >= now - days * 86400000 && date <= now);
  const thinkway = c.stored_thinkway_score;
  check("Thinkway score", num(f.minThinkwayScore) != null, thinkway != null, thinkway != null && thinkway >= Number(f.minThinkwayScore));
  const handle = norm(normalRetrievalQuery({ ...f, search: "" }));
  check("Name or handle", !!handle, !!c.display_name || c.platforms.some(p => !!p.handle), norm(c.display_name).includes(handle) || c.platforms.some(p => norm(p.handle).includes(handle)));
  const content = norm([c.bio, ...(c.hashtags ?? []), c.content_text].filter(Boolean).join(" "));
  const keywords = norm(f.contentKeyword).split(/\s+/).filter(Boolean);
  check("Content keyword", keywords.length > 0, !!content, keywords.every(t => content.includes(t)));
  check("Content tags", f.contentTags.length > 0, !!content, values(f.contentTags).some(t => content.includes(t.replace(/^#/, ""))));

  // Grade only requested dimensions with degrees of fit. Hard membership never earns points.
  const query = normalRetrievalQuery(f);
  const gradedScores: number[] = [];
  if (query) {
    const q = norm(query);
    const exact = norm(c.display_name) === q || c.platforms.some(p => norm(p.handle) === q);
    const prefix = norm(c.display_name).startsWith(q) || c.platforms.some(p => norm(p.handle).startsWith(q));
    const hay = norm([c.display_name, ...c.platforms.map(p => p.handle), c.bio, ...c.categories, c.ai_niche, ...(c.hashtags ?? []), c.content_text].filter(Boolean).join(" "));
    const tokens = q.split(/\s+/).filter(Boolean);
    const coverage = tokens.length ? tokens.filter(t => hay.includes(t)).length / tokens.length : 0;
    // Retrieval rank proves lexical/fuzzy evidence even when the compact text omits an indexed field.
    const score = exact ? 100 : prefix ? 90 : coverage > 0 ? Math.round(80 * coverage) : (c.search_rank ?? 0) > 0 ? 40 : null;
    if (score != null) gradedScores.push(score);
    reasons.push({ dimension: "Search text", outcome: score == null ? "Not available" : "Match", detail: exact ? "Exact name or handle" : prefix ? "Name or handle prefix" : coverage > 0 ? "Query terms in stored profile/content" : "Existing lexical/fuzzy retrieval" });
  }
  if (f.aiNiche.trim() && c.ai_niche) {
    gradedScores.push(norm(c.ai_niche) === norm(f.aiNiche) ? 100 : 80);
  }
  // Saturating headroom: threshold -> 50, twice threshold -> 75; no unbounded metric bonus.
  for (const [dimension, minimum, actual] of [
    ["Engagement", minEr, metricAccount?.engagement_rate],
    ["Average views", minViews, metricAccount?.avg_views],
  ] as const) {
    if (minimum != null && minimum > 0 && actual != null && actual >= minimum) {
      const headroom = Math.round(100 - 50 * minimum / actual);
      gradedScores.push(headroom);
      const reason = reasons.find(r => r.dimension === dimension);
      if (reason) reason.detail = `${actual} against minimum ${minimum}; fit ${headroom}%`;
    }
  }
  if (keywords.length && content) gradedScores.push(content.includes(norm(f.contentKeyword)) ? 100 : 80);
  const score = eligible && gradedScores.length ? Math.round(gradedScores.reduce((a,b) => a+b,0)/gradedScores.length) : null;
  return { eligible, creator: c, relevance: { score, reasons, methodology: "discovery-v1" as const } };
}

export function compareNormalCandidates(a: Candidate, b: Candidate, sort: CreatorSearchSortState): number {
  const metric = (c: Candidate) => {
    switch(sort.field) {
      case "relevance": return c.discovery_relevance?.score ?? null;
      case "followers": return c.metrics.followers.value;
      case "engagement": return c.metrics.engagement_rate.value;
      case "views": return c.metrics.avg_views.value;
      case "thinkway": return c.stored_thinkway_score ?? null;
      case "last_synced": return c.last_enriched_at ?? c.updated_at;
      case "name": return norm(c.display_name) || null;
      case "platform": return c.platforms.map(p => p.platform).sort().join(",") || null;
      case "country": return c.country_codes?.slice().sort().join(",") || null;
      case "categories": return c.categories.slice().sort().join(",") || null;
      case "source": return c.source_type;
      default: return null;
    }
  };
  const x = metric(a), y = metric(b);
  if (x == null && y != null) return 1;
  if (y == null && x != null) return -1;
  const cmp = x == null || y == null ? 0 : typeof x === "number" && typeof y === "number" ? x-y : String(x).localeCompare(String(y), "en");
  return (sort.direction === "asc" ? cmp : -cmp) || a.unified_id.localeCompare(b.unified_id);
}

export type CandidateWindow = { candidates: Candidate[]; exhausted: boolean; scannedCount?: number };
export type NormalSearchContinuation = {
  remaining: Candidate[]; examined: number; matched: number; internalCount: number;
  discoveryCount: number; exhausted: boolean; sealedCount: number; seen: string[]; evaluatedAt: number;
};
/** Stable window pools: finish a whole 200-candidate window, qualify, then seal/sort
 * once a page is available. Sparse windows accumulate only until a page qualifies.
 * Resume trusted sealed pools; never rerank a growing prefix. */
export async function executeNormalSearch(request: NormalSearchRequest, readWindow: (offset: number, limit: number) => Promise<CandidateWindow>, options: { maxCandidates?: number; maxMs?: number; now?: () => number; continuation?: NormalSearchContinuation } = {}) {
  const f = sanitizeNormalFilters(request.filters);
  const page = Math.max(1, Math.min(100, request.page));
  const pageSize = Math.max(1, Math.min(100, request.pageSize));
  const end = page * pageSize;
  const max = options.maxCandidates ?? 10000;
  const clock = options.now ?? Date.now, started = clock();
  const prior = options.continuation;
  const evaluatedAt = prior?.evaluatedAt ?? started;
  let examined = prior?.examined ?? 0, matched = prior?.matched ?? 0, internalCount = prior?.internalCount ?? 0, discoveryCount = prior?.discoveryCount ?? 0, exhausted = prior?.exhausted ?? false;
  let reason: "work_budget" | "time_budget" = "work_budget";
  let pool: Candidate[] = [], sealedCount = prior?.sealedCount ?? 0;
  const remaining: Candidate[] = [];
  const selected: Candidate[] = [];
  const seen = new Set<string>(prior?.seen);
  for (const [index, c] of (prior?.remaining ?? []).entries()) {
    const ordinal = sealedCount - prior!.remaining.length + index;
    if (ordinal >= end-pageSize && ordinal < end) selected.push(c);
    else if (ordinal >= end) remaining.push(c);
  }
  const exact = (c: Candidate) => c.discovery_relevance?.reasons.some(r => r.dimension === "Search text" && r.detail === "Exact name or handle") ? 1 : 0;
  const seal = () => {
    pool.sort((a,b) => exact(b)-exact(a) || compareNormalCandidates(a,b,request.sort));
    for (const c of pool) {
      if (sealedCount >= end-pageSize && sealedCount < end) selected.push(c);
      else if (sealedCount >= end) remaining.push(c);
      sealedCount++;
    }
    pool = [];
  };
  while (examined < max && sealedCount < end && !exhausted) {
    if (clock()-started >= (options.maxMs ?? 6000)) { reason = "time_budget"; break; }
    const window = await readWindow(examined, Math.min(200, max-examined));
    const scanned = window.scannedCount ?? window.candidates.length;
    if (!scanned && !window.exhausted) throw new Error("Candidate cursor made no progress");
    for (const c of window.candidates) {
      if (seen.has(c.unified_id)) continue;
      seen.add(c.unified_id);
      const evaluated = evaluateNormalCandidate(c, f, evaluatedAt);
      if (!evaluated.eligible) continue;
      matched++;
      if (c.influencer_id) internalCount++; else discoveryCount++;
      pool.push({ ...evaluated.creator, discovery_relevance: hasNormalSearchContext(f) ? evaluated.relevance : undefined });
    }
    examined += scanned;
    exhausted = window.exhausted;
    if (pool.length >= pageSize || exhausted) seal();
    if (sealedCount >= end || exhausted) break;
  }
  const ready = exhausted || sealedCount >= end;
  const completeness: SearchCompleteness = { status: exhausted ? "complete" : ready ? "bounded" : "incomplete", ...(!ready ? {reason} : {}), examined, matched, totalKind: exhausted ? "exact" : "lower_bound" };
  const continuation: NormalSearchContinuation | undefined = ready && (!exhausted || remaining.length > 0)
    ? { remaining, examined, matched, internalCount, discoveryCount, exhausted, sealedCount, seen: [...seen], evaluatedAt } : undefined;
  return { continuation, creators: ready ? selected : [], total: matched, has_more: !exhausted || matched > end, page, pageSize, internal_count: internalCount, discovery_count: discoveryCount, completeness };
}
