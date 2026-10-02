import { DashboardShell } from "@/components/layout/dashboard-shell";
import { RateCardsWorkspace } from "@/features/rate-cards/workspace";
import { requirePermission } from "@/lib/auth/permissions-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Rate Cards | Thinkway" };
export default async function RateCardsPage({searchParams}:{searchParams:Promise<{client?:string}>}) {
  const db=await createSupabaseServerClient();const auth=await requirePermission(db,"rate_cards.read");
  const query=await searchParams;
  return <DashboardShell title="Rate Cards" hidePageHeader>{"error" in auth?<p role="alert" className="p-6">You do not have access to Rate Cards. / ليس لديك صلاحية الوصول إلى بطاقات الأسعار.</p>:<RateCardsWorkspace initialClient={query.client??""}/>}</DashboardShell>;
}
