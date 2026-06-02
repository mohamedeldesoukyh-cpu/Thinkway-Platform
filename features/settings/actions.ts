"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { debugSettings } from "@/features/settings/queries";

type ActionState = {
  ok: boolean;
  message?: string;
};

function randomInviteToken() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function hashToken(token: string) {
  return token;
}

async function requireSettingsWrite() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return { supabase, user: null, error: error?.message ?? "Unauthorized" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role:roles(slug)")
    .eq("id", user.id)
    .maybeSingle();
  const roleSlug =
    (profile as { role: { slug: string } | null } | null)?.role?.slug ?? null;

  const { data: allowed } = await (supabase as any).rpc("has_permission", {
    p_permission: "settings.write",
  });
  if (!(roleSlug === "super_admin" || roleSlug === "admin" || Boolean(allowed))) {
    return { supabase, user: null, error: "Settings write access denied." };
  }
  return { supabase, user, error: null };
}

function revalidateSettings() {
  revalidatePath("/settings/users");
  revalidatePath("/settings/roles");
  revalidatePath("/settings/permissions");
  revalidatePath("/settings/access-control");
}

export async function inviteUserAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const roleId = String(formData.get("role_id") ?? "").trim();
  const portalType = String(formData.get("portal_type") ?? "internal").trim();
  const department = String(formData.get("department") ?? "").trim();
  const countryCode = String(formData.get("country_code") ?? "").trim().toUpperCase();

  if (!email || !roleId) return { ok: false, message: "Email and role are required." };

  const { supabase, user, error } = await requireSettingsWrite();
  if (error || !user) return { ok: false, message: error ?? "Unauthorized" };

  const rawToken = randomInviteToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();

  const { error: insertError } = await supabase.from("user_invites").insert({
    email,
    full_name: fullName || null,
    role_id: roleId,
    portal_type: portalType,
    department: department || null,
    country_code: countryCode || null,
    token_hash: tokenHash,
    expires_at: expiresAt,
    invited_by: user.id,
    status: "invited",
  } as never);

  if (insertError) return { ok: false, message: insertError.message };

  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/login?invite=${encodeURIComponent(rawToken)}`;
  debugSettings("user-invite", "invite created", { email, portalType, inviteUrl });

  await supabase.from("access_logs").insert({
    actor_id: user.id,
    action: "user_invited",
    module: "settings",
    metadata: { email, role_id: roleId, portal_type: portalType },
  } as never);

  revalidateSettings();
  return { ok: true, message: "User invited. Invite link logged in dev logs." };
}

export async function updateUserRoleAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profileId = String(formData.get("profile_id") ?? "").trim();
  const roleId = String(formData.get("role_id") ?? "").trim();
  if (!profileId || !roleId) return { ok: false, message: "Profile and role are required." };

  const { supabase, user, error } = await requireSettingsWrite();
  if (error || !user) return { ok: false, message: error ?? "Unauthorized" };

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ role_id: roleId } as never)
    .eq("id", profileId);
  if (updateError) return { ok: false, message: updateError.message };

  await supabase.from("access_logs").insert({
    actor_id: user.id,
    target_profile_id: profileId,
    action: "role_changed",
    module: "settings",
    metadata: { role_id: roleId },
  } as never);

  debugSettings("role-management", "role updated", { profileId, roleId });
  revalidateSettings();
  return { ok: true, message: "Role updated." };
}

export async function toggleUserStatusAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profileId = String(formData.get("profile_id") ?? "").trim();
  const nextStatus = String(formData.get("next_status") ?? "active").trim();
  if (!profileId) return { ok: false, message: "Profile is required." };

  const { supabase, user, error } = await requireSettingsWrite();
  if (error || !user) return { ok: false, message: error ?? "Unauthorized" };

  const isActive = nextStatus !== "disabled";
  const profileStatus = isActive ? "active" : "inactive";

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ is_active: isActive, status: profileStatus } as never)
    .eq("id", profileId);
  if (updateError) return { ok: false, message: updateError.message };

  await supabase.from("access_logs").insert({
    actor_id: user.id,
    target_profile_id: profileId,
    action: isActive ? "user_enabled" : "user_disabled",
    module: "settings",
    metadata: { status: profileStatus },
  } as never);

  debugSettings("user-management", "status toggled", { profileId, profileStatus });
  revalidateSettings();
  return { ok: true, message: `User ${isActive ? "enabled" : "disabled"}.` };
}

export async function createRoleAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const slug = String(formData.get("slug") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (!slug || !name) return { ok: false, message: "Role slug and name are required." };

  const { supabase, error } = await requireSettingsWrite();
  if (error) return { ok: false, message: error };

  const { error: insertError } = await supabase.from("roles").insert({
    slug,
    name,
    description: description || null,
    is_system: false,
  } as never);
  if (insertError) return { ok: false, message: insertError.message };

  debugSettings("role-management", "role created", { slug });
  revalidateSettings();
  return { ok: true, message: "Role created." };
}

export async function duplicateRoleAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const sourceRoleId = String(formData.get("source_role_id") ?? "").trim();
  const newSlug = String(formData.get("new_slug") ?? "").trim();
  const newName = String(formData.get("new_name") ?? "").trim();
  if (!sourceRoleId || !newSlug || !newName) {
    return { ok: false, message: "Source role, slug, and name are required." };
  }

  const { supabase, error } = await requireSettingsWrite();
  if (error) return { ok: false, message: error };

  const { data: sourceRolePerms, error: permsError } = await supabase
    .from("role_permissions")
    .select("permission_id")
    .eq("role_id", sourceRoleId);
  if (permsError) return { ok: false, message: permsError.message };
  const sourcePermRows = (sourceRolePerms ?? []) as { permission_id: string }[];

  const { data: role, error: roleError } = await supabase
    .from("roles")
    .insert({
      slug: newSlug,
      name: newName,
      is_system: false,
    } as never)
    .select("id")
    .single();

  if (roleError || !role) {
    return { ok: false, message: roleError?.message ?? "Failed to create role copy." };
  }

  const newRoleId = (role as { id: string }).id;

  if (sourcePermRows.length > 0) {
    await supabase.from("role_permissions").insert(
      sourcePermRows.map((p) => ({
        role_id: newRoleId,
        permission_id: p.permission_id,
      })) as never
    );
  }

  debugSettings("role-management", "role duplicated", { sourceRoleId, newSlug });
  revalidateSettings();
  return { ok: true, message: "Role duplicated." };
}

export async function updateRolePermissionsAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const roleId = String(formData.get("role_id") ?? "").trim();
  const permissionCsv = String(formData.get("permission_slugs") ?? "");
  if (!roleId) return { ok: false, message: "Role is required." };

  const { supabase, error } = await requireSettingsWrite();
  if (error) return { ok: false, message: error };

  const slugs = permissionCsv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const { data: permissions, error: permError } = await supabase
    .from("permissions")
    .select("id, slug")
    .in("slug", slugs);
  if (permError) return { ok: false, message: permError.message };
  const ids: string[] = [];
  for (const row of (permissions ?? []) as any[]) {
    if (typeof row?.id === "string") ids.push(row.id);
  }

  await supabase.from("role_permissions").delete().eq("role_id", roleId);
  if (ids.length > 0) {
    await supabase.from("role_permissions").insert(
      ids.map((id) => ({ role_id: roleId, permission_id: id })) as never
    );
  }

  debugSettings("access-control", "role permissions updated", {
    roleId,
    permissionCount: ids.length,
  });
  revalidateSettings();
  return { ok: true, message: "Access control updated." };
}
