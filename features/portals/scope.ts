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

export async function requireClientScope(
  portalPermission: "client_portal.read" | "client_portal.write" | "client_portal.approve"
): Promise<{ supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>; scope: ClientScope }> {
  const { supabase, userId } = await requirePortalPermission(portalPermission);

  const { data: memberships, error } = await supabase
    .from("client_users")
    .select("client_id")
    .eq("profile_id", userId);

  if (error) {
    throw new Error(error.message);
  }

  const clientIds = ((memberships ?? []) as { client_id: string }[])
    .map((row) => row.client_id)
    .filter(Boolean);

  if (clientIds.length === 0) {
    throw new Error("Client portal access is not mapped to any legal entity.");
  }

  return {
    supabase,
    scope: {
      userId,
      clientIds,
      primaryClientId: clientIds[0] ?? null,
    },
  };
}

export function portalLogScope(portal: PortalKey): string {
  return portal === "creator" ? "[creator-portal]" : "[client-portal]";
}
