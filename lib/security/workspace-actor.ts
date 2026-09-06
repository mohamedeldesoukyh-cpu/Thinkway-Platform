import type { SupabaseClient } from "@supabase/supabase-js";

export type WorkspaceActorKind = "anonymous" | "internal" | "client_portal" | "creator_portal";

export type WorkspaceActor = {
  userId: string | null;
  kind: WorkspaceActorKind;
};

/**
 * Resolve whether the authenticated user is a portal actor (client or creator)
 * vs internal staff. Portal membership is sourced from client_users /
 * influencers.profile_id — not invite.portal_type (invites are ephemeral).
 */
export async function resolveWorkspaceActor(
  supabase: SupabaseClient,
  userId: string | null | undefined,
): Promise<WorkspaceActor> {
  if (!userId) {
    return { userId: null, kind: "anonymous" };
  }

  const [clientLink, creatorLink] = await Promise.all([
    supabase
      .from("client_users")
      .select("client_id")
      .eq("profile_id", userId)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("influencers")
      .select("id")
      .eq("profile_id", userId)
      .limit(1)
      .maybeSingle(),
  ]);

  if (clientLink.data?.client_id) {
    return { userId, kind: "client_portal" };
  }
  if (creatorLink.data?.id) {
    return { userId, kind: "creator_portal" };
  }

  return { userId, kind: "internal" };
}

export function isPortalActor(kind: WorkspaceActorKind): boolean {
  return kind === "client_portal" || kind === "creator_portal";
}
