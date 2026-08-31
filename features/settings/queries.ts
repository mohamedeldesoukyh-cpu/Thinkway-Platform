import { requirePermission } from "@/lib/auth/permissions-server";
import { requireRequestUser } from "@/lib/supabase/server";
import { safeOperationalQuery } from "@/lib/platform/safe-query";
import { devLog } from "@/lib/platform/logger";

import { INTERNAL_ROLE_SLUGS, SETTINGS_MODULES } from "@/features/settings/constants";
import type {
  RolePermissionMatrix,
  SettingsPermissionRow,
  SettingsRoleRow,
  SettingsUserRow,
  UserInviteRow,
} from "@/features/settings/types";

async function requireSettingsAccess() {
  const { supabase, userId, roleSlug } = await requireRequestUser();
  const auth = await requirePermission(supabase, "settings.read");
  if ("error" in auth) throw new Error(auth.error);
  return { supabase, userId, roleSlug };
}

export async function getSettingsUsers(params: {
  q?: string;
  status?: string;
  role?: string;
}): Promise<SettingsUserRow[]> {
  const result = await safeOperationalQuery(
    "settings:getUsers",
    async () => {
      const { supabase } = await requireSettingsAccess();
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select(
          `
          id, full_name, email, job_title, metadata, is_active, status, last_seen_at,
          business_function,
          role:roles(id, slug, name)
        `
        )
        .order("created_at", { ascending: false })
        .limit(300);

      if (error) throw new Error(error.message);

      const rows = ((profiles ?? []) as unknown[]).map((row) => {
        const typed = row as {
          id: string;
          full_name: string | null;
          email: string;
          job_title: string | null;
          metadata: Record<string, unknown> | null;
          is_active: boolean;
          status: string | null;
          last_seen_at: string | null;
          business_function: "ops" | "sales" | null;
          role: { id: string; slug: string; name: string } | null;
        };
        const metadata = typed.metadata ?? {};
        const roleSlug = typed.role?.slug ?? null;
        const portalType =
          roleSlug === "client_user"
            ? "client"
            : roleSlug === "influencer"
              ? "creator"
              : "internal";

        return {
          id: typed.id,
          name: typed.full_name,
          email: typed.email,
          role: typed.role?.name ?? null,
          role_slug: roleSlug,
          business_function: typed.business_function,
          department:
            (metadata.department as string | undefined) ?? typed.job_title ?? null,
          country: (metadata.country as string | undefined) ?? null,
          status:
            typed.is_active === false
              ? "disabled"
              : typed.status === "invited"
                ? "invited"
                : "active",
          last_login: typed.last_seen_at,
          portal_type: portalType,
          access_level:
            portalType === "internal"
              ? "Internal"
              : portalType === "client"
                ? "Client Portal"
                : "Creator Workspace",
          is_active: typed.is_active,
        } satisfies SettingsUserRow;
      });

      return rows.filter((row) => {
        if (params.status && params.status !== "all" && row.status !== params.status) {
          return false;
        }
        if (params.role && params.role !== "all" && row.role_slug !== params.role) {
          return false;
        }
        if (params.q?.trim()) {
          const q = params.q.trim().toLowerCase();
          return (
            row.email.toLowerCase().includes(q) ||
            (row.name ?? "").toLowerCase().includes(q) ||
            (row.role ?? "").toLowerCase().includes(q)
          );
        }
        return true;
      });
    },
    []
  );
  return result.data;
}

