/**
 * Identity lifecycle boundary (L1).
 *
 * Phase 1: placeholder module only. Commercial CRM must never live here.
 * Phase 2: rename Apify `ensureCommercialCreatorFromApifyData` → identity helper
 * and host it (or re-export) from this module.
 *
 * Rules:
 * - May create/update `influencers` + platform accounts / discovered links.
 * - Must NEVER insert into `creator_crm_profiles` or call `ensureCommercialCreator`.
 * - Discovery import / Apify / enrichment remain identity-only until an approved
 *   commercial activation reason is wired (separate CRM entry point).
 */

export const IDENTITY_LIFECYCLE_BOUNDARY =
  "Identity ensure must not activate Commercial Creator CRM." as const;
