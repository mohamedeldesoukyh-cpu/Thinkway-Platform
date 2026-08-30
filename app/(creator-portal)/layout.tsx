import { redirect } from "next/navigation";

import { signOutAction } from "@/features/auth/actions";
import { PortalShell } from "@/components/layout/portal-shell";
import { withCreatorHomeBadge } from "@/features/creator-workspace/nav";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCreatorUnreadNotificationCount } from "@/features/portals/queries";
import { requireCreatorScope } from "@/features/portals/scope";

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
  try {
    const { scope } = await requireCreatorScope("creator_portal.read");
    creatorName = scope.influencerName;
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

  const unreadCount = await getCreatorUnreadNotificationCount();

  return (
    <PortalShell
      title="Creator Workspace"
      description="Your campaigns, deliverables, and payments — what to do next."
      userLabel={creatorName}
      navItems={withCreatorHomeBadge(unreadCount)}
      mobileNavPlacement="bottom"
    >
      {children}
    </PortalShell>
  );
}
