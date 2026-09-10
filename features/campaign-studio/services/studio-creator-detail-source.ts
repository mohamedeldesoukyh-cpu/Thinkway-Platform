/**
 * Which creator detail view the Studio card opens.
 *
 * There is exactly one creator detail implementation — Discovery's
 * `CreatorDetailSheet`, resolved from the same `getUnifiedCreatorsBatchAction`
 * the Studio hydration already uses. Studio's planning sheet is not a second
 * detail view: it is the state shown when Discovery has nothing to render, and
 * it says so rather than presenting partial data as a profile.
 */

export type StudioCreatorDetailSource =
  /** Discovery's own sheet, with the campaign's planning block in its slot. */
  | "discovery_detail"
  /** The unified lookup is in flight. */
  | "resolving"
  /** No unified Discovery record for this creator — planning context only. */
  | "planning_fallback";

export function resolveStudioCreatorDetailSource(input: {
  open: boolean;
  creatorId?: string | null;
  /** True once the unified lookup returned a creator. */
  unifiedCreatorResolved: boolean;
  /** True while the lookup is running. */
  resolving: boolean;
}): StudioCreatorDetailSource {
  if (input.unifiedCreatorResolved) return "discovery_detail";
  if (!input.open) return "planning_fallback";
  if (!input.creatorId?.trim()) return "planning_fallback";
  return input.resolving ? "resolving" : "planning_fallback";
}

/** The line the fallback sheet shows, or nothing when it is not the fallback. */
export function discoveryDetailStateForSource(
  source: StudioCreatorDetailSource
): "resolving" | "unavailable" | undefined {
  if (source === "resolving") return "resolving";
  if (source === "planning_fallback") return "unavailable";
  return undefined;
}
