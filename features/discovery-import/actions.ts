"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/auth/permissions-server";
import { isDemoResetEnabled } from "@/lib/discovery-import/demo-reset-policy";
import {
  resetDemoImportedCreators,
  formatResetDemoError,
  type ResetDemoImportedCreatorsResult,
} from "@/lib/discovery-import/reset-demo-imported-creators";
import {
  enqueueCreatorImportJob,
  isCreatorImportQueueAvailable,
} from "@/lib/discovery-import/queue";
import { removeCreatorImportObject, uploadCreatorImportFile } from "@/lib/supabase/storage";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import {
  inferCreatorImportFileType,
  isAllowedCreatorImportFilename,
  uploadCreatorImportSchema,
} from "./schemas";
import type { CreatorImportUploadResult } from "./types";
import {
  cancelCreatorImportFile,
  type CancelCreatorImportFileResult,
} from "@/lib/discovery-import/cancel-import";
import {
  pauseCreatorImportFile,
  type PauseCreatorImportFileResult,
} from "@/lib/discovery-import/pause-import";
import {
  resumeCreatorImportFile,
  type ResumeCreatorImportFileResult,
} from "@/lib/discovery-import/resume-import";

const EMPTY_RESET_RESULT_COUNTS = {
  deletedInfluencers: 0,
  deletedPlatformAccounts: 0,
  deletedEnrichmentRuns: 0,
  deletedCreatorSources: 0,
  skippedInfluencers: 0,
  deletedDiscoveredProfiles: 0,
  deletedProfilePosts: 0,
} satisfies Omit<ResetDemoImportedCreatorsResult, "ok" | "message">;

async function requireAuthUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      supabase,
      user: null,
      error: error?.message ?? "You must be signed in.",
    };
  }

  return { supabase, user, error: null };
}

/**
 * Best-effort cleanup of an orphaned object left by a failed upload (storage
 * upload succeeded but the DB insert failed). Import objects are immutable —
 * authenticated users cannot DELETE — so cleanup must run with the service role.
 * If the service-role key is unavailable, the orphan is left in place rather
 * than failing the request; it has no DB record and never becomes user-visible.
 */
async function rollbackOrphanedImportObject(storagePath: string): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();
    await removeCreatorImportObject({ supabase: admin, storagePath });
  } catch {
    // Service role unavailable or removal failed — leave the orphan; immutability
    // guarantees prevent users from deleting it, and no DB record references it.
  }
}

export type ResetDemoImportedCreatorsActionInput = {
  alsoDeleteDiscoveryProfiles?: boolean;
};

export async function resetDemoImportedCreatorsAction(
  input?: ResetDemoImportedCreatorsActionInput
): Promise<ResetDemoImportedCreatorsResult> {
  if (!isDemoResetEnabled()) {
    return {
      ok: false,
      message: "Demo reset is disabled in production.",
      ...EMPTY_RESET_RESULT_COUNTS,
    };
  }

  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, "discovery.admin");
  if ("error" in auth) {
    return {
      ok: false,
      message: auth.error,
      ...EMPTY_RESET_RESULT_COUNTS,
    };
  }

  try {
    const admin = createSupabaseAdminClient();
    const result = await resetDemoImportedCreators(admin, {
      alsoDeleteDiscoveryProfiles: input?.alsoDeleteDiscoveryProfiles === true,
    });
    revalidatePath("/discovery/import");
    if (input?.alsoDeleteDiscoveryProfiles) {
      revalidatePath("/discovery/search");
      revalidatePath("/discovery");
    }
    return result;
  } catch (error) {
    return {
      ok: false,
      message: formatResetDemoError(error, "Failed to reset demo creators."),
      ...EMPTY_RESET_RESULT_COUNTS,
    };
  }
}

