import type { SupabaseClient } from "@supabase/supabase-js";

import { logAuditEvent } from "@/lib/audit/log-audit-event";
import type { Database } from "@/types/database";

import {
  canTransitionLifecycle,
  isValidLifecycleTransition,
} from "./campaign-lifecycle";
import {
  deserializeCampaignObject,
  serializeCampaignObject,
} from "./campaign-object-store";
import type {
  CampaignObjectLifecycleStatus,
  CampaignObjectRecord,
  CampaignObjectVersionMeta,
  CampaignObjectVersionRow,
} from "../types/campaign-lifecycle";
import type { CampaignObject, CampaignObjectSnapshot } from "../types/campaign-object";

type CampaignObjectRow = Database["public"]["Tables"]["campaign_objects"]["Row"];
type CampaignObjectVersionDbRow =
  Database["public"]["Tables"]["campaign_object_versions"]["Row"];

export type SaveCampaignObjectVersionInput = {
  campaignObject: CampaignObject;
  userId: string;
  conversationId: string;
  campaignHeaderId?: string | null;
  saveReason?:
    | "task_complete"
    | "workflow_complete"
    | "manual"
    | "review_submitted"
    | "approved";
};

export type SaveCampaignObjectVersionResult = {
  record: CampaignObjectRecord;
  version: number;
  versionId: string;
};

const VERSION_SAVE_MAX_ATTEMPTS = 3;
const VERSION_UNIQUE_CONSTRAINT = "campaign_object_versions_object_version_key";

/** Serializes version inserts per campaign object within this process. */
const versionSaveQueues = new Map<string, Promise<unknown>>();

function isDuplicateKeyError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "23505") return true;
  return (
    typeof error.message === "string" &&
    error.message.includes(VERSION_UNIQUE_CONSTRAINT)
  );
}

async function runSerializedVersionSave<T>(
  campaignObjectId: string,
  operation: () => Promise<T>
): Promise<T> {
  const previous = versionSaveQueues.get(campaignObjectId) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(operation);
  versionSaveQueues.set(
    campaignObjectId,
    current.then(
      () => undefined,
      () => undefined
    )
  );
  return current;
}

