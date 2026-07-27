/**
 * Identity lifecycle boundary (L1).
 *
 * Rules:
 * - May create/update `influencers` + platform accounts / discovered links.
 * - Must NEVER insert into `creator_crm_profiles` or call `ensureCommercialCreator`.
 * - Discovery import / Apify / enrichment remain identity-only until an approved
 *   commercial activation reason is wired (separate CRM entry point).
 */

export { ensureIdentityCreatorFromApifyData } from "@/lib/discovery/apify-import-pipeline";

export const IDENTITY_LIFECYCLE_BOUNDARY =
  "Identity ensure must not activate Commercial Creator CRM." as const;

/** Stable alias — prefer this name at call sites outside the Apify pipeline file. */
export { ensureIdentityCreatorFromApifyData as ensureIdentityFromApifyData } from "@/lib/discovery/apify-import-pipeline";
