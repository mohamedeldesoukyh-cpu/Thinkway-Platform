"use server";

import { revalidatePath } from "next/cache";

import {
  createSignedDocumentUrl,
  removeStorageObject,
  uploadEntityDocument,
} from "@/lib/supabase/storage";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { findDuplicateClient, findDuplicateGroup } from "@/lib/validation/checks";
import { friendlyActionError } from "@/lib/validation/hierarchy";
import type { AgencyOrDirect, PaymentTerms } from "@/types/database";

import {
  archiveLegalEntitySchema,
  createGroupSchema,
  updateGroupLegalEntitySchema,
  updateGroupSchema,
  uploadGroupDocumentSchema,
} from "./schemas";

export type FormActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
  groupId?: string;
};

export type CreateGroupFormState = FormActionState;

function emptyToNull(value: string | undefined): string | null {
  if (!value?.trim()) {
    return null;
  }
  return value.trim();
}

async function requireAuthUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return { supabase, user: null, error: error?.message ?? "Unauthorized" };
  }
  return { supabase, user, error: null };
}

export async function createGroupAction(
  _prev: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const parsed = createGroupSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { supabase, user, error: authError } = await requireAuthUser();
  if (authError || !user) {
    return { ok: false, message: authError ?? "Unauthorized" };
  }

  try {
    const duplicate = await findDuplicateGroup(supabase, parsed.data.name);
    if (duplicate) {
      return { ok: false, message: duplicate, fieldErrors: { name: [duplicate] } };
    }
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Validation failed.",
    };
  }

  const { data, error } = await supabase
    .from("groups")
    .insert({
      name: parsed.data.name,
      region: emptyToNull(parsed.data.region),
      status: parsed.data.status,
      notes: emptyToNull(parsed.data.notes),
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) {
    return {
      ok: false,
      message: friendlyActionError(error, "group", error.message),
      fieldErrors: error.code === "23505" ? { name: [friendlyActionError(error, "group")] } : undefined,
    };
  }

  revalidatePath("/groups");
  return { ok: true, message: "Group created.", groupId: data.id };
}

export async function updateGroupAction(
  _prev: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const parsed = updateGroupSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { supabase, error: authError } = await requireAuthUser();
  if (authError) {
    return { ok: false, message: authError };
  }

  try {
    const duplicate = await findDuplicateGroup(
      supabase,
      parsed.data.name,
      parsed.data.group_id
    );
    if (duplicate) {
      return { ok: false, message: duplicate, fieldErrors: { name: [duplicate] } };
    }
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Validation failed.",
    };
  }

  const { error } = await supabase
    .from("groups")
    .update({
      name: parsed.data.name,
      region: emptyToNull(parsed.data.region),
      status: parsed.data.status,
      account_director_id: emptyToNull(parsed.data.account_director_id),
      notes: emptyToNull(parsed.data.notes),
    })
    .eq("id", parsed.data.group_id);

  if (error) {
    return {
      ok: false,
      message: friendlyActionError(error, "group", error.message),
      fieldErrors: error.code === "23505" ? { name: [friendlyActionError(error, "group")] } : undefined,
    };
  }

  revalidatePath("/groups");
  revalidatePath(`/groups/${parsed.data.group_id}`);
  return { ok: true, message: "Group updated." };
}

export async function updateGroupLegalEntityAction(
  _prev: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const parsed = updateGroupLegalEntitySchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { supabase, error: authError } = await requireAuthUser();
  if (authError) {
    return { ok: false, message: authError };
  }

  try {
    const duplicate = await findDuplicateClient(
      supabase,
      parsed.data.name,
      parsed.data.agency_or_direct as AgencyOrDirect,
      parsed.data.client_id
    );
    if (duplicate) {
      return { ok: false, message: duplicate, fieldErrors: { name: [duplicate] } };
    }
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Validation failed.",
    };
  }

  const { error } = await supabase
    .from("clients")
    .update({
      name: parsed.data.name,
      legal_name: emptyToNull(parsed.data.legal_name),
      agency_or_direct: parsed.data.agency_or_direct as AgencyOrDirect,
      country: emptyToNull(parsed.data.country),
      currency: parsed.data.currency,
      payment_terms: (emptyToNull(parsed.data.payment_terms) ??
        null) as PaymentTerms | null,
      status: parsed.data.status,
    })
    .eq("id", parsed.data.client_id)
    .eq("group_id", parsed.data.group_id);

  if (error) {
    return {
      ok: false,
      message: friendlyActionError(error, "client", error.message),
      fieldErrors: error.code === "23505" ? { name: [friendlyActionError(error, "client")] } : undefined,
    };
  }

  revalidatePath(`/groups/${parsed.data.group_id}`);
  revalidatePath(`/clients/${parsed.data.client_id}`);
  revalidatePath("/clients");
  return { ok: true, message: "Legal entity updated." };
}

