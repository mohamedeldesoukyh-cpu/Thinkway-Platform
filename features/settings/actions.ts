"use server";

import { revalidatePath } from "next/cache";

import { generateInviteToken, hashInviteToken } from "@/lib/auth/invite-token";
import { requirePermission } from "@/lib/auth/permissions-server";
import { createSupabaseServerClient, requireRequestUser } from "@/lib/supabase/server";
import { logAuditEvent } from "@/lib/audit/log-audit-event";
import { inviteUserSchema } from "@/lib/validation/schemas";
import { debugSettings } from "@/features/settings/queries";

type ActionState = {
  ok: boolean;
  message?: string;
  /** One-time invite URL for the inviting admin; never logged. */
  inviteUrl?: string;
};

async function requireSettingsWrite() {
  try {
    const { supabase, user } = await requireRequestUser();
    const auth = await requirePermission(supabase, "settings.write");
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

function revalidateSettings() {
  revalidatePath("/settings/users");
  revalidatePath("/settings/roles");
  revalidatePath("/settings/permissions");
  revalidatePath("/settings/access-control");
  revalidatePath("/settings/client-access");
}

export async function inviteUserAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const businessFunctionRaw = String(formData.get("business_function") ?? "").trim();
  const parsed = inviteUserSchema.safeParse({
    full_name: String(formData.get("full_name") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    role_id: String(formData.get("role_id") ?? "").trim(),
    portal_type: String(formData.get("portal_type") ?? "internal").trim() || "internal",
    department: String(formData.get("department") ?? "").trim(),
    country_code: String(formData.get("country_code") ?? "").trim().toUpperCase(),
    business_function:
      businessFunctionRaw === "ops" || businessFunctionRaw === "sales"
        ? businessFunctionRaw
        : null,
    client_id: String(formData.get("client_id") ?? "").trim() || undefined,
    access_role: String(formData.get("access_role") ?? "view").trim() || "view",
    is_primary: formData.get("is_primary") === "on",
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid invite form.",
    };
  }

  const {
    full_name: fullName,
    email,
    role_id: roleId,
    portal_type: portalType,
    department,
    country_code: countryCode,
    business_function: businessFunction,
    client_id: clientId,
    access_role: accessRole,
    is_primary: isPrimaryInvite,
  } = parsed.data;

  const { supabase, user, error } = await requireSettingsWrite();
  if (error || !user) return { ok: false, message: error ?? "Unauthorized" };

  const rawToken = generateInviteToken();
  const tokenHash = hashInviteToken(rawToken);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();

  const inviteMetadata =
    portalType === "client"
      ? {
          client_id: clientId,
          access_role: accessRole === "approve" ? "approve" : "view",
          is_primary: isPrimaryInvite,
        }
      : {};

  const { error: insertError } = await supabase.from("user_invites").insert({
    email,
    full_name: fullName || null,
    role_id: roleId,
    portal_type: portalType,
    department: department || null,
    country_code: countryCode || null,
    business_function: businessFunction,
    token_hash: tokenHash,
    expires_at: expiresAt,
    invited_by: user.id,
    status: "invited",
    metadata: inviteMetadata,
  } as never);

  if (insertError) return { ok: false, message: insertError.message };

  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/login?invite=${encodeURIComponent(rawToken)}`;
  // Never log raw tokens or invite URLs (P1-01).
  debugSettings("user-invite", "invite created", { email, portalType });

  await supabase.from("access_logs").insert({
    actor_id: user.id,
    action: "user_invited",
    module: "settings",
    metadata: { email, role_id: roleId, portal_type: portalType },
  } as never);

  revalidateSettings();
  return {
    ok: true,
    message: "User invited. Copy the invite link now — it is shown once and never stored in plaintext.",
    inviteUrl,
  };
}

export async function updateUserRoleAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profileId = String(formData.get("profile_id") ?? "").trim();
  const roleId = String(formData.get("role_id") ?? "").trim();
  const businessFunctionRaw = String(formData.get("business_function") ?? "").trim();
  const businessFunction =
    businessFunctionRaw === "ops" || businessFunctionRaw === "sales"
      ? businessFunctionRaw
      : businessFunctionRaw === "unset"
        ? null
        : undefined;
  if (!profileId || !roleId) return { ok: false, message: "Profile and role are required." };

  const { supabase, user, error } = await requireSettingsWrite();
  if (error || !user) return { ok: false, message: error ?? "Unauthorized" };

  const updatePayload: Record<string, unknown> = { role_id: roleId };
  if (businessFunction !== undefined) {
    updatePayload.business_function = businessFunction;
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update(updatePayload as never)
    .eq("id", profileId);
  if (updateError) return { ok: false, message: updateError.message };

  await supabase.from("access_logs").insert({
    actor_id: user.id,
    target_profile_id: profileId,
    action: "role_changed",
    module: "settings",
    metadata: {
      role_id: roleId,
      ...(businessFunction !== undefined ? { business_function: businessFunction } : {}),
    },
  } as never);

  void logAuditEvent(supabase, {
    userId: user.id,
    action: "update",
    entityType: "profile",
    entityId: profileId,
    metadata: { role_id: roleId, business_function: businessFunction ?? null },
  });

  debugSettings("role-management", "user updated", { profileId, roleId, businessFunction });
  revalidateSettings();
  return { ok: true, message: "User updated." };
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
