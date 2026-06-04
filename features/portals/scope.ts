import { createSupabaseServerClient } from "@/lib/supabase/server";

type PortalKey = "creator" | "client";

export type CreatorScope = {
  userId: string;
  influencerId: string;
  influencerName: string;
};

export type ClientScope = {
  userId: string;
  clientIds: string[];
  primaryClientId: string | null;
};

async function requirePortalPermission(permission: string) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error(error?.message ?? "Unauthorized");
  }

  const { data: roleData } = await supabase
    .from("profiles")
    .select("role:roles(slug)")
    .eq("id", user.id)
    .maybeSingle();

  const roleSlug =
    (roleData as { role: { slug: string } | null } | null)?.role?.slug ?? null;

  const { data: allowed } = await (supabase as any).rpc("has_permission", {
    p_permission: permission,
  });

  const isAdmin = roleSlug === "super_admin" || roleSlug === "admin";
  if (!isAdmin && !Boolean(allowed)) {
    throw new Error("Access denied.");
  }

  return { supabase, userId: user.id };
}

export async function requireCreatorScope(
  portalPermission: "creator_portal.read" | "creator_portal.write" | "creator_portal.approve"
): Promise<{ supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>; scope: CreatorScope }> {
  const { supabase, userId } = await requirePortalPermission(portalPermission);

  const { data: influencer, error } = await supabase
    .from("influencers")
    .select("id, display_name")
    .eq("profile_id", userId)
    .maybeSingle();

  if (error || !influencer) {
    throw new Error(error?.message ?? "Creator profile is not linked.");
  }

  return {
    supabase,
    scope: {
      userId,
      influencerId: influencer.id as string,
      influencerName: (influencer.display_name as string) ?? "Creator",
    },
  };
}

async function provisionClientUserFromInvite(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  email: string | undefined
) {
  if (!email) return;

  const { data: invite } = await supabase
    .from("user_invites")
    .select("metadata, status")
    .eq("email", email.toLowerCase())
    .in("status", ["invited", "accepted"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!invite) return;

  const metadata = (invite as { metadata: Record<string, unknown> | null }).metadata ?? {};
  const clientId =
    typeof metadata.client_id === "string" ? metadata.client_id : null;
  if (!clientId) return;

  const accessRole =
    metadata.access_role === "approve" ? "approve" : "view";

  await supabase.from("client_users").insert({
    client_id: clientId,
    profile_id: userId,
    access_role: accessRole,
    is_primary: Boolean(metadata.is_primary),
  } as never);
}

export async function requireClientScope(
  portalPermission: "client_portal.read" | "client_portal.write" | "client_portal.approve"
): Promise<{ supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>; scope: ClientScope }> {
  const { supabase, userId } = await requirePortalPermission(portalPermission);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let { data: memberships, error } = await supabase
    .from("client_users")
    .select("client_id, is_primary")
    .eq("profile_id", userId);

  if (error) {
    throw new Error(error.message);
  }

  if ((memberships ?? []).length === 0) {
    await provisionClientUserFromInvite(supabase, userId, user?.email);
    const refetch = await supabase
      .from("client_users")
      .select("client_id, is_primary")
      .eq("profile_id", userId);
    memberships = refetch.data;
    error = refetch.error;
    if (error) throw new Error(error.message);
  }

  const rows = (memberships ?? []) as { client_id: string; is_primary: boolean }[];
  const clientIds = rows.map((row) => row.client_id).filter(Boolean);

  if (clientIds.length === 0) {
    throw new Error("Client portal access is not mapped to any legal entity.");
  }

  const primary = rows.find((row) => row.is_primary)?.client_id ?? clientIds[0] ?? null;

  return {
    supabase,
    scope: {
      userId,
      clientIds,
      primaryClientId: primary,
    },
  };
}

export function portalLogScope(portal: PortalKey): string {
  return portal === "creator" ? "[creator-portal]" : "[client-portal]";
}
