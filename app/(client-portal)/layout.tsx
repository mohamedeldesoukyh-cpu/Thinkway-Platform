import { redirect } from "next/navigation";

import { PortalShell } from "@/components/layout/portal-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getClientUnreadNotificationCount } from "@/features/portals/queries";
import { requireClientScope } from "@/features/portals/scope";
import { loadIdentityLogoForPortalClient } from "@/features/client-workspace/identity-logo";
import { tryCreateServiceRoleClient } from "@/lib/supabase/service-role-client";
import type { IdentityLogo } from "@/lib/entity-logos/identity-logo";
import type { PortalNavItem } from "@/components/layout/portal-nav";

const clientNavItems = [
  { href: "/client-portal", label: "Dashboard" },
  { href: "/client-portal/campaigns", label: "Campaigns" },
  { href: "/client-portal/publications", label: "Publications" },
  { href: "/client-portal/approvals", label: "Approvals" },
  { href: "/client-portal/invoices", label: "Invoices" },
  { href: "/client-portal/reports", label: "Reports" },
  { href: "/client-portal/notifications", label: "Notifications" },
  { href: "/client-portal/client-io", label: "Client IO" },
] as const;

export default async function ClientPortalLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/client-portal");
  }

  let userLabel = user.email ?? "Client";
  let identityLogo: IdentityLogo | null = null;
  try {
    const { supabase: scopedSupabase, scope } = await requireClientScope("client_portal.read");
    if (scope.primaryClientId) {
      const identityDb = tryCreateServiceRoleClient().client ?? scopedSupabase;
      identityLogo = await loadIdentityLogoForPortalClient(scopedSupabase, scope.primaryClientId);
      const { data } = await identityDb
        .from("clients")
        .select("name")
        .eq("id", scope.primaryClientId)
        .maybeSingle();
      if (data?.name) {
        userLabel = data.name;
      }
    }
  } catch {
    redirect("/");
  }

  const unreadCount = await getClientUnreadNotificationCount();
  const navItems: PortalNavItem[] = clientNavItems.map((item) =>
    item.href === "/client-portal/notifications"
      ? { ...item, badge: unreadCount }
      : { ...item }
  );

  return (
    <PortalShell
      title="Client Portal"
      description="Operational campaign visibility with approvals, invoices, reports, and client IO."
      userLabel={userLabel}
      identityLogo={identityLogo}
      navItems={navItems}
    >
      {children}
    </PortalShell>
  );
}
