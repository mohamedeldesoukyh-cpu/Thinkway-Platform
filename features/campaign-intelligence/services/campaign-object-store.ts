import { randomUUID } from "crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

import { CampaignObjectPersistenceService } from "./campaign-object-persistence";
import type {
  CampaignObject,
  CampaignObjectSnapshot,
  CampaignObjectSections,
  CampaignSection,
} from "../types/campaign-object";
import { createEmptyCampaignObject } from "./section-updaters";

function stringifySectionContent(content: CampaignSection["content"]): string {
  if (typeof content === "string") return content;
  try {
    return JSON.stringify(content);
  } catch {
    return "[structured content]";
  }
}

function normalizeSectionsForSnapshot(
  sections: CampaignObjectSections
): CampaignObjectSections {
  return Object.fromEntries(
    Object.entries(sections).map(([key, section]) => [
      key,
      {
        ...section,
        content: stringifySectionContent(section.content),
      },
    ])
  ) as CampaignObjectSections;
}

const CONTEXT_SNAPSHOT_KEY = "campaignObject";

/** In-memory cache keyed by conversation id. */
const memoryStore = new Map<string, CampaignObject>();

export type SaveCampaignObjectOptions = {
  supabase?: SupabaseClient<Database>;
  userId?: string;
  campaignHeaderId?: string | null;
  persistToDb?: boolean;
  saveReason?: "task_complete" | "workflow_complete" | "manual";
};

export function getCampaignObjectFromSnapshot(
  contextSnapshot?: Record<string, unknown>
): CampaignObject | null {
  const raw = contextSnapshot?.[CONTEXT_SNAPSHOT_KEY];
  if (!raw || typeof raw !== "object") return null;
  return deserializeCampaignObject(raw as CampaignObjectSnapshot);
}

export function attachCampaignObjectToSnapshot(
  contextSnapshot: Record<string, unknown>,
  campaignObject: CampaignObject
): Record<string, unknown> {
  return {
    ...contextSnapshot,
    [CONTEXT_SNAPSHOT_KEY]: serializeCampaignObject(campaignObject),
  };
}

export function getOrLoadCampaignObject(
  conversationId: string,
  contextSnapshot?: Record<string, unknown>
): CampaignObject | null {
  const cached = memoryStore.get(conversationId);
  if (cached) return cached;

  const fromSnapshot = getCampaignObjectFromSnapshot(contextSnapshot);
  if (fromSnapshot) {
    memoryStore.set(conversationId, fromSnapshot);
    return fromSnapshot;
  }

  return null;
}

export async function loadCampaignObjectForConversation(
  supabase: SupabaseClient<Database>,
  conversationId: string,
  contextSnapshot?: Record<string, unknown>
): Promise<CampaignObject | null> {
  const cached = memoryStore.get(conversationId);
  if (cached) return cached;

  const restored = await CampaignObjectPersistenceService.restoreForConversation(
    supabase,
    conversationId,
    contextSnapshot
  );

  if (restored) {
    memoryStore.set(conversationId, restored);
    return restored;
  }

  return getOrLoadCampaignObject(conversationId, contextSnapshot);
}

export function getOrCreateCampaignObject(input: {
  conversationId: string;
  workflowId: string;
  contextSnapshot?: Record<string, unknown>;
  inferredFields?: string[];
}): CampaignObject {
  const existing = getOrLoadCampaignObject(input.conversationId, input.contextSnapshot);
  if (existing && existing.workflowId === input.workflowId) {
    return existing;
  }

  const created = createEmptyCampaignObject({
    id: randomUUID(),
    conversationId: input.conversationId,
    workflowId: input.workflowId,
    inferredFields: input.inferredFields,
  });

  memoryStore.set(input.conversationId, created);
  return created;
}

export async function saveCampaignObject(
  conversationId: string,
  campaignObject: CampaignObject,
  options?: SaveCampaignObjectOptions
): Promise<CampaignObject> {
  const updated = {
    ...campaignObject,
    conversationId,
    updatedAt: new Date().toISOString(),
  };
  memoryStore.set(conversationId, updated);

  if (
    options?.persistToDb &&
    options.supabase &&
    options.userId
  ) {
    try {
      await CampaignObjectPersistenceService.saveVersion(options.supabase, {
        campaignObject: updated,
        conversationId,
        userId: options.userId,
        campaignHeaderId: options.campaignHeaderId,
        saveReason: options.saveReason ?? "manual",
      });
    } catch (error) {
      // Task autosave must not block workflow progress; workflow_complete must surface errors.
      const message = error instanceof Error ? error.message : String(error);
      if (options.saveReason === "workflow_complete" || options.saveReason === "manual") {
        throw new Error(`Campaign object persistence failed: ${message}`);
      }
      console.error("[campaign-object-store] autosave failed:", message);
    }
  }

  return updated;
}

export function clearCampaignObjectMemory(conversationId?: string): void {
  if (conversationId) {
    memoryStore.delete(conversationId);
    return;
  }
  memoryStore.clear();
}

export function serializeCampaignObject(
  campaignObject: CampaignObject
): CampaignObjectSnapshot {
  return {
    id: campaignObject.id,
    conversationId: campaignObject.conversationId,
    workflowId: campaignObject.workflowId,
    updatedAt: campaignObject.updatedAt,
    sections: normalizeSectionsForSnapshot(campaignObject.sections),
    meta: campaignObject.meta,
  };
}

export function deserializeCampaignObject(
  snapshot: CampaignObjectSnapshot
): CampaignObject {
  return {
    id: snapshot.id,
    conversationId: snapshot.conversationId,
    workflowId: snapshot.workflowId,
    updatedAt: snapshot.updatedAt,
    sections: snapshot.sections,
    meta: snapshot.meta,
  };
}

/** Snapshots stringify structured section content — revive JSON for export resolvers. */
function reviveSectionContent(content: CampaignSection["content"]): CampaignSection["content"] {
  if (typeof content !== "string") return content;
  const trimmed = content.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return content;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>;
    }
  } catch {
    /* keep markdown/text content */
  }
  return content;
}

/** Restore structured section payloads before running studio export resolvers. */
export function reviveCampaignObjectForExport(
  snapshot: CampaignObjectSnapshot
): CampaignObject {
  const base = deserializeCampaignObject(snapshot);
  return {
    ...base,
    sections: Object.fromEntries(
      Object.entries(base.sections).map(([key, section]) => [
        key,
        {
          ...section,
          content: reviveSectionContent(section.content),
        },
      ])
    ) as CampaignObjectSections,
  };
}

export function isAutosaveTaskStatus(status: string): boolean {
  return status === "completed" || status === "awaiting_approval";
}

export { CONTEXT_SNAPSHOT_KEY };
