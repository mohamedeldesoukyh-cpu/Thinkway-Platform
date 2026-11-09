import { parseProfileInput, splitProfileInputTokens } from "@/lib/social/parse-profile-url";
import type { QuotationItemSeed } from "@/lib/domains/commercial/quotation-types";

export const QUOTATION_LINK_LIMIT = 50;

/** Ignore surrounding prose; only URL-shaped tokens are candidates. */
export function parseQuotationProfileLinks(raw: string) {
  const profiles = [] as NonNullable<ReturnType<typeof parseProfileInput>>[];
  const invalid: string[] = [];
  const seen = new Set<string>();
  let duplicates = 0;
  for (const token of splitProfileInputTokens(raw)) {
    if (!/^(?:https?:\/\/|(?:www\.)?(?:instagram\.com|instagr\.am|tiktok\.com|youtube\.com|snapchat\.com|facebook\.com|fb\.com|twitter\.com|x\.com)\/)/i.test(token)) continue;
    const profile = parseProfileInput(token);
    if (!profile) { invalid.push(token); continue; }
    const key = `${profile.platform}:${profile.normalized_username}`;
    if (seen.has(key)) { duplicates++; continue; }
    seen.add(key);
    profiles.push(profile);
  }
  return { profiles, invalid, duplicates };
}

export function quotationCreatorIdentityKeys(creator: QuotationItemSeed): string[] {
  const keys: string[] = [];
  if (creator.influencer_id) keys.push(`inf:${creator.influencer_id}`);
  if (creator.profile_id) keys.push(`disc:${creator.profile_id}`);
  if (creator.unified_id) keys.push(creator.unified_id);
  const profile = creator.profile_url ? parseProfileInput(creator.profile_url) : null;
  if (profile) keys.push(`url:${profile.normalized_profile_url}`);
  if (creator.platform && creator.handle) keys.push(`handle:${creator.platform.toLowerCase()}:${creator.handle.replace(/^@/, "").toLowerCase()}`);
  return keys;
}

export type QuotationLinkPreview = {
  detected: number;
  duplicates: number;
  alreadyInDiscovery: number;
  alreadyInQuotation: number;
  newCreators: number;
  toAdd: number;
  invalid: string[];
};

export type QuotationLinkOutcome = {
  added: number;
  skipped: number;
  created: number;
  existing: number;
  failed: { url: string; message: string }[];
  itemIds: string[];
};
