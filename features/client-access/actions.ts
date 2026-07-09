"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/auth/permissions-server";
import { createSupabaseServerClient, requireRequestUser } from "@/lib/supabase/server";

import { CLIENT_ACCESS_REVALIDATE_PATHS } from "./constants";
import type { ClientAccessRole } from "./types";

type ActionState = { ok: boolean; message?: string };

async function requireClientAccessWrite() {
  try {
    const { supabase, user } = await requireRequestUser();
    const auth = await requirePermission(supabase, "client_access.write");
    if ("error" in auth) {
      return { supabase, user: null, error: auth.error };
    }
    return { supabase, user, error: null };
  } catch (error) {
    const supabase = await createSupabaseServerClient();
    return {
      supabase,
      user: null,
      error: error instanceof Error ? error.message : "Unauthorized",
    };
  }
}

function revalidateClientAccess(clientId?: string) {
  for (const path of CLIENT_ACCESS_REVALIDATE_PATHS) {
    revalidatePath(path);
  }
  if (clientId) revalidatePath(`/clients/${clientId}`);
}

export async function assignClientUserAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const clientId = String(formData.get("client_id") ?? "").trim();
  const profileId = String(formData.get("profile_id") ?? "").trim();
  const accessRole = String(formData.get("access_role") ?? "view").trim() as ClientAccessRole;
  const isPrimary = formData.get("is_primary") === "on";

  if (!clientId || !profileId) {
    return { ok: false, message: "Legal entity and user are required." };
  }
  if (accessRole !== "view" && accessRole !== "approve") {
    return { ok: false, message: "Invalid access role." };
  }

  const { supabase, user, error } = await requireClientAccessWrite();
  if (error || !user) return { ok: false, message: error ?? "Unauthorized" };

  if (isPrimary) {
    await supabase
      .from("client_users")
      .update({ is_primary: false } as never)
      .eq("client_id", clientId);
  }

  const { error: insertError } = await supabase.from("client_users").insert({
    client_id: clientId,
    profile_id: profileId,
    access_role: accessRole,
    is_primary: isPrimary,
    granted_by: user.id,
  } as never);

  if (insertError) return { ok: false, message: insertError.message };

  await supabase.from("access_logs").insert({
    actor_id: user.id,
    target_profile_id: profileId,
    action: "client_user_assigned",
    module: "client_access",
    metadata: { client_id: clientId, access_role: accessRole, is_primary: isPrimary },
  } as never);

  revalidateClientAccess(clientId);
  return { ok: true, message: "Client user assigned." };
}

export async function updateClientAccessRoleAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const clientId = String(formData.get("client_id") ?? "").trim();
  const profileId = String(formData.get("profile_id") ?? "").trim();
  const accessRole = String(formData.get("access_role") ?? "").trim() as ClientAccessRole;

  if (!clientId || !profileId || (accessRole !== "view" && accessRole !== "approve")) {
    return { ok: false, message: "Invalid update payload." };
  }

  const { supabase, user, error } = await requireClientAccessWrite();
  if (error || !user) return { ok: false, message: error ?? "Unauthorized" };

  const { error: updateError } = await supabase
    .from("client_users")
    .update({ access_role: accessRole } as never)
    .eq("client_id", clientId)
    .eq("profile_id", profileId);

  if (updateError) return { ok: false, message: updateError.message };

  await supabase.from("access_logs").insert({
    actor_id: user.id,
    target_profile_id: profileId,
    action: "client_access_role_updated",
    module: "client_access",
    metadata: { client_id: clientId, access_role: accessRole },
  } as never);

  revalidateClientAccess(clientId);
  return { ok: true, message: "Access role updated." };
}

export async function setPrimaryClientUserAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const clientId = String(formData.get("client_id") ?? "").trim();
  const profileId = String(formData.get("profile_id") ?? "").trim();

  if (!clientId || !profileId) {
    return { ok: false, message: "Legal entity and user are required." };
  }

  const { supabase, user, error } = await requireClientAccessWrite();
  if (error || !user) return { ok: false, message: error ?? "Unauthorized" };

  await supabase
    .from("client_users")
    .update({ is_primary: false } as never)
    .eq("client_id", clientId);

  const { error: updateError } = await supabase
    .from("client_users")
    .update({ is_primary: true } as never)
    .eq("client_id", clientId)
    .eq("profile_id", profileId);

  if (updateError) return { ok: false, message: updateError.message };

  revalidateClientAccess(clientId);
  return { ok: true, message: "Primary contact updated." };
}

export async function removeClientUserAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const clientId = String(formData.get("client_id") ?? "").trim();
  const profileId = String(formData.get("profile_id") ?? "").trim();

  if (!clientId || !profileId) {
    return { ok: false, message: "Legal entity and user are required." };
  }

  const { supabase, user, error } = await requireClientAccessWrite();
  if (error || !user) return { ok: false, message: error ?? "Unauthorized" };

  const { error: deleteError } = await supabase
    .from("client_users")
    .delete()
    .eq("client_id", clientId)
    .eq("profile_id", profileId);

  if (deleteError) return { ok: false, message: deleteError.message };

  await supabase.from("access_logs").insert({
    actor_id: user.id,
    target_profile_id: profileId,
    action: "client_user_removed",
    module: "client_access",
    metadata: { client_id: clientId },
  } as never);

  revalidateClientAccess(clientId);
  return { ok: true, message: "Client user removed." };
}
