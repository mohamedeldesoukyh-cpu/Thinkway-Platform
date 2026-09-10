/**
 * What the Creators section is actually doing right now.
 *
 * The section decided between "render cards" and "render the empty state" on
 * `vendors.length === 0` plus a hydration `loading` flag that could be false
 * while the slate had just been replaced — so for the width of the hydration
 * waves an operator saw the run-discovery / no-results area even though the
 * campaign held creator ids and they were on their way. Discovery returning
 * nothing and Discovery not having finished loading must never look the same.
 *
 * These are the states the existing data already distinguishes; nothing new is
 * persisted and no second loading system is introduced.
 */

export type StudioCreatorListState =
  /** No creator ids at all, and no search has run. */
  | "ready_to_run"
  /** A Discovery search is in flight. */
  | "searching"
  /** Ids exist, cards do not yet — hydration waves are running. */
  | "hydrating"
  /** Hydrated creators are on screen. */
  | "results"
  /** A search completed and the campaign genuinely has no creators. */
  | "no_results"
  /** The slate proposal is blocked and says why. */
  | "blocked";

export function resolveStudioCreatorListState(input: {
  /** Creator ids the campaign holds for this stage (slate + candidates). */
  expectedCreatorIdCount: number;
  /** Creators actually hydrated and renderable. */
  hydratedCount: number;
  /** A Discovery search is running (section status or an operator run). */
  searching: boolean;
  /** The hydration hook's own loading flag. */
  hydrationLoading: boolean;
  /** A search has completed at least once for this campaign. */
  hasSearched: boolean;
  /** The slate proposal recorded a blocking reason. */
  proposalBlocked: boolean;
}): StudioCreatorListState {
  if (input.hydratedCount > 0) return "results";
  if (input.searching) return "searching";
  // Ids without cards is loading — never "no results". This is the case that
  // was showing an empty area.
  if (input.expectedCreatorIdCount > 0) {
    return input.hydrationLoading || input.hydratedCount === 0 ? "hydrating" : "results";
  }
  if (input.proposalBlocked) return "blocked";
  return input.hasSearched ? "no_results" : "ready_to_run";
}

/** True when the section must show a loading affordance rather than an empty state. */
export function studioCreatorListIsLoading(state: StudioCreatorListState): boolean {
  return state === "searching" || state === "hydrating";
}
