import { requireRequestUser, type RequestUser } from "@/lib/supabase/server";
import { safeOperationalQuery } from "@/lib/platform/safe-query";

import type {
  AssignableClientProfileRow,
  ClientAccessEntityRow,
  ClientAccessRole,
  ClientAccessUserRow,
} from "./types";

async function requireClientAccessRead() {
  const { supabase, userId, roleSlug } = await requireRequestUser();

  if (roleSlug === "super_admin" || roleSlug === "admin") {
    return { supabase, userId };
  }

  const { data: canRead } = await (supabase as any).rpc("has_permission", {
    p_permission: "client_access.read",
  });
  const { data: canWrite } = await (supabase as any).rpc("has_permission", {
    p_permission: "client_access.write",
  });
  const { data: canSettings } = await (supabase as any).rpc("has_permission", {
    p_permission: "settings.read",
  });
  const { data: canUsers } = await (supabase as any).rpc("has_permission", {
    p_permission: "users.read",
  });

  if (
    !(
      Boolean(canRead) ||
      Boolean(canWrite) ||
      Boolean(canSettings) ||
      Boolean(canUsers)
    )
  ) {
    throw new Error("Client access management is not permitted.");
  }

  return { supabase, userId };
}

async function mapClientUsersRows(
  supabase: RequestUser["supabase"],
  memberships: {
    client_id: string;
    profile_id: string;
    access_role?: string | null;
    is_primary: boolean;
    created_at: string;
  }[]
): Promise<Map<string, ClientAccessUserRow[]>> {
  const profileIds = [...new Set(memberships.map((m) => m.profile_id))];
  const profileById = new Map<
    string,
    { full_name: string | null; email: string }
  >();

  if (profileIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", profileIds);

    if (profilesError) throw new Error(profilesError.message);

    for (const profile of (profiles ?? []) as {
      id: string;
      full_name: string | null;
      email: string;
    }[]) {
      profileById.set(profile.id, {
        full_name: profile.full_name,
        email: profile.email,
      });
    }
  }

  const usersByClient = new Map<string, ClientAccessUserRow[]>();
  for (const row of memberships) {
    const profile = profileById.get(row.profile_id);
    const list = usersByClient.get(row.client_id) ?? [];
    list.push({
      profile_id: row.profile_id,
      full_name: profile?.full_name ?? null,
      email: profile?.email ?? "—",
      access_role: (row.access_role === "approve" ? "approve" : "view") as ClientAccessRole,
      is_primary: row.is_primary,
      granted_at: row.created_at,
    });
    usersByClient.set(row.client_id, list);
  }

  return usersByClient;
}

export async function getClientAccessForEntity(
  clientId: string
): Promise<ClientAccessEntityRow | null> {
  const result = await safeOperationalQuery(
    "client-access:getForEntity",
    async () => {
      const { supabase } = await requireClientAccessRead();

      const { data: client, error: clientError } = await supabase
        .from("clients")
        .select("id, name, document_number")
        .eq("id", clientId)
        .maybeSingle();

      if (clientError) throw new Error(clientError.message);
      if (!client) return null;

      const { data: memberships, error } = await supabase
        .from("client_users")
        .select("client_id, profile_id, access_role, is_primary, created_at")
        .eq("client_id", clientId)
        .order("is_primary", { ascending: false });

      if (error) throw new Error(error.message);

      const usersMap = await mapClientUsersRows(
        supabase,
        (memberships ?? []) as {
          client_id: string;
          profile_id: string;
          access_role?: string | null;
          is_primary: boolean;
          created_at: string;
        }[]
      );
      const users = usersMap.get(clientId) ?? [];

      const typedClient = client as {
        id: string;
        name: string;
        document_number: string;
      };

      return {
        client_id: typedClient.id,
        client_name: typedClient.name,
        document_number: typedClient.document_number,
        users,
      } satisfies ClientAccessEntityRow;
    },
    null
  );

  return result.data;
}

export async function getClientAccessOverview(): Promise<ClientAccessEntityRow[]> {
  const result = await getClientAccessOverviewResult();
  return result.data;
}

export async function getClientAccessOverviewResult() {
  return safeOperationalQuery(
    "client-access:getOverview",
    async () => {
      const { supabase } = await requireClientAccessRead();

      const { data: clients, error: clientsError } = await supabase
        .from("clients")
        .select("id, name, document_number")
        .neq("status", "archived")
        .order("name")
        .limit(200);

      if (clientsError) throw new Error(clientsError.message);

      const clientRows = (clients ?? []) as {
        id: string;
        name: string;
        document_number: string;
      }[];

      if (clientRows.length === 0) return [];

      const clientIds = clientRows.map((c) => c.id);
      const { data: memberships, error } = await supabase
        .from("client_users")
        .select("client_id, profile_id, access_role, is_primary, created_at")
        .in("client_id", clientIds);

      if (error) throw new Error(error.message);

      const usersByClient = await mapClientUsersRows(
        supabase,
        (memberships ?? []) as {
          client_id: string;
          profile_id: string;
          access_role?: string | null;
          is_primary: boolean;
          created_at: string;
        }[]
      );

      return clientRows.map((client) => ({
        client_id: client.id,
        client_name: client.name,
        document_number: client.document_number,
        users: usersByClient.get(client.id) ?? [],
      }));
    },
    []
  );
}

export async function getAssignableClientProfiles(
  clientId: string
): Promise<AssignableClientProfileRow[]> {
  const result = await safeOperationalQuery(
    "client-access:getAssignable",
    async () => {
      const { supabase } = await requireClientAccessRead();

      const { data: roleRow } = await supabase
        .from("roles")
        .select("id")
        .eq("slug", "client_user")
        .maybeSingle();

      if (!roleRow) return [];

      const { data: profiles, error } = await (supabase as any)
        .from("profiles")
        .select("id, full_name, email")
        .eq("role_id", (roleRow as { id: string }).id)
        .eq("is_active", true)
        .order("full_name");

      if (error) throw new Error(error.message);

      const { data: existing } = await supabase
        .from("client_users")
        .select("profile_id")
        .eq("client_id", clientId);

      const assigned = new Set(
        ((existing ?? []) as { profile_id: string }[]).map((r) => r.profile_id)
      );

      return ((profiles ?? []) as AssignableClientProfileRow[]).filter(
        (p) => !assigned.has(p.id)
      );
    },
    []
  );

  return result.data;
}

export async function getClientsForAccessSelect(): Promise<
  { id: string; name: string; document_number: string }[]
> {
  const result = await safeOperationalQuery(
    "client-access:getClientsSelect",
    async () => {
      const { supabase } = await requireClientAccessRead();
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, document_number")
        .order("name")
        .limit(300);
      if (error) throw new Error(error.message);
      return (data ?? []) as { id: string; name: string; document_number: string }[];
    },
    []
  );

  return result.data;
}
