import { PLANNING_CAPABILITIES } from "./capabilities";
import type {
  PlanningCapabilityDefinition,
  PlanningCapabilityId,
  PlanningCapabilityPatch,
  PlanningSessionSlice,
} from "../types/planning-capability";

const BY_ID = new Map<PlanningCapabilityId, PlanningCapabilityDefinition>(
  PLANNING_CAPABILITIES.map((c) => [c.id, c])
);

/**
 * Map patch keys → routing slices.
 * Patch fields are intents applied to Campaign Object — not context-owned state.
 */
function patchKeysToSlices(patch: PlanningCapabilityPatch): PlanningSessionSlice[] {
  const slices: PlanningSessionSlice[] = [];
  const map: Array<[keyof PlanningCapabilityPatch, PlanningSessionSlice]> = [
    ["brief", "brief"],
    ["objectives", "objectives"],
    ["audience", "audience"],
    ["markets", "markets"],
    ["platforms", "platforms"],
    ["budget", "budget"],
    ["kpis", "kpis"],
    ["strategyNarrative", "strategyNarrative"],
    ["presentation", "presentation"],
    ["proposal", "proposal"],
    ["planningStatus", "planningStatus"],
    ["creatorIds", "creatorSlate"],
    ["brandName", "campaign"],
    ["clientName", "campaign"],
  ];
  for (const [key, slice] of map) {
    if (patch[key] !== undefined) slices.push(slice);
  }
  return slices;
}

export function listPlanningCapabilities(): readonly PlanningCapabilityDefinition[] {
  return PLANNING_CAPABILITIES;
}

export function getPlanningCapability(
  id: PlanningCapabilityId
): PlanningCapabilityDefinition {
  const def = BY_ID.get(id);
  if (!def) {
    throw new Error(`Unknown planning capability: ${id}`);
  }
  return def;
}

export function assertCapabilityMayWrite(
  capabilityId: PlanningCapabilityId,
  patch: PlanningCapabilityPatch
): void {
  const def = getPlanningCapability(capabilityId);
  const allowed = new Set(def.writes);
  for (const slice of patchKeysToSlices(patch)) {
    if (!allowed.has(slice)) {
      throw new Error(
        `Planning capability "${capabilityId}" may not write session slice "${slice}".`
      );
    }
  }
}

export function assertCapabilityMayRead(
  capabilityId: PlanningCapabilityId,
  slices: PlanningSessionSlice[]
): void {
  const def = getPlanningCapability(capabilityId);
  const allowed = new Set(def.reads);
  for (const slice of slices) {
    if (!allowed.has(slice)) {
      throw new Error(
        `Planning capability "${capabilityId}" may not read session slice "${slice}".`
      );
    }
  }
}

/** True when no capability declaration imports/depends on another capability id. */
export function assertCapabilityIndependence(): void {
  for (const capability of PLANNING_CAPABILITIES) {
    const blob = JSON.stringify(capability);
    for (const other of PLANNING_CAPABILITIES) {
      if (other.id === capability.id) continue;
      if (blob.includes(`"id":"${other.id}"`)) {
        throw new Error(
          `Capability ${capability.id} must not declare dependency on ${other.id}`
        );
      }
    }
  }
}
