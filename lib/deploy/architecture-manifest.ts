/**
 * Bump when clean-lifecycle architecture changes materially.
 * Used by /api/build-info so production can be verified against stale deploys.
 */
export const CLEAN_LIFECYCLE_ARCHITECTURE_VERSION = "2026-06-clean-lifecycle-v1";

export type CleanLifecycleArchitectureManifest = {
  version: string;
  /** ASSIGNMENTS_RENDER_STAGE bisect + JSON emergency fallback removed */
  renderStageBisectRemoved: true;
  /** createCampaignAction inserts header only — no Line A bootstrap */
  campaignCreateBootstrapRemoved: true;
  /** ensureBillableDeliverablesForLine no longer inserts legacy_synthetic rows */
  syntheticDeliverableAutoInsertRemoved: true;
  /** assignment-hierarchy does not inject synthetic deliverable children */
  hierarchySyntheticInjectionRemoved: true;
  requiredMigrations: readonly string[];
  obsoleteVercelEnvVars: readonly string[];
};

export const CLEAN_LIFECYCLE_MANIFEST: CleanLifecycleArchitectureManifest = {
  version: CLEAN_LIFECYCLE_ARCHITECTURE_VERSION,
  renderStageBisectRemoved: true,
  campaignCreateBootstrapRemoved: true,
  syntheticDeliverableAutoInsertRemoved: true,
  hierarchySyntheticInjectionRemoved: true,
  requiredMigrations: [
    "20260608010000_campaign_line_status_invariants.sql",
    "20260608020000_operational_entity_integrity.sql",
    "20260609000000_disable_operational_bootstrap.sql",
    "20260609010000_campaign_document_sequence_reseed.sql",
  ],
  obsoleteVercelEnvVars: [
    "ASSIGNMENTS_RENDER_STAGE",
    "NEXT_PUBLIC_ASSIGNMENTS_RENDER_STAGE",
    "ASSIGNMENTS_ALLOW_RENDER_BISECT",
    "NEXT_PUBLIC_ASSIGNMENTS_UI_LAYER",
  ],
};

/** True when legacy bisect env would have affected Assignments (should be unset in Vercel). */
export function hasLegacyAssignmentsEnv(): boolean {
  return Boolean(
    process.env.ASSIGNMENTS_RENDER_STAGE?.trim() ||
      process.env.NEXT_PUBLIC_ASSIGNMENTS_RENDER_STAGE?.trim() ||
      process.env.ASSIGNMENTS_ALLOW_RENDER_BISECT?.trim()
  );
}
