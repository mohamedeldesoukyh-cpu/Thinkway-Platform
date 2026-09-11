/**
 * Approval and shortlist selection are SEPARATE decisions.
 *
 * Reported from Dev: approve a creator, add it to the selection, and the
 * approval vanished. Two causes, both here:
 *
 *   1. `vendorDecisions` is `Record<creatorId, "approved" | "rejected" |
 *      "shortlisted">` — ONE value per creator. Flattening both facts into it
 *      means the later write wins, so selecting an approved creator overwrote
 *      its approval.
 *   2. `decideVendorRecommendationAction` and `selectCreatorForShortlistAction`
 *      each rebuilt that map from the draft changes ALONE and the component
 *      then REPLACED its state with it. So a decision that had already been
 *      applied (persisted, not staged) disappeared, and the approve action's
 *      rebuild did not even look at `shortlist_creator`.
 *
 * The draft already holds the two facts apart — `approve_creator` and
 * `shortlist_creator` are separate entries. Only the flattened map lost one. So
 * this derives both from the persisted decisions AND the draft changes, without
 * collapsing them and without a new store: the campaign object and its draft
 * remain the source of truth.
 */

import type { StudioDraftChange } from "@/features/campaign-intelligence/types/section-schemas";

import { creatorGroupingKey } from "./studio-creator-slate-split";

export type StudioCreatorDecisionState = {
  approved: boolean;
  selected: boolean;
  rejected: boolean;
};

const EMPTY: StudioCreatorDecisionState = { approved: false, selected: false, rejected: false };

/** Optimistic, per creator and per decision, pending the server's answer. */
export type StudioDecisionOverlay = Record<
  string,
  { approved?: boolean; selected?: boolean }
>;

export function withOptimisticDecision(
  overlay: StudioDecisionOverlay,
  creatorId: string,
  patch: { approved?: boolean; selected?: boolean }
): StudioDecisionOverlay {
  const key = creatorGroupingKey(creatorId);
  if (!key) return overlay;
  return { ...overlay, [key]: { ...overlay[key], ...patch } };
}

/** Drop one optimistic field once the canonical state has caught up. */
export function withoutOptimisticDecision(
  overlay: StudioDecisionOverlay,
  creatorId: string,
  field: "approved" | "selected"
): StudioDecisionOverlay {
  const key = creatorGroupingKey(creatorId);
  const entry = overlay[key];
  if (!entry || entry[field] === undefined) return overlay;
  const next = { ...entry };
  delete next[field];
  const result = { ...overlay };
  if (Object.keys(next).length === 0) delete result[key];
  else result[key] = next;
  return result;
}

/**
 * Both facts for one creator.
 *
 * Persisted decisions come first (they are what Apply committed), the draft
 * changes layer on top, and the optimistic overlay wins while it exists. A
 * creator can be approved and selected, either, or neither — every combination
 * is valid and none overwrites another.
 */
export function resolveCreatorDecisionState(input: {
  creatorId: string | null | undefined;
  /** `creators.data.vendorDecisions` — one value per creator, as stored. */
  persisted: Record<string, "approved" | "rejected" | "shortlisted"> | undefined;
  /** Staged changes, which hold approval and selection independently. */
  changes: StudioDraftChange[] | undefined;
  overlay?: StudioDecisionOverlay;
}): StudioCreatorDecisionState {
  const key = input.creatorId ? creatorGroupingKey(input.creatorId) : "";
  if (!key) return EMPTY;

  let approved = false;
  let selected = false;
  let rejected = false;

  for (const [id, decision] of Object.entries(input.persisted ?? {})) {
    if (creatorGroupingKey(id) !== key) continue;
    if (decision === "approved") approved = true;
    if (decision === "shortlisted") selected = true;
    if (decision === "rejected") rejected = true;
  }

  for (const change of input.changes ?? []) {
    const target = "creatorId" in change ? change.creatorId : undefined;
    if (!target || creatorGroupingKey(target) !== key) continue;
    if (change.kind === "approve_creator") {
      approved = true;
      rejected = false;
    }
    if (change.kind === "reject_creator") {
      rejected = true;
      approved = false;
    }
    if (change.kind === "shortlist_creator") selected = true;
  }

  const optimistic = input.overlay?.[key];
  if (optimistic?.approved !== undefined) approved = optimistic.approved;
  if (optimistic?.selected !== undefined) selected = optimistic.selected;

  return { approved, selected, rejected };
}

export type StudioDecisionCreator = {
  id?: string;
  displayName?: string;
  handle?: string;
  platform?: string;
  avatarUrl?: string;
};

export type StudioDecisionRow = {
  creatorId: string;
  displayName: string;
  handle?: string;
  platform?: string;
  avatarUrl?: string;
  approved: boolean;
  selected: boolean;
  /** True while a server action for this creator is running. */
  pending: boolean;
};

/**
 * Every creator carrying a decision, in the order their cards render.
 *
 * One row per creator, with both facts on it — so the panel can show
 * "Approved · Selected" rather than listing the same creator twice.
 */
export function resolveStudioDecisionRows(input: {
  vendors: StudioDecisionCreator[];
  persisted: Record<string, "approved" | "rejected" | "shortlisted"> | undefined;
  changes: StudioDraftChange[] | undefined;
  overlay?: StudioDecisionOverlay;
  pendingIds?: string[];
}): StudioDecisionRow[] {
  const pending = new Set((input.pendingIds ?? []).map(creatorGroupingKey).filter(Boolean));
  const rows: StudioDecisionRow[] = [];
  const seen = new Set<string>();

  for (const vendor of input.vendors) {
    if (!vendor.id) continue;
    const key = creatorGroupingKey(vendor.id);
    if (!key || seen.has(key)) continue;
    const state = resolveCreatorDecisionState({
      creatorId: vendor.id,
      persisted: input.persisted,
      changes: input.changes,
      overlay: input.overlay,
    });
    if (!state.approved && !state.selected) continue;
    seen.add(key);
    rows.push({
      creatorId: vendor.id,
      displayName: vendor.displayName?.trim() || vendor.handle?.trim() || vendor.id,
      handle: vendor.handle,
      platform: vendor.platform,
      avatarUrl: vendor.avatarUrl,
      approved: state.approved,
      selected: state.selected,
      pending: pending.has(key),
    });
  }

  // A decision on a creator with no hydrated card still counts — it is a real
  // decision, and dropping it would understate the counts.
  const extraIds = new Set<string>();
  for (const id of Object.keys(input.persisted ?? {})) extraIds.add(id);
  for (const change of input.changes ?? []) {
    if ("creatorId" in change && change.creatorId) extraIds.add(change.creatorId);
  }
  for (const id of extraIds) {
    const key = creatorGroupingKey(id);
    if (!key || seen.has(key)) continue;
    const state = resolveCreatorDecisionState({
      creatorId: id,
      persisted: input.persisted,
      changes: input.changes,
      overlay: input.overlay,
    });
    if (!state.approved && !state.selected) continue;
    seen.add(key);
    rows.push({
      creatorId: id,
      displayName: id,
      approved: state.approved,
      selected: state.selected,
      pending: pending.has(key),
    });
  }

  return rows;
}

/** Approved creators not yet on the selection — what "Add all approved" adds. */
export function approvedNotSelected(rows: StudioDecisionRow[]): StudioDecisionRow[] {
  return rows.filter((row) => row.approved && !row.selected);
}
