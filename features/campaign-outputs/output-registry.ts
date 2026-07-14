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
  CampaignOutputContent,
  CampaignOutputGroup,
  CampaignOutputInputKey,
  CampaignOutputKind,
  CampaignOutputOrigin,
  CampaignOutputRecord,
  CampaignOutputRegistryState,
  CampaignOutputStaleReason,
  CampaignOutputStatus,
  CampaignOutputVersionSnapshot,
} from "./output-types";
import { OUTPUT_CATALOG, INPUT_KEY_LABELS, getOutputDefinition } from "./output-catalog";
import {
  computeInputFingerprints,
  computeSourceFingerprint,
  CampaignInputCache,
} from "./output-fingerprint";
import { describeInputsChanged } from "./output-stale-reason";
import { resolveSlate } from "./output-inputs";
import {
  enrichMediaPlanCampaignContext,
  enrichMediaPlanFromSlate,
  type MediaPlanData,
} from "./generators/media-plan";

/** Prior versions kept per output for compare / restore / history. */
const MAX_OUTPUT_HISTORY = 12;

function enrichMediaPlanForDisplay(
  data: MediaPlanData,
  campaignObject: CampaignObject
): MediaPlanData {
  return enrichMediaPlanCampaignContext(
    enrichMediaPlanFromSlate(data, resolveSlate(campaignObject)),
    campaignObject
  );
}

let mediaPlanEnrichCacheKey: string | null = null;
let mediaPlanEnrichCacheResult: MediaPlanData | null = null;

function mediaPlanDisplayEnrichKey(
  campaignObject: CampaignObject,
  record: CampaignOutputRecord,
  raw: MediaPlanData
): string {
  const commercials = campaignObject.meta.quotationCommercials;
  const inputCache = new CampaignInputCache(campaignObject);
  return [
    record.version,
    record.updatedAt,
    record.sourceFingerprint,
    record.generatorVersion,
    campaignObject.updatedAt,
    commercials?.syncedAt ?? "",
    commercials?.clientName ?? "",
    commercials?.brandName ?? "",
    commercials?.groupName ?? "",
    commercials?.agencyName ?? "",
    inputCache.inputFingerprint("creators"),
    inputCache.inputFingerprint("budget"),
    inputCache.inputFingerprint("timeline"),
    raw.generatorVersion,
    raw.durationWeeks,
    raw.creatorCount,
  ].join("|");
}

function enrichMediaPlanForDisplayCached(
  data: MediaPlanData,
  campaignObject: CampaignObject,
  record: CampaignOutputRecord
): MediaPlanData {
  const key = mediaPlanDisplayEnrichKey(campaignObject, record, data);
  if (mediaPlanEnrichCacheKey === key && mediaPlanEnrichCacheResult) {
    return mediaPlanEnrichCacheResult;
  }
  const enriched = enrichMediaPlanForDisplay(data, campaignObject);
  mediaPlanEnrichCacheKey = key;
  mediaPlanEnrichCacheResult = enriched;
  return enriched;
}

function estimateSizeBytes(record: Pick<CampaignOutputRecord, "content">): number {
  try {
    return JSON.stringify(record.content ?? {}).length;
  } catch {
    return 0;
  }
}

function snapshotOf(record: CampaignOutputRecord): CampaignOutputVersionSnapshot {
  return {
    version: record.version,
    generatedAt: record.generatedAt,
    updatedAt: record.updatedAt,
    sourceFingerprint: record.sourceFingerprint,
    generatorVersion: record.generatorVersion,
    changeReason: record.changeReason,
    changedInputs: record.changedInputs,
    origin: record.origin,
    content: record.content,
  };
}

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
  /** Metadata-driven Outputs Center group. */
  group: CampaignOutputGroup;
  status: CampaignOutputStatus;
  version: number;
  generatedAt?: string;
  updatedAt?: string;
  generatorVersion?: string;
  origin?: CampaignOutputOrigin;
  sizeBytes?: number;
  estimatedGenerationMs: number;
  /** Human labels of the campaign inputs this output derives from. */
  sourceData: string[];
  dependencies: string[];
  /** Precise reason when status is needs_update — never generic. */
  staleReason?: string;
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
  const inputCache = new CampaignInputCache(campaignObject);
  return OUTPUT_CATALOG.map((definition) => {
    const record = state[definition.kind];
    const fingerprint = inputCache.fingerprint(definition.inputKeys);
    const status = liveStatus(record, fingerprint);
    const sourceData = definition.inputKeys.map((key: CampaignOutputInputKey) => INPUT_KEY_LABELS[key]);
    const staleReason =
      status === "needs_update"
        ? describeStaleReason(campaignObject, definition.kind)?.reason
        : undefined;
    return {
      kind: definition.kind,
      label: definition.label,
      description: definition.description,
      category: definition.category,
      group: definition.group,
      status,
      version: record?.version ?? 0,
      generatedAt: record?.generatedAt,
      updatedAt: record?.updatedAt,
      generatorVersion: record?.generatorVersion ?? definition.generatorVersion,
      origin: record?.origin,
      sizeBytes: record?.sizeBytes,
      estimatedGenerationMs: definition.estimatedGenerationMs,
      sourceData,
      dependencies: sourceData,
      staleReason,
      generatable: typeof definition.generate === "function",
    };
  });
}

