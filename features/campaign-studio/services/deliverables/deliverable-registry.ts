/**
 * Deliverable registry — pure state helpers over `CampaignObjectMeta.deliverables`.
 *
 * The registry never duplicates campaign data. It stores, per deliverable, a
 * generation record (status, version, timestamps, source fingerprint, cached
 * rendered view). All authoritative data still lives in the Campaign Object's
 * sections/facts; deliverables are generated views over it.
 *
 * Staleness is computed by comparing a deliverable's stored fingerprint against
 * a freshly computed one — so "Needs Update" propagates precisely to the
 * deliverables that depend on a changed input, and to no others.
 */

import type { CampaignObject } from "@/features/campaign-intelligence";

import type {
  DeliverableInputKey,
  DeliverableKind,
  DeliverableRecord,
  DeliverableRegistryState,
  DeliverableStatus,
} from "./deliverable-types";
import {
  DELIVERABLE_CATALOG,
  INPUT_KEY_LABELS,
  getDeliverableDefinition,
} from "./deliverable-catalog";
import { computeSourceFingerprint } from "./deliverable-fingerprint";

export function getDeliverableState(campaignObject: CampaignObject): DeliverableRegistryState {
  return campaignObject.meta.deliverables ?? {};
}

function withDeliverableState(
  campaignObject: CampaignObject,
  state: DeliverableRegistryState
): CampaignObject {
  return {
    ...campaignObject,
    meta: { ...campaignObject.meta, deliverables: state },
  };
}

/** The live status of a stored record: a generated record whose inputs changed is stale. */
function liveStatus(
  record: DeliverableRecord | undefined,
  currentFingerprint: string
): DeliverableStatus {
  if (!record || record.status === "not_generated") return "not_generated";
  if (record.status === "generated" && record.sourceFingerprint !== currentFingerprint) {
    return "needs_update";
  }
  return record.status;
}

export type DeliverableView = {
  kind: DeliverableKind;
  label: string;
  description: string;
  category: string;
  status: DeliverableStatus;
  version: number;
  generatedAt?: string;
  updatedAt?: string;
  /** Human labels of the campaign inputs this deliverable derives from. */
  sourceData: string[];
  /** True when a deterministic generator is wired for this kind. */
  generatable: boolean;
};

/**
 * List every catalog deliverable merged with its stored record and *live* status.
 * Backward compatible: a Campaign Object with no `meta.deliverables` lists all
 * deliverables as "Not Generated".
 */
export function listDeliverables(campaignObject: CampaignObject): DeliverableView[] {
  const state = getDeliverableState(campaignObject);
  return DELIVERABLE_CATALOG.map((definition) => {
    const record = state[definition.kind];
    const fingerprint = computeSourceFingerprint(campaignObject, definition.inputKeys);
    const status = liveStatus(record, fingerprint);
    return {
      kind: definition.kind,
      label: definition.label,
      description: definition.description,
      category: definition.category,
      status,
      version: record?.version ?? 0,
      generatedAt: record?.generatedAt,
      updatedAt: record?.updatedAt,
      sourceData: definition.inputKeys.map((key: DeliverableInputKey) => INPUT_KEY_LABELS[key]),
      generatable: typeof definition.generate === "function",
    };
  });
}

/** The stored record for one deliverable, with its live status resolved. */
export function getDeliverable(
  campaignObject: CampaignObject,
  kind: DeliverableKind
): DeliverableRecord | undefined {
  const record = getDeliverableState(campaignObject)[kind];
  if (!record) return undefined;
  const definition = getDeliverableDefinition(kind);
  if (!definition) return record;
  const fingerprint = computeSourceFingerprint(campaignObject, definition.inputKeys);
  return { ...record, status: liveStatus(record, fingerprint) };
}

export type GenerateDeliverableResult = {
  campaignObject: CampaignObject;
  record: DeliverableRecord;
};

/**
 * Generate (or regenerate) a deliverable: run its deterministic generator, store
 * the rendered view + a fresh fingerprint, and bump the deliverable version.
 * Returns the change or throws if no generator is wired for the kind.
 */
export function generateDeliverable(
  campaignObject: CampaignObject,
  kind: DeliverableKind,
  options?: { campaignVersion?: number; now?: string }
): GenerateDeliverableResult {
  const definition = getDeliverableDefinition(kind);
  if (!definition?.generate) {
    throw new Error(`No generator is wired for deliverable "${kind}".`);
  }

  const now = options?.now ?? new Date().toISOString();
  const content = definition.generate(campaignObject);
  const fingerprint = computeSourceFingerprint(campaignObject, definition.inputKeys);
  const state = getDeliverableState(campaignObject);
  const previous = state[kind];

  const record: DeliverableRecord = {
    kind,
    status: "generated",
    version: (previous?.version ?? 0) + 1,
    generatedAt: previous?.generatedAt ?? now,
    updatedAt: now,
    campaignVersion: options?.campaignVersion,
    sourceFingerprint: fingerprint,
    content,
  };

  const nextState: DeliverableRegistryState = { ...state, [kind]: record };
  return { campaignObject: withDeliverableState(campaignObject, nextState), record };
}

/**
 * Recompute fingerprints for every *generated* deliverable and flip the ones
 * whose inputs changed to "Needs Update". Idempotent — returns the same object
 * (by value) when nothing changed. Call this after any Copilot edit that mutates
 * campaign inputs; the dependency graph keeps regeneration precise.
 */
export function markStaleDeliverables(campaignObject: CampaignObject): CampaignObject {
  const state = getDeliverableState(campaignObject);
  const kinds = Object.keys(state) as DeliverableKind[];
  if (kinds.length === 0) return campaignObject;

  let changed = false;
  const nextState: DeliverableRegistryState = { ...state };

  for (const kind of kinds) {
    const record = state[kind];
    if (!record || record.status !== "generated") continue;
    const definition = getDeliverableDefinition(kind);
    if (!definition) continue;
    const fingerprint = computeSourceFingerprint(campaignObject, definition.inputKeys);
    if (fingerprint !== record.sourceFingerprint) {
      nextState[kind] = { ...record, status: "needs_update" };
      changed = true;
    }
  }

  return changed ? withDeliverableState(campaignObject, nextState) : campaignObject;
}

/** The kinds that currently need regeneration — for "regenerate everything affected". */
export function staleDeliverableKinds(campaignObject: CampaignObject): DeliverableKind[] {
  return listDeliverables(campaignObject)
    .filter((view) => view.status === "needs_update")
    .map((view) => view.kind);
}
