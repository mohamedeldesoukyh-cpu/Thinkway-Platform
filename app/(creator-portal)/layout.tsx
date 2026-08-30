import { redirect } from "next/navigation";

import { PortalShell } from "@/components/layout/portal-shell";
import { withCreatorHomeBadge } from "@/features/creator-workspace/nav";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCreatorUnreadNotificationCount } from "@/features/portals/queries";
import { requireCreatorScope } from "@/features/portals/scope";

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
  } catch {
    redirect("/");
  }

  const unreadCount = await getCreatorUnreadNotificationCount();

  return (
    <PortalShell
      title="Creator Workspace"
      description="See what to do next. Your work stays connected to Thinkway."
      userLabel={creatorName}
      navItems={withCreatorHomeBadge(unreadCount)}
      mobileNavPlacement="bottom"
    >
      {children}
    </PortalShell>
  );
}