/** Outputs grouped for the Center, in group order, with per-group ordering preserved. */
export function listCampaignOutputsByGroup(
  campaignObject: CampaignObject
): Array<{ group: CampaignOutputGroup; outputs: OutputView[] }> {
  const views = listCampaignOutputs(campaignObject);
  const order: CampaignOutputGroup[] = ["strategy", "planning", "client", "internal"];
  return order.map((group) => ({ group, outputs: views.filter((v) => v.group === group) }));
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

/** Render-ready output content — uses cached views; regenerates only when stale or version-mismatched. */
export function getOutputContentForDisplay(
  campaignObject: CampaignObject,
  kind: CampaignOutputKind
): CampaignOutputContent | undefined {
  const record = getCampaignOutput(campaignObject, kind);
  if (!record) return undefined;

  const definition = getOutputDefinition(kind);
  if (!definition?.generate) return record.content;

  const needsLiveRender =
    record.status === "needs_update" ||
    record.generatorVersion !== definition.generatorVersion;

  if (needsLiveRender) {
    const content = definition.generate(campaignObject);
    if (kind === "media_plan" && content.data) {
      const enriched = enrichMediaPlanForDisplayCached(
        content.data as unknown as MediaPlanData,
        campaignObject,
        record
      );
      return { ...content, data: enriched as unknown as Record<string, unknown> };
    }
    return content;
  }

  const cached = record.content;
  if (kind === "media_plan" && cached?.data) {
    const enriched = enrichMediaPlanForDisplayCached(
      cached.data as unknown as MediaPlanData,
      campaignObject,
      record
    );
    return { ...cached, data: enriched as unknown as Record<string, unknown> };
  }

  return cached;
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
  options?: { campaignVersion?: number; now?: string; origin?: CampaignOutputOrigin }
): GenerateCampaignOutputResult {
  const definition = getOutputDefinition(kind);
  if (!definition?.generate) {
    throw new Error(`No generator is wired for output "${kind}".`);
  }

  const now = options?.now ?? new Date().toISOString();
  const content = definition.generate(campaignObject);
  const fingerprint = computeSourceFingerprint(campaignObject, definition.inputKeys);
  const inputFingerprints = computeInputFingerprints(campaignObject, definition.inputKeys);
  const state = getCampaignOutputState(campaignObject);
  const previous = state[kind];

  // Why this (re)generation happened: which inputs differ from the prior version.
  const changedInputs = previous?.inputFingerprints
    ? definition.inputKeys.filter(
        (key) => previous.inputFingerprints?.[key] !== inputFingerprints[key]
      )
    : [];
  const changeReason = !previous
    ? "Initial generation."
    : changedInputs.length > 0
      ? describeInputsChanged(changedInputs)
      : "Manual regeneration.";

  const history = previous
    ? [...(previous.history ?? []), snapshotOf(previous)].slice(-MAX_OUTPUT_HISTORY)
    : [];

  const record: CampaignOutputRecord = {
    kind,
    status: "generated",
    version: (previous?.version ?? 0) + 1,
    generatedAt: previous?.generatedAt ?? now,
    updatedAt: now,
    campaignVersion: options?.campaignVersion,
    sourceFingerprint: fingerprint,
    inputFingerprints,
    generatorVersion: definition.generatorVersion,
    origin: options?.origin ?? "copilot",
    sizeBytes: estimateSizeBytes({ content }),
    changeReason,
    changedInputs,
    history,
    content,
  };

  const nextState: CampaignOutputRegistryState = { ...state, [kind]: record };
  return { campaignObject: withOutputState(campaignObject, nextState), record };
}

/**
 * Why a generated output is stale, named precisely from per-input fingerprint
 * diffs — "Creator slate changed", "Budget changed", never a generic message.
 * Returns undefined for outputs that are up to date or not generated.
 */
export function describeStaleReason(
  campaignObject: CampaignObject,
  kind: CampaignOutputKind
): CampaignOutputStaleReason | undefined {
  const record = getCampaignOutputState(campaignObject)[kind];
  const definition = getOutputDefinition(kind);
  if (!record || record.status !== "generated" || !definition) return undefined;

  const current = computeInputFingerprints(campaignObject, definition.inputKeys);
  const staleInputs = definition.inputKeys.filter(
    (key) => record.inputFingerprints?.[key] !== current[key]
  );
  if (staleInputs.length === 0) return undefined;
  return { staleInputs, reason: describeInputsChanged(staleInputs) };
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

/**
 * Regenerate every output whose inputs changed — keeps stored views in sync with
 * the Campaign Object without waiting for manual Copilot commands.
 */
export function regenerateStaleCampaignOutputs(
  campaignObject: CampaignObject,
  options?: { origin?: CampaignOutputOrigin }
): CampaignObject {
  let next = campaignObject;
  for (const kind of staleCampaignOutputKinds(next)) {
    ({ campaignObject: next } = generateCampaignOutput(next, kind, {
      origin: options?.origin ?? "automatic",
    }));
  }
  return next;
}

// ---------------------------------------------------------------------------
// Per-output version history: compare + restore. These operate on view
// snapshots only — the Campaign Object stays the single source of truth.
// ---------------------------------------------------------------------------

/** All versions of an output (history + current), ascending by version. */
export function getOutputVersions(
  campaignObject: CampaignObject,
  kind: CampaignOutputKind
): CampaignOutputVersionSnapshot[] {
  const record = getCampaignOutputState(campaignObject)[kind];
  if (!record) return [];
  return [...(record.history ?? []), snapshotOf(record)].sort((a, b) => a.version - b.version);
}

export type OutputVersionDiff = {
  fromVersion: number;
  toVersion: number;
  addedSections: string[];
  removedSections: string[];
  changedSections: string[];
  /** Why the newer version was (re)generated. */
  reason?: string;
};

function sectionMap(snapshot: CampaignOutputVersionSnapshot): Map<string, string> {
  const map = new Map<string, string>();
  for (const section of snapshot.content?.sections ?? []) {
    map.set(section.heading, JSON.stringify({ body: section.body, items: section.items, table: section.table }));
  }
  return map;
}

/**
 * Compare two versions of an output. Defaults to the last two versions — for
 * "compare the last two versions". Returns a deterministic section-level diff.
 */
export function compareOutputVersions(
  campaignObject: CampaignObject,
  kind: CampaignOutputKind,
  versions?: { from?: number; to?: number }
): OutputVersionDiff | undefined {
  const all = getOutputVersions(campaignObject, kind);
  if (all.length < 2) return undefined;

  const to = versions?.to ? all.find((v) => v.version === versions.to) : all[all.length - 1];
  const from = versions?.from
    ? all.find((v) => v.version === versions.from)
    : all[all.length - 2];
  if (!from || !to) return undefined;

  const fromSections = sectionMap(from);
  const toSections = sectionMap(to);

  const addedSections: string[] = [];
  const changedSections: string[] = [];
  for (const [heading, value] of toSections) {
    if (!fromSections.has(heading)) addedSections.push(heading);
    else if (fromSections.get(heading) !== value) changedSections.push(heading);
  }
  const removedSections = [...fromSections.keys()].filter((heading) => !toSections.has(heading));

  return {
    fromVersion: from.version,
    toVersion: to.version,
    addedSections,
    removedSections,
    changedSections,
    reason: to.changeReason,
  };
}

/**
 * Restore an earlier version as a new current version (forward-restore — history
 * is preserved, never rewritten). The restored content is re-stamped with a
 * fresh fingerprint of the *current* inputs, so status reflects reality.
 */
export function restoreOutputVersion(
  campaignObject: CampaignObject,
  kind: CampaignOutputKind,
  version: number,
  options?: { now?: string; origin?: CampaignOutputOrigin }
): GenerateCampaignOutputResult | undefined {
  const definition = getOutputDefinition(kind);
  const state = getCampaignOutputState(campaignObject);
  const current = state[kind];
  if (!definition || !current) return undefined;

  const all = getOutputVersions(campaignObject, kind);
  const target = all.find((v) => v.version === version);
  if (!target?.content) return undefined;

  const now = options?.now ?? new Date().toISOString();
  const fingerprint = computeSourceFingerprint(campaignObject, definition.inputKeys);
  const inputFingerprints = computeInputFingerprints(campaignObject, definition.inputKeys);
  const history = [...(current.history ?? []), snapshotOf(current)].slice(-MAX_OUTPUT_HISTORY);

  const record: CampaignOutputRecord = {
    kind,
    status: "generated",
    version: current.version + 1,
    generatedAt: current.generatedAt ?? now,
    updatedAt: now,
    sourceFingerprint: fingerprint,
    inputFingerprints,
    generatorVersion: definition.generatorVersion,
    origin: options?.origin ?? "user",
    sizeBytes: estimateSizeBytes({ content: target.content }),
    changeReason: `Restored version ${version}.`,
    changedInputs: [],
    history,
    content: target.content,
  };

  const nextState: CampaignOutputRegistryState = { ...state, [kind]: record };
  return { campaignObject: withOutputState(campaignObject, nextState), record };
}
