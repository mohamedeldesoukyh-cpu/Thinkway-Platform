import type { EnrichmentScope } from "./enabled";

/** Whether enrichment scope explicitly targets avatar field updates. */
export function isAvatarEnrichmentScope(scope: EnrichmentScope | undefined): boolean {
  const resolved = scope ?? "all";
  return resolved === "all" || resolved === "avatar";
}

/**
 * Resolve avatar persist flags for an Apify enrichment run.
 *
 * Avatar persist is attempted whenever Apify returns a profile photo (even on
 * metrics-only refresh). Scope only controls whether policy may be bypassed.
 */
export function resolveApifyAvatarPersistOptions(input: {
  scope?: EnrichmentScope;
  force?: boolean;
  bypassMetricsManualOverride?: boolean;
  forceAvatarReplace?: boolean;
}): { forceSync: boolean; forceAvatarReplace: boolean } {
  const avatarScope = isAvatarEnrichmentScope(input.scope);
  return {
    forceSync: avatarScope && Boolean(input.force || input.bypassMetricsManualOverride),
    forceAvatarReplace: avatarScope && Boolean(input.forceAvatarReplace),
  };
}
