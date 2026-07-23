import type { EnrichmentScope } from "./enabled";

/**
 * Whether to launch a separate Instagram posts actor run (in addition to profile details).
 *
 * Hard-disabled for all scopes: profile-details already includes latestPosts, and the
 * posts actor was the main unsolicited credit burn ($0.014 × many creators).
 */
export function shouldIncludeApifyProfilePosts(_scope: EnrichmentScope | undefined): boolean {
  return false;
}
