import { redirect } from "next/navigation";

import { signOutAction } from "@/features/auth/actions";
import { CreatorWorkspaceShell } from "@/features/creator-workspace/components/creator-workspace-shell";
import { CREATOR_WORKSPACE_NAV_ITEMS } from "@/features/creator-workspace/nav";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireCreatorScope } from "@/features/portals/scope";
import { resolveCreatorAvatarUrl } from "@/lib/performance/creator-avatar";

import "@/features/creator-workspace/styles/creator-workspace.css";

function isNextControlFlowError(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("digest" in error)) {
    return false;
  }
  const digest = (error as { digest?: unknown }).digest;
  return typeof digest === "string" && digest.startsWith("NEXT_");
}

export default async function CreatorPortalLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/creator-portal");
  }

  let creatorName = user.email ?? "Creator";
  let avatarUrl: string | null = null;
  try {
    const { supabase: scoped, scope } = await requireCreatorScope("creator_portal.read");
    creatorName = scope.influencerName;
    try {
      const [{ data: influencer }, { data: accounts }] = await Promise.all([
        scoped
          .from("influencers")
          .select("metadata")
          .eq("id", scope.influencerId)
          .maybeSingle(),
        scoped
          .from("influencer_platform_accounts")
          .select("profile_picture_url")
          .eq("influencer_id", scope.influencerId),
      ]);
      const meta = influencer as { metadata?: { avatar_url?: string | null } | null } | null;
      const pictures = (accounts ?? []) as Array<{ profile_picture_url: string | null }>;
      avatarUrl = resolveCreatorAvatarUrl({
        social_profile_picture_url: pictures.find((row) => row.profile_picture_url)?.profile_picture_url,
        influencer_avatar_url: meta?.metadata?.avatar_url,
      });
    } catch {
      avatarUrl = null;
    }
  } catch (error) {
    if (isNextControlFlowError(error)) throw error;
    return (
      <div className="flex min-h-svh items-center justify-center bg-background px-6">
        <div className="max-w-md space-y-4 text-center">
          <h1 className="font-heading text-xl font-semibold tracking-tight">
            Creator Workspace is not available
          </h1>
          <p className="text-sm text-muted-foreground">
            This login is not linked to a creator profile. Sign out, then open
            the invitation from Thinkway, or sign in with the creator email.
          </p>
          <form action={signOutAction}>
            <button
              type="submit"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <CreatorWorkspaceShell
      userLabel={creatorName}
      avatarUrl={avatarUrl}
      navItems={[...CREATOR_WORKSPACE_NAV_ITEMS]}
    >
      {children}
    </CreatorWorkspaceShell>
  );
}
