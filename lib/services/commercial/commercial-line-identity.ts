/**
 * Immutable Commercial Line Identity + registry helpers.
 * Spec: docs/architecture/COMMERCIAL_SSOT_QUOTE_CAMPAIGN.md §2
 *
 * Commercial Line ID = quotation_items.id
 * Assignment Origin = campaign_lines.source_quotation_item_id
 * Join key for sync — never row position or copied values.
 */

import type {
  CommercialLineId,
  CommercialLineRegistryEntry,
} from "./types";

export function asCommercialLineId(quotationItemId: string): CommercialLineId {
  const id = quotationItemId?.trim();
  if (!id) {
    throw new Error("Commercial Line ID requires a non-empty quotation item id");
  }
  return id;
}

/** Origin Commercial Line ID from an Assignment row (null if not quote-sourced). */
export function originCommercialLineId(
  assignment: { source_quotation_item_id?: string | null }
): CommercialLineId | null {
  const raw = assignment.source_quotation_item_id;
  if (!raw || !String(raw).trim()) return null;
  return String(raw).trim();
}

/**
 * Build a registry entry from a quotation item + zero or more Assignments
 * that share the same Origin. Supports 1:N.
 */
export function buildRegistryEntry(input: {
  quotationId: string;
  quotationItemId: string;
  campaignHeaderId?: string | null;
  assignments?: Array<{
    id: string;
    source_quotation_item_id?: string | null;
    campaign_header_id?: string | null;
  }>;
}): CommercialLineRegistryEntry {
  const commercialLineId = asCommercialLineId(input.quotationItemId);
  const peers = (input.assignments ?? []).filter(
    (a) => originCommercialLineId(a) === commercialLineId
  );

  const campaignHeaderId =
    input.campaignHeaderId ??
    peers.find((a) => a.campaign_header_id)?.campaign_header_id ??
    null;

  return {
    commercialLineId,
    quotationId: input.quotationId,
    quotationItemId: commercialLineId,
    campaignHeaderId,
    assignmentIds: peers.map((a) => a.id),
  };
}

/**
 * Index Assignments by Origin Commercial Line ID (1:N).
 * Ignores Assignments without Origin (manual / non-quote lines).
 */
export function indexAssignmentsByCommercialLineId(
  assignments: Array<{
    id: string;
    source_quotation_item_id?: string | null;
  }>
): Map<CommercialLineId, string[]> {
  const map = new Map<CommercialLineId, string[]>();
  for (const assignment of assignments) {
    const cml = originCommercialLineId(assignment);
    if (!cml) continue;
    const list = map.get(cml) ?? [];
    list.push(assignment.id);
    map.set(cml, list);
  }
  return map;
}

/** True when Assignment permanently references the given Commercial Line. */
export function assignmentBelongsToCommercialLine(
  assignment: { source_quotation_item_id?: string | null },
  commercialLineId: CommercialLineId
): boolean {
  return originCommercialLineId(assignment) === commercialLineId;
}

/**
 * Provenance must never be cleared or rewritten on revision / restructure.
 * Phase 1 guard used by sync/write helpers.
 */
export function assertOriginPreserved(input: {
  before: string | null | undefined;
  after: string | null | undefined;
}): { ok: true } | { ok: false; message: string } {
  const before = input.before?.trim() || null;
  const after = input.after?.trim() || null;
  if (before && after && before !== after) {
    return {
      ok: false,
      message:
        "Origin Commercial Line ID is immutable and must not be rewritten",
    };
  }
  if (before && !after) {
    return {
      ok: false,
      message: "Origin Commercial Line ID must not be cleared",
    };
  }
  return { ok: true };
}