export async function uploadCreatorImportFileAction(
  formData: FormData
): Promise<CreatorImportUploadResult> {
  const file = formData.get("file");
  const sourceName = String(formData.get("source_name") ?? "");

  const parsed = uploadCreatorImportSchema.safeParse({
    source_name: sourceName || undefined,
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Invalid upload metadata.",
    };
  }

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Please choose a file to upload." };
  }

  if (!isAllowedCreatorImportFilename(file.name)) {
    return {
      ok: false,
      message: "Only PDF, XLSX, CSV, and ZIP files are supported.",
    };
  }

  const fileType = inferCreatorImportFileType(file.name);
  if (!fileType) {
    return { ok: false, message: "Could not determine file type." };
  }

  const { supabase, user, error: authError } = await requireAuthUser();
  if (authError || !user) {
    return { ok: false, message: authError ?? "Unauthorized" };
  }

  const importId = randomUUID();
  let storagePath: string | null = null;

  try {
    const uploaded = await uploadCreatorImportFile({
      supabase,
      userId: user.id,
      importId,
      file,
    });
    storagePath = uploaded.storagePath;

    const { data, error } = await supabase
      .from("creator_import_files")
      .insert({
        id: importId,
        filename: file.name,
        source_name: parsed.data.source_name ?? null,
        file_type: fileType,
        storage_path: uploaded.storagePath,
        uploaded_by: user.id,
        status: "uploaded",
        metadata: {
          mime_type: uploaded.mimeType,
          file_size: uploaded.fileSize,
        },
      })
      .select("id")
      .single();

    if (error) {
      await rollbackOrphanedImportObject(uploaded.storagePath);
      return { ok: false, message: error.message };
    }

    let queueMessage = "";
    if (isCreatorImportQueueAvailable()) {
      const queued = await enqueueCreatorImportJob({ importFileId: data.id });
      if (queued.queued) {
        await supabase
          .from("creator_import_files")
          .update({ status: "queued" })
          .eq("id", data.id);
        queueMessage = " Queued for processing.";
      } else {
        queueMessage = ` Uploaded; queue unavailable (${queued.reason ?? "unknown"}).`;
      }
    } else {
      queueMessage = " Uploaded; set REDIS_URL to enable automatic processing.";
    }

    revalidatePath("/discovery/import");

    return {
      ok: true,
      message: `File uploaded.${queueMessage}`,
      fileId: data.id,
      filename: file.name,
    };
  } catch (error) {
    if (storagePath) {
      await rollbackOrphanedImportObject(storagePath);
    }
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Upload failed.",
    };
  }
}

export async function cancelCreatorImportFileAction(
  importFileId: string
): Promise<CancelCreatorImportFileResult> {
  const trimmedId = importFileId.trim();
  if (!trimmedId) {
    return { ok: false, message: "Import file id is required." };
  }

  const { supabase, user, error: authError } = await requireAuthUser();
  if (authError || !user) {
    return { ok: false, message: authError ?? "Unauthorized" };
  }

  try {
    const result = await cancelCreatorImportFile(supabase, trimmedId, user.id);
    if (result.ok) {
      revalidatePath("/discovery/import");
    }
    return result;
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Failed to cancel import.",
    };
  }
}

export async function pauseCreatorImportFileAction(
  importFileId: string
): Promise<PauseCreatorImportFileResult> {
  const trimmedId = importFileId.trim();
  if (!trimmedId) {
    return { ok: false, message: "Import file id is required." };
  }

  const { supabase, user, error: authError } = await requireAuthUser();
  if (authError || !user) {
    return { ok: false, message: authError ?? "Unauthorized" };
  }

  try {
    const result = await pauseCreatorImportFile(supabase, trimmedId, user.id);
    if (result.ok) {
      revalidatePath("/discovery/import");
    }
    return result;
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Failed to pause import.",
    };
  }
}

export async function resumeCreatorImportFileAction(
  importFileId: string
): Promise<ResumeCreatorImportFileResult> {
  const trimmedId = importFileId.trim();
  if (!trimmedId) {
    return { ok: false, message: "Import file id is required." };
  }

  const { supabase, user, error: authError } = await requireAuthUser();
  if (authError || !user) {
    return { ok: false, message: authError ?? "Unauthorized" };
  }

  try {
    const result = await resumeCreatorImportFile(supabase, trimmedId, user.id);
    if (result.ok) {
      revalidatePath("/discovery/import");
    }
    return result;
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Failed to resume import.",
    };
  }
}
