/**
 * Intelligence module archive gate.
 *
 * When archived, the sidebar link is hidden and `/intelligence` redirects to campaigns.
 * All warehouse schema, ETL scripts, migrations, and feature code remain intact.
 *
 * Re-enable: set `INTELLIGENCE_ARCHIVED = false` and redeploy.
 * See docs/INTELLIGENCE_ARCHIVE.md for full context and steps.
 */
export const INTELLIGENCE_ARCHIVED = true;

export function isIntelligenceEnabled(): boolean {
  return !INTELLIGENCE_ARCHIVED;
}
