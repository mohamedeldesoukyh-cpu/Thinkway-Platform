/**
 * Output Registry — pure state helpers over `CampaignObjectMeta.campaignOutputs`.
 *
 * The registry never duplicates campaign data. It stores, per output, a
 * generation record (status, version, timestamps, source fingerprint, generator
 * version, cached rendered view). All authoritative data still lives in the
 * Campaign Object's sections/facts; outputs are generated views over it.
 *
 * Staleness is computed by comparing a stored fingerprint against a freshly
 * computed one — so "Needs Update" propagates precisely to the outputs that
 * depend on a changed input, and to no others.
 */

import type { CampaignObject } from "@/features/campaign-intelligence";

import type {
  CampaignOutputInputKey,
  CampaignOutputKind,
  CampaignOutputRecord,
  CampaignOutputRegistryState,
  CampaignOutputStatus,
} from "./output-types";
import { OUTPUT_CATALOG, INPUT_KEY_LABELS, getOutputDefinition } from "./output-catalog";
import { computeSourceFingerprint } from "./output-fingerprint";

export function getCampaignOutputState(campaignObject: CampaignObject): CampaignOutputRegistryState {
  return campaignObject.meta.campaignOutputs ?? {};
}

function withOutputState(
  campaignObject: CampaignObject,
  state: CampaignOutputRegistryState
): CampaignObject {
  return { ...campaignObject, meta: { ...campaignObject.meta, campaignOutputs: state } };
}

/** The live status of a stored record: a generated record whose inputs changed is stale. */
function liveStatus(
  record: CampaignOutputRecord | undefined,
  currentFingerprint: string
): CampaignOutputStatus {
  if (!record || record.status === "not_generated") return "not_generated";
  if (record.status === "generated" && record.sourceFingerprint !== currentFingerprint) {
    return "needs_update";
  }
  return record.status;
}

export type OutputView = {
  kind: CampaignOutputKind;
  label: string;
  description: string;
  category: string;
  status: CampaignOutputStatus;
  version: number;
  generatedAt?: string;
  updatedAt?: string;
  generatorVersion?: string;
  /** Human labels of the campaign inputs this output derives from. */
  sourceData: string[];
  dependencies: string[];
  /** True when a deterministic generator is wired for this kind. */
  generatable: boolean;
};

/**
 * List every catalog output merged with its stored record and *live* status.
 * Backward compatible: a Campaign Object with no `meta.campaignOutputs` lists all
 * outputs as "Not Generated".
 */
export function listCampaignOutputs(campaignObject: CampaignObject): OutputView[] {
  const state = getCampaignOutputState(campaignObject);
  return OUTPUT_CATALOG.map((definition) => {
    const record = state[definition.kind];
    const fingerprint = computeSourceFingerprint(campaignObject, definition.inputKeys);
    const status = liveStatus(record, fingerprint);
    const sourceData = definition.inputKeys.map((key: CampaignOutputInputKey) => INPUT_KEY_LABELS[key]);
    return {
      kind: definition.kind,
      label: definition.label,
      description: definition.description,
      category: definition.category,
      status,
      version: record?.version ?? 0,
      generatedAt: record?.generatedAt,
      updatedAt: record?.updatedAt,
      generatorVersion: record?.generatorVersion ?? definition.generatorVersion,
      sourceData,
      dependencies: sourceData,
      generatable: typeof definition.generate === "function",
    };
  });
}

/** The stored record for one output, with its live status resolved. */
export function getCampaignOutput(
  campaignObject: CampaignObject,
  kind: CampaignOutputKind
): CampaignOutputRecord | undefined {
  const record = getCampaignOutputState(campaignObject)[kind];
  if (!record) return undefined;
  const definition = getOutputDefinition(kind);
  if (!definition) return record;
  const fingerprint = computeSourceFingerprint(campaignObject, definition.inputKeys);
  return { ...record, status: liveStatus(record, fingerprint) };
}

export type GenerateCampaignOutputResult = {
  campaignObject: CampaignObject;
  record: CampaignOutputRecord;
};

/**
 * Generate (or regenerate) an output: run its deterministic generator, store the
 * rendered view + a fresh fingerprint + the generator version, and bump the
 * output version. Throws if no generator is wired for the kind.
 */
export function generateCampaignOutput(
  campaignObject: CampaignObject,
  kind: CampaignOutputKind,
  options?: { campaignVersion?: number; now?: string }
): GenerateCampaignOutputResult {
  const definition = getOutputDefinition(kind);
  if (!definition?.generate) {
    throw new Error(`No generator is wired for output "${kind}".`);
  }

  const now = options?.now ?? new Date().toISOString();
  const content = definition.generate(campaignObject);
  const fingerprint = computeSourceFingerprint(campaignObject, definition.inputKeys);
  const state = getCampaignOutputState(campaignObject);
  const previous = state[kind];

  const record: CampaignOutputRecord = {
    kind,
    status: "generated",
    version: (previous?.version ?? 0) + 1,
    generatedAt: previous?.generatedAt ?? now,
    updatedAt: now,
    campaignVersion: options?.campaignVersion,
    sourceFingerprint: fingerprint,
    generatorVersion: definition.generatorVersion,
    content,
  };

  const nextState: CampaignOutputRegistryState = { ...state, [kind]: record };
  return { campaignObject: withOutputState(campaignObject, nextState), record };
}

/**
 * Recompute fingerprints for every *generated* output and flip the ones whose
 * inputs changed to "Needs Update". Idempotent — returns the same object (by
 * reference) when nothing changed. Call this after any Copilot edit that mutates
 * campaign inputs; the dependency graph keeps regeneration precise.
 */
export function markStaleCampaignOutputs(campaignObject: CampaignObject): CampaignObject {
  const state = getCampaignOutputState(campaignObject);
  const kinds = Object.keys(state) as CampaignOutputKind[];
  if (kinds.length === 0) return campaignObject;

  let changed = false;
  const nextState: CampaignOutputRegistryState = { ...state };

  for (const kind of kinds) {
    const record = state[kind];
    if (!record || record.status !== "generated") continue;
    const definition = getOutputDefinition(kind);
    if (!definition) continue;
    const fingerprint = computeSourceFingerprint(campaignObject, definition.inputKeys);
    if (fingerprint !== record.sourceFingerprint) {
      nextState[kind] = { ...record, status: "needs_update" };
      changed = true;
    }
  }

  return changed ? withOutputState(campaignObject, nextState) : campaignObject;
}

/** The kinds that currently need regeneration — for "regenerate everything affected". */
export function staleCampaignOutputKinds(campaignObject: CampaignObject): CampaignOutputKind[] {
  return listCampaignOutputs(campaignObject)
    .filter((view) => view.status === "needs_update")
    .map((view) => view.kind);
}
