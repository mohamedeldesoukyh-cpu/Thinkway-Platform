import type { AiMessage } from "@/features/ai-workspace/types";
import { isStudioMessage } from "@/features/ai-workspace/components/campaign-studio-panel-utils";
import type { CampaignObject, CampaignObjectSnapshot } from "@/features/campaign-intelligence";
import { deserializeCampaignObject } from "@/features/campaign-intelligence";
import type {
  CampaignOutputKind,
  CampaignOutputRecord,
  CampaignOutputRegistryState,
} from "@/features/campaign-outputs/output-types";

function parseMessageCampaignObject(message: AiMessage): CampaignObject | null {
  const raw = message.metadata?.campaignObject;
  if (!raw || typeof raw !== "object") return null;
  return deserializeCampaignObject(raw as CampaignObjectSnapshot);
}

/** Latest studio message object — often carries output registry before DB catches up. */
export function campaignObjectFromLatestStudioMessage(
  messages: AiMessage[] | undefined
): CampaignObject | null {
  if (!messages?.length) return null;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i]!;
    if (!isStudioMessage(message)) continue;
    const parsed = parseMessageCampaignObject(message);
    if (parsed) return parsed;
  }
  return null;
}

function outputRecordRank(record: CampaignOutputRecord): number {
  const version = record.version ?? 0;
  const statusBoost =
    record.status === "generated" || record.status === "needs_update" ? 1_000_000 : 0;
  return statusBoost + version;
}

/** Union registries — keep the richest record per output kind. */
export function mergeCampaignOutputRegistries(
  ...registries: Array<CampaignOutputRegistryState | undefined>
): CampaignOutputRegistryState {
  const merged: CampaignOutputRegistryState = {};
  for (const registry of registries) {
    if (!registry) continue;
    for (const [kind, record] of Object.entries(registry)) {
      if (!record) continue;
      const key = kind as CampaignOutputKind;
      const existing = merged[key];
      if (!existing || outputRecordRank(record) > outputRecordRank(existing)) {
        merged[key] = record;
      }
    }
  }
  return merged;
}

function pickNewestBaseObject(candidates: CampaignObject[]): CampaignObject {
  return candidates.reduce((newest, candidate) =>
    Date.parse(candidate.updatedAt) >= Date.parse(newest.updatedAt) ? candidate : newest
  );
}

/**
 * Merge DB/memory, latest studio message, and the bound message into one object
 * for brief edits — preserves generated outputs that may only exist on messages.
 */
export function resolveCampaignObjectForBriefEdit(input: {
  fromPersistence?: CampaignObject | null;
  fromLatestStudioMessage?: CampaignObject | null;
  fromBoundMessage?: CampaignObject | null;
}): CampaignObject | null {
  const candidates = [
    input.fromPersistence,
    input.fromLatestStudioMessage,
    input.fromBoundMessage,
  ].filter(Boolean) as CampaignObject[];

  if (!candidates.length) return null;

  const base = pickNewestBaseObject(candidates);
  const mergedOutputs = mergeCampaignOutputRegistries(
    ...candidates.map((candidate) => candidate.meta.campaignOutputs)
  );

  const mergedMeta = { ...base.meta, campaignOutputs: mergedOutputs };
  for (const candidate of candidates) {
    if (!mergedMeta.quotationCommercials && candidate.meta.quotationCommercials) {
      mergedMeta.quotationCommercials = candidate.meta.quotationCommercials;
    }
    if (!mergedMeta.mediaPlanSchedule && candidate.meta.mediaPlanSchedule) {
      mergedMeta.mediaPlanSchedule = candidate.meta.mediaPlanSchedule;
    }
    if (!mergedMeta.campaignFacts && candidate.meta.campaignFacts) {
      mergedMeta.campaignFacts = candidate.meta.campaignFacts;
    }
  }

  return { ...base, meta: mergedMeta };
}