function mapRecord(row: CampaignObjectRow): CampaignObjectRecord {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    campaignHeaderId: row.campaign_header_id,
    workflowId: row.workflow_id,
    lifecycleStatus: row.lifecycle_status as CampaignObjectLifecycleStatus,
    currentVersion: row.current_version,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapVersionMeta(row: CampaignObjectVersionDbRow): CampaignObjectVersionMeta {
  return {
    id: row.id,
    campaignObjectId: row.campaign_object_id,
    version: row.version,
    workflowId: row.workflow_id,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
  };
}

export class CampaignObjectPersistenceService {
  static async ensureHeadRecord(
    supabase: SupabaseClient<Database>,
    input: {
      campaignObject: CampaignObject;
      conversationId: string;
      userId: string;
      campaignHeaderId?: string | null;
    }
  ): Promise<CampaignObjectRecord> {
    const { data: existing, error: readError } = await supabase
      .from("campaign_objects")
      .select("*")
      .eq("conversation_id", input.conversationId)
      .maybeSingle();

    if (readError) throw new Error(readError.message);
    if (existing) {
      const mapped = mapRecord(existing as CampaignObjectRow);
      const headerId = input.campaignHeaderId?.trim() || null;
      if (headerId && !mapped.campaignHeaderId) {
        const { error: linkError } = await supabase
          .from("campaign_objects")
          .update({ campaign_header_id: headerId })
          .eq("id", mapped.id);
        if (linkError) throw new Error(linkError.message);
        return { ...mapped, campaignHeaderId: headerId };
      }
      return mapped;
    }

    const insertRow: Database["public"]["Tables"]["campaign_objects"]["Insert"] = {
      id: input.campaignObject.id,
      conversation_id: input.conversationId,
      campaign_header_id: input.campaignHeaderId ?? null,
      workflow_id: input.campaignObject.workflowId ?? null,
      lifecycle_status: "draft",
      current_version: 0,
      created_by: input.userId,
      updated_by: input.userId,
    };

    const { error: insertError } = await supabase
      .from("campaign_objects")
      .insert(insertRow);

    if (insertError) {
      if (isDuplicateKeyError(insertError)) {
        const { data: raced, error: racedError } = await supabase
          .from("campaign_objects")
          .select("*")
          .eq("conversation_id", input.conversationId)
          .maybeSingle();
        if (racedError) throw new Error(racedError.message);
        if (raced) return mapRecord(raced as CampaignObjectRow);
      }
      throw new Error(insertError.message);
    }

    await logAuditEvent(supabase, {
      userId: input.userId,
      action: "create",
      entityType: "campaign_object",
      entityId: input.campaignObject.id,
      metadata: {
        audit_action: "campaign_object_saved",
        conversation_id: input.conversationId,
        workflow_id: input.campaignObject.workflowId,
      },
      newData: {
        conversation_id: input.conversationId,
        lifecycle_status: "draft",
      },
    });

    const { data: created, error: reloadError } = await supabase
      .from("campaign_objects")
      .select("*")
      .eq("id", input.campaignObject.id)
      .single();

    if (reloadError) throw new Error(reloadError.message);
    return mapRecord(created as CampaignObjectRow);
  }

  static async saveVersion(
    supabase: SupabaseClient<Database>,
    input: SaveCampaignObjectVersionInput
  ): Promise<SaveCampaignObjectVersionResult> {
    const record = await CampaignObjectPersistenceService.ensureHeadRecord(supabase, {
      campaignObject: input.campaignObject,
      conversationId: input.conversationId,
      userId: input.userId,
      campaignHeaderId: input.campaignHeaderId,
    });

    const headerId = input.campaignHeaderId?.trim() || null;
    if (headerId) {
      const { error: headerLinkError } = await supabase
        .from("campaign_headers")
        .update({ campaign_object_id: record.id })
        .eq("id", headerId);
      if (headerLinkError) throw new Error(headerLinkError.message);
    }

    return runSerializedVersionSave(record.id, () =>
      CampaignObjectPersistenceService.insertVersionWithRetry(supabase, {
        record,
        input,
      })
    );
  }

  private static async insertVersionWithRetry(
    supabase: SupabaseClient<Database>,
    ctx: {
      record: CampaignObjectRecord;
      input: SaveCampaignObjectVersionInput;
    }
  ): Promise<SaveCampaignObjectVersionResult> {
    const snapshot = serializeCampaignObject(ctx.input.campaignObject);
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= VERSION_SAVE_MAX_ATTEMPTS; attempt += 1) {
      const { data: versionRow, error: versionError } = await supabase
        .from("campaign_object_versions")
        .insert({
          campaign_object_id: ctx.record.id,
          workflow_id: ctx.input.campaignObject.workflowId ?? null,
          snapshot: snapshot as unknown as Database["public"]["Tables"]["campaign_object_versions"]["Insert"]["snapshot"],
          created_by: ctx.input.userId,
          updated_by: ctx.input.userId,
        })
        .select("id, version")
        .single();

      if (!versionError && versionRow) {
        const version = (versionRow as { id: string; version: number }).version;
        const versionId = (versionRow as { id: string; version: number }).id;

        await logAuditEvent(supabase, {
          userId: ctx.input.userId,
          action: "update",
          entityType: "campaign_object",
          entityId: ctx.record.id,
          metadata: {
            audit_action: "version_created",
            save_reason: ctx.input.saveReason ?? "manual",
            version,
            workflow_id: ctx.input.campaignObject.workflowId,
          },
          newData: {
            version,
            workflow_id: ctx.input.campaignObject.workflowId,
          },
        });

        const { data: refreshed, error: refreshError } = await supabase
          .from("campaign_objects")
          .select("*")
          .eq("id", ctx.record.id)
          .single();

        if (refreshError) throw new Error(refreshError.message);

        return {
          record: mapRecord(refreshed as CampaignObjectRow),
          version,
          versionId,
        };
      }

      if (isDuplicateKeyError(versionError) && attempt < VERSION_SAVE_MAX_ATTEMPTS) {
        lastError = new Error(versionError!.message);
        continue;
      }

      throw new Error(versionError?.message ?? "Failed to insert campaign object version");
    }

    throw lastError ?? new Error("Failed to insert campaign object version after retries");
  }

  static async loadLatestByConversation(
    supabase: SupabaseClient<Database>,
    conversationId: string
  ): Promise<{ record: CampaignObjectRecord; campaignObject: CampaignObject } | null> {
    const { data: head, error: headError } = await supabase
      .from("campaign_objects")
      .select("*")
      .eq("conversation_id", conversationId)
      .maybeSingle();

    if (headError) throw new Error(headError.message);
    if (!head || head.current_version <= 0) return null;

    const loaded = await CampaignObjectPersistenceService.loadVersion(
      supabase,
      head.id,
      head.current_version
    );
    if (!loaded) return null;

    return {
      record: mapRecord(head as CampaignObjectRow),
      campaignObject: loaded.campaignObject,
    };
  }

  static async loadVersion(
    supabase: SupabaseClient<Database>,
    campaignObjectId: string,
    versionNumber: number
  ): Promise<CampaignObjectVersionRow | null> {
    const { data, error } = await supabase
      .from("campaign_object_versions")
      .select("*")
      .eq("campaign_object_id", campaignObjectId)
      .eq("version", versionNumber)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return null;

    const row = data as CampaignObjectVersionDbRow;
    const snapshot = row.snapshot as CampaignObjectSnapshot;

    return {
      ...mapVersionMeta(row),
      snapshot,
      campaignObject: deserializeCampaignObject(snapshot),
    };
  }

  static async listVersions(
    supabase: SupabaseClient<Database>,
    campaignObjectId: string
  ): Promise<CampaignObjectVersionMeta[]> {
    const { data, error } = await supabase
      .from("campaign_object_versions")
      .select("id, campaign_object_id, version, workflow_id, created_by, updated_by, created_at")
      .eq("campaign_object_id", campaignObjectId)
      .order("version", { ascending: false });

    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => mapVersionMeta(row as CampaignObjectVersionDbRow));
  }

  static async restoreForConversation(
    supabase: SupabaseClient<Database>,
    conversationId: string,
    contextSnapshot?: Record<string, unknown>
  ): Promise<CampaignObject | null> {
    try {
      const fromDb = await CampaignObjectPersistenceService.loadLatestByConversation(
        supabase,
        conversationId
      );
      if (fromDb) return fromDb.campaignObject;
    } catch {
      // Fall through to snapshot when DB unavailable or RLS blocks.
    }

    const { getCampaignObjectFromSnapshot } = await import("./campaign-object-store");
    return getCampaignObjectFromSnapshot(contextSnapshot);
  }

  static async transitionLifecycle(
    supabase: SupabaseClient<Database>,
    input: {
      campaignObjectId: string;
      toStatus: CampaignObjectLifecycleStatus;
      userId: string;
      roleSlug: string | null;
    }
  ): Promise<CampaignObjectRecord> {
    const { data: head, error: headError } = await supabase
      .from("campaign_objects")
      .select("*")
      .eq("id", input.campaignObjectId)
      .single();

    if (headError) throw new Error(headError.message);

    const fromStatus = head.lifecycle_status as CampaignObjectLifecycleStatus;
    if (!isValidLifecycleTransition(fromStatus, input.toStatus)) {
      throw new Error(`Invalid lifecycle transition: ${fromStatus} → ${input.toStatus}`);
    }

    const allowed = await canTransitionLifecycle(
      supabase,
      input.roleSlug,
      fromStatus,
      input.toStatus
    );
    if (!allowed) {
      throw new Error("You do not have permission to change campaign lifecycle status.");
    }

    const { data: updated, error: updateError } = await supabase
      .from("campaign_objects")
      .update({
        lifecycle_status: input.toStatus,
        updated_by: input.userId,
      })
      .eq("id", input.campaignObjectId)
      .select("*")
      .single();

    if (updateError) throw new Error(updateError.message);

    await logAuditEvent(supabase, {
      userId: input.userId,
      action: input.toStatus === "approved" ? "approve" : "update",
      entityType: "campaign_object",
      entityId: input.campaignObjectId,
      metadata: {
        audit_action: "lifecycle_changed",
        from_status: fromStatus,
        to_status: input.toStatus,
      },
      oldData: { lifecycle_status: fromStatus },
      newData: { lifecycle_status: input.toStatus },
    });

    return mapRecord(updated as CampaignObjectRow);
  }

  static async getApprovedSnapshot(
    supabase: SupabaseClient<Database>,
    campaignObjectId: string
  ): Promise<CampaignObjectSnapshot | null> {
    const { data: head, error: headError } = await supabase
      .from("campaign_objects")
      .select("id, lifecycle_status, current_version")
      .eq("id", campaignObjectId)
      .maybeSingle();

    if (headError) throw new Error(headError.message);
    if (!head || head.current_version <= 0) return null;

    const lifecycle = head.lifecycle_status as CampaignObjectLifecycleStatus;
    if (lifecycle !== "approved" && lifecycle !== "published") {
      return null;
    }

    const version = await CampaignObjectPersistenceService.loadVersion(
      supabase,
      campaignObjectId,
      head.current_version
    );
    return version?.snapshot ?? null;
  }
}
