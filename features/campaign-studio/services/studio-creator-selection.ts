/**
 * The Studio creator selection, derived from the state that already owns it.
 *
 * "+ Shortlist" already had a home: `shortlistVendorRecommendationAction`
 * stages a `shortlist_creator` draft change, which
 * `previewVendorDecisionsFromDraft` projects as
 * `vendorDecisions[creatorId] = "shortlisted"`. That projection IS the
 * selection, and it is what Apply commits and what the linked Discovery
 * shortlist already reflects. Nothing new is stored here.
 *
 * The only state this adds is an OPTIMISTIC overlay: a staged pick has to show
 * on the panel the moment it is clicked, and a server round trip is not a
 * reason to leave the count stale. The overlay is per-creator and is dropped as
 * soon as the real decisions arrive, so it can never disagree with the
 * canonical state for longer than one request.
 */

import type { CampaignCreatorDecision } from "./creator-decision-status";
import { creatorGroupingKey } from "./studio-creator-slate-split";

export type StudioSelectableCreator = {
  id?: string;
  displayName?: string;
  handle?: string;
  platform?: string;
  avatarUrl?: string;
};

export type StudioSelectedCreator = {
  /** Canonical creator id, as the campaign stores it. */
  creatorId: string;
  displayName: string;
  handle?: string;
  platform?: string;
  avatarUrl?: string;
  /** True while the server action for this creator is still running. */
  pending: boolean;
};

/** Per-creator optimistic intent, pending the server's answer. */
export type StudioSelectionOverlay = Record<string, "selected" | "removed">;

export function withOptimisticSelection(
  overlay: StudioSelectionOverlay,
  creatorId: string,
  intent: "selected" | "removed"
): StudioSelectionOverlay {
  const key = creatorGroupingKey(creatorId);
  if (!key) return overlay;
  return { ...overlay, [key]: intent };
}

/** Drop an optimistic entry once the canonical decisions have caught up. */
export function withoutOptimisticSelection(
  overlay: StudioSelectionOverlay,
  creatorId: string
): StudioSelectionOverlay {
  const key = creatorGroupingKey(creatorId);
  if (!(key in overlay)) return overlay;
  const next = { ...overlay };
  delete next[key];
  return next;
}

/**
 * Is this creator selected right now?
 *
 * The overlay wins while it exists — that is what makes a click feel immediate
 * — and the canonical decision answers otherwise.
 */
export function isCreatorSelected(input: {
  creatorId: string | null | undefined;
  decisions: Record<string, CampaignCreatorDecision> | undefined;
  overlay?: StudioSelectionOverlay;
}): boolean {
  const key = input.creatorId ? creatorGroupingKey(input.creatorId) : "";
  if (!key) return false;
  const optimistic = input.overlay?.[key];
  if (optimistic) return optimistic === "selected";
  const decisions = input.decisions ?? {};
  for (const [id, decision] of Object.entries(decisions)) {
    if (decision !== "shortlisted") continue;
    if (creatorGroupingKey(id) === key) return true;
  }
  return false;
}

/**
 * The selected creators, in the order their cards render.
 *
 * Identity is the canonical creator id, so one creator cannot appear twice
 * because the slate stored `inf:x` and hydration reported `x`. A creator that
 * is selected but not among the hydrated vendors still counts — it is on the
 * selection — and is listed with the identity the campaign holds.
 */
export function resolveStudioCreatorSelection(input: {
  /** Hydrated creators, in render order. */
  vendors: StudioSelectableCreator[];
  decisions: Record<string, CampaignCreatorDecision> | undefined;
  overlay?: StudioSelectionOverlay;
  /** Creator ids whose server action is still running. */
  pendingIds?: string[];
}): StudioSelectedCreator[] {
  const pending = new Set((input.pendingIds ?? []).map(creatorGroupingKey).filter(Boolean));
  const selected: StudioSelectedCreator[] = [];
  const seen = new Set<string>();

  for (const vendor of input.vendors) {
    if (!vendor.id) continue;
    const key = creatorGroupingKey(vendor.id);
    if (!key || seen.has(key)) continue;
    if (!isCreatorSelected({ creatorId: vendor.id, decisions: input.decisions, overlay: input.overlay })) {
      continue;
    }
    seen.add(key);
    selected.push({
      creatorId: vendor.id,
      displayName: vendor.displayName?.trim() || vendor.handle?.trim() || vendor.id,
      handle: vendor.handle,
      platform: vendor.platform,
      avatarUrl: vendor.avatarUrl,
      pending: pending.has(key),
    });
  }

  // Selected ids with no hydrated card — still on the selection, still counted.
  for (const [id, decision] of Object.entries(input.decisions ?? {})) {
    if (decision !== "shortlisted") continue;
    const key = creatorGroupingKey(id);
    if (!key || seen.has(key)) continue;
    if (input.overlay?.[key] === "removed") continue;
    seen.add(key);
    selected.push({ creatorId: id, displayName: id, pending: pending.has(key) });
  }

  return selected;
}

/**
 * The name a generated shortlist is stored under.
 *
 * A campaign name is optional and must never block generation — the existing
 * action already falls back to a fixed reference label, and this states that
 * policy in one place so the dialog and the action cannot disagree. Nothing is
 * invented: with no campaign name the shortlist carries the product's own
 * reference label, not a fabricated campaign.
 */
export const STUDIO_SHORTLIST_FALLBACK_NAME = "Campaign Studio shortlist";

export function resolveGeneratedShortlistName(campaignName?: string | null): string {
  const trimmed = campaignName?.trim();
  return trimmed ? `${trimmed} — Studio picks` : STUDIO_SHORTLIST_FALLBACK_NAME;
}

/** Generation is gated on having creators, never on having a campaign name. */
export function canGenerateShortlist(input: {
  selectedCount: number;
  generating: boolean;
}): boolean {
  return input.selectedCount > 0 && !input.generating;
}
