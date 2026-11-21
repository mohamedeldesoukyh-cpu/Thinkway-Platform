import { redirect } from "next/navigation";

import {
  isPortalActor,
  resolveWorkspaceActor,
} from "@/lib/security/workspace-actor";
import { portalHomePath } from "@/lib/security/workspace-auth";
import { createSupabaseServerClient, getRequestAuth } from "@/lib/supabase/server";
import { loadModuleAccess, moduleHome } from "@/lib/auth/module-access";
import { ModuleAccessProvider } from "@/components/layout/module-access-provider";

/**
 * Hard edge for the internal dashboard shell: portal actors must never render
 * Finance / Operations / Discovery UI even if middleware is bypassed.
 */
export async function InternalWorkspaceGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const { user } = await getRequestAuth();

  if (user) {
    const actor = await resolveWorkspaceActor(supabase, user.id);
    if (isPortalActor(actor.kind)) {
      redirect(portalHomePath(actor.kind));
    }
    const access = await loadModuleAccess(supabase);
    if (!access.media) redirect(moduleHome(access));
    return <ModuleAccessProvider value={access}>{children}</ModuleAccessProvider>;
  }

  redirect("/login");
}
