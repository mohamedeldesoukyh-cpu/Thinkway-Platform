/**
 * Creator Intelligence rollout flags.
 *
 *   CREATOR_INTELLIGENCE_MODE=off     (default) — zero behavior change
 *   CREATOR_INTELLIGENCE_MODE=shadow  — legacy behavior; CI comparison logged
 *   CREATOR_INTELLIGENCE_MODE=on      — CI matching drives category post-filter
 *
 * Read at call time (not module load) so scripts and tests can toggle.
 */
export type CreatorIntelligenceMode = "off" | "shadow" | "on";

export function getCreatorIntelligenceMode(): CreatorIntelligenceMode {
  const raw = process.env.CREATOR_INTELLIGENCE_MODE?.trim().toLowerCase();
  if (raw === "shadow" || raw === "on") return raw;
  return "off";
}
