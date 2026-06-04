import { redirect } from "next/navigation";

import { PortalShell } from "@/components/layout/portal-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCreatorUnreadNotificationCount } from "@/features/portals/queries";
import { requireCreatorScope } from "@/features/portals/scope";
import type { PortalNavItem } from "@/components/layout/portal-nav";

const creatorNavItems = [
  { href: "/creator-portal", label: "Dashboard" },
  { href: "/creator-portal/campaigns", label: "Campaigns" },
  { href: "/creator-portal/deliverables", label: "Deliverables" },
  { href: "/creator-portal/publications", label: "Publications" },
  { href: "/creator-portal/payments", label: "Payments" },
  { href: "/creator-portal/vendor-ios", label: "Vendor IOs" },
  { href: "/creator-portal/notifications", label: "Notifications" },
  { href: "/creator-portal/profile", label: "Profile" },
] as const;

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
  const navItems: PortalNavItem[] = creatorNavItems.map((item) =>
    item.href === "/creator-portal/notifications"
      ? { ...item, badge: unreadCount }
      : { ...item }
  );

  return (
    <PortalShell
      title="Creator Portal"
      description="Campaign-focused execution for creator assignments, IOs, deliverables, and payment visibility."
      userLabel={creatorName}
      navItems={navItems}
    >
      {children}
    </PortalShell>
  );
}