export async function getSettingsRoles(): Promise<SettingsRoleRow[]> {
  const result = await safeOperationalQuery(
    "settings:getRoles",
    async () => {
      const { supabase } = await requireSettingsAccess();
      const [rolesResult, profilesResult, rolePermsResult] = await Promise.all([
        supabase.from("roles").select("id, slug, name, description").order("name"),
        supabase.from("profiles").select("id, role_id"),
        supabase.from("role_permissions").select("role_id, permission_id"),
      ]);

      if (rolesResult.error) throw new Error(rolesResult.error.message);
      if (profilesResult.error) throw new Error(profilesResult.error.message);
      if (rolePermsResult.error) throw new Error(rolePermsResult.error.message);

      const roleRows = (rolesResult.data ?? []) as unknown as {
        id: string;
        slug: string;
        name: string;
        description: string | null;
      }[];
      const profileRows = (profilesResult.data ?? []) as unknown as {
        id: string;
        role_id: string | null;
      }[];
      const rolePermRows = (rolePermsResult.data ?? []) as unknown as {
        role_id: string;
        permission_id: string;
      }[];

      const usersByRole = new Map<string, number>();
      for (const p of profileRows) {
        if (!p.role_id) continue;
        usersByRole.set(p.role_id, (usersByRole.get(p.role_id) ?? 0) + 1);
      }

      const permsByRole = new Map<string, number>();
      for (const rp of rolePermRows) {
        permsByRole.set(rp.role_id, (permsByRole.get(rp.role_id) ?? 0) + 1);
      }

      return roleRows.map((r) => ({
        id: r.id,
        slug: r.slug,
        name: r.name,
        description: r.description,
        user_count: usersByRole.get(r.id) ?? 0,
        permission_count: permsByRole.get(r.id) ?? 0,
      }));
    },
    []
  );

  return result.data;
}

export async function getSettingsPermissions(): Promise<SettingsPermissionRow[]> {
  const result = await safeOperationalQuery(
    "settings:getPermissions",
    async () => {
      const { supabase } = await requireSettingsAccess();
      const { data, error } = await supabase
        .from("permissions")
        .select("id, slug, resource, action, description")
        .order("resource")
        .order("action");
      if (error) throw new Error(error.message);
      return (data ?? []) as SettingsPermissionRow[];
    },
    []
  );
  return result.data;
}

export async function getRolePermissionMatrix(): Promise<RolePermissionMatrix[]> {
  const result = await safeOperationalQuery(
    "settings:getRolePermissionMatrix",
    async () => {
      const { supabase } = await requireSettingsAccess();

      const [rolesResult, permissionsResult, rolePermsResult] = await Promise.all([
        supabase.from("roles").select("id, slug, name").order("name"),
        supabase.from("permissions").select("id, slug"),
        supabase.from("role_permissions").select("role_id, permission_id"),
      ]);
      if (rolesResult.error) throw new Error(rolesResult.error.message);
      if (permissionsResult.error) throw new Error(permissionsResult.error.message);
      if (rolePermsResult.error) throw new Error(rolePermsResult.error.message);

      const roleRows = (rolesResult.data ?? []) as unknown as {
        id: string;
        slug: string;
        name: string;
      }[];
      const permissionRows = (permissionsResult.data ?? []) as unknown as {
        id: string;
        slug: string;
      }[];
      const rolePermRows = (rolePermsResult.data ?? []) as unknown as {
        role_id: string;
        permission_id: string;
      }[];

      const permById = new Map(permissionRows.map((p) => [p.id, p.slug]));
      const grouped = new Map<string, string[]>();
      for (const rp of rolePermRows) {
        const slug = permById.get(rp.permission_id);
        if (!slug) continue;
        const list = grouped.get(rp.role_id) ?? [];
        list.push(slug);
        grouped.set(rp.role_id, list);
      }

      return roleRows.map((role) => ({
        role_id: role.id,
        role_slug: role.slug,
        role_name: role.name,
        permissions: grouped.get(role.id) ?? [],
      }));
    },
    []
  );
  return result.data;
}

export async function getUserInvites(): Promise<UserInviteRow[]> {
  const result = await safeOperationalQuery(
    "settings:getUserInvites",
    async () => {
      const { supabase } = await requireSettingsAccess();
      const { data, error } = await supabase
        .from("user_invites")
        .select("id, email, full_name, role_id, portal_type, status, expires_at, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw new Error(error.message);
      return (data ?? []) as UserInviteRow[];
    },
    []
  );
  return result.data;
}

export function getAccessControlGuidance() {
  const hardRules = [
    "Creators cannot access treasury",
    "Clients cannot access billing queue",
    "Finance cannot access creator portal",
    "Account managers cannot access treasury write scope",
  ];
  return {
    modules: SETTINGS_MODULES,
    internalRoles: [...INTERNAL_ROLE_SLUGS],
    hardRules,
  };
}

export function debugSettings(
  scope: "user-management" | "role-management" | "access-control" | "user-invite",
  message: string,
  detail?: unknown
) {
  devLog(`[${scope}]`, message, detail);
}