export async function archiveLegalEntityAction(
  _prev: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const parsed = archiveLegalEntitySchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) {
    return { ok: false, message: "Invalid request." };
  }

  const { supabase, error: authError } = await requireAuthUser();
  if (authError) {
    return { ok: false, message: authError };
  }

  const { error } = await supabase
    .from("clients")
    .update({ status: "archived" })
    .eq("id", parsed.data.client_id)
    .eq("group_id", parsed.data.group_id);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath(`/groups/${parsed.data.group_id}`);
  revalidatePath("/clients");
  return { ok: true, message: "Legal entity archived." };
}

export async function uploadGroupDocumentAction(
  _prev: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const groupId = String(formData.get("entity_id") ?? formData.get("group_id") ?? "");
  const documentType = String(formData.get("document_type") ?? "");
  const expiresAt = String(formData.get("expires_at") ?? "");
  const file = formData.get("file");

  const parsed = uploadGroupDocumentSchema.safeParse({
    group_id: groupId,
    document_type: documentType,
    expires_at: expiresAt,
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  if (!(file instanceof File) || file.size === 0) {
    return {
      ok: false,
      message: "Please choose a file.",
      fieldErrors: { file: ["File is required"] },
    };
  }

  const { supabase, user, error: authError } = await requireAuthUser();
  if (authError || !user) {
    return { ok: false, message: authError ?? "Unauthorized" };
  }

  try {
    const uploaded = await uploadEntityDocument({
      supabase,
      bucket: "group-documents",
      entityId: parsed.data.group_id,
      documentType: parsed.data.document_type,
      file,
    });

    const { error } = await supabase.from("group_documents").insert({
      group_id: parsed.data.group_id,
      document_type: parsed.data.document_type,
      file_name: file.name,
      storage_path: uploaded.storagePath,
      mime_type: uploaded.mimeType,
      file_size: uploaded.fileSize,
      expires_at: parsed.data.expires_at,
      uploaded_by: user.id,
    });

    if (error) {
      await removeStorageObject({
        supabase,
        bucket: "group-documents",
        storagePath: uploaded.storagePath,
      });
      return { ok: false, message: error.message };
    }
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Upload failed.",
    };
  }

  revalidatePath(`/groups/${parsed.data.group_id}`);
  return { ok: true, message: "Document uploaded." };
}

export async function deleteGroupDocumentAction(
  _prev: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const documentId = String(formData.get("document_id") ?? "");
  const groupId = String(formData.get("group_id") ?? "");

  const { supabase, error: authError } = await requireAuthUser();
  if (authError) {
    return { ok: false, message: authError };
  }

  const { data: doc, error: fetchError } = await supabase
    .from("group_documents")
    .select("storage_path")
    .eq("id", documentId)
    .eq("group_id", groupId)
    .maybeSingle();

  if (fetchError || !doc) {
    return { ok: false, message: fetchError?.message ?? "Not found." };
  }

  await supabase.from("group_documents").delete().eq("id", documentId);

  try {
    await removeStorageObject({
      supabase,
      bucket: "group-documents",
      storagePath: doc.storage_path,
    });
  } catch {
    // best-effort
  }

  revalidatePath(`/groups/${groupId}`);
  return { ok: true, message: "Document removed." };
}

export async function getGroupDocumentDownloadUrlAction(
  documentId: string,
  groupId: string
): Promise<{ url?: string; error?: string }> {
  const { supabase, error: authError } = await requireAuthUser();
  if (authError) {
    return { error: authError };
  }

  const { data: doc, error } = await supabase
    .from("group_documents")
    .select("storage_path")
    .eq("id", documentId)
    .eq("group_id", groupId)
    .maybeSingle();

  if (error || !doc) {
    return { error: error?.message ?? "Not found." };
  }

  try {
    const url = await createSignedDocumentUrl({
      supabase,
      bucket: "group-documents",
      storagePath: doc.storage_path,
    });
    return { url };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Could not create link.",
    };
  }
}
