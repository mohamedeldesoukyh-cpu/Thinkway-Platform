import { CollapsibleAppSidebar } from "@/components/layout/collapsible-app-sidebar";
import { getAuthUser } from "@/lib/supabase/server";

export async function DashboardSidebarAuth() {
  const { user } = await getAuthUser();

  return <CollapsibleAppSidebar userEmail={user?.email ?? null} />;
}
